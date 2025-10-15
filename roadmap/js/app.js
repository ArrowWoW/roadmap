(function () {
  const monthRange = generateMonthRange('2025-10', '2026-10');
  const monthsList = document.getElementById('timeline-list');
  const panel = document.querySelector('.month-panel');
  const panelScrim = document.getElementById('panel-scrim');
  const panelTitle = document.getElementById('panel-month-title');
  const panelSubtitle = document.getElementById('panel-month-subtitle');
  const noteListEl = document.getElementById('note-list');
  const noteForm = document.getElementById('note-form');
  const newNoteButton = document.querySelector('[data-action="new-note"]');
  const noteFormPlaceholder = document.getElementById('note-form-placeholder');
  const fileListEl = document.getElementById('file-list');
  const dropzone = document.querySelector('.dropzone');
  const fileInput = document.getElementById('file-input');
  const toastContainer = document.querySelector('.toast-container');
  const themeToggleBtn = document.querySelector('[data-action="toggle-theme"]');
  const appMenu = document.querySelector('.app-menu');
  const searchInput = document.getElementById('note-search');
  const filterStatus = document.getElementById('filter-status');
  const filterPriority = document.getElementById('filter-priority');
  const sortSelect = document.getElementById('sort-notes');
  const modal = document.getElementById('unsaved-modal');
  const notesMetric = document.getElementById('metric-notes');
  const filesMetric = document.getElementById('metric-files');
  const progressMetric = document.getElementById('metric-progress');
  const clientsPanel = document.getElementById('clients-panel');
  const clientsScrim = document.getElementById('clients-scrim');
  const clientForm = document.getElementById('client-form');
  const clientsList = document.getElementById('clients-list');
  const clientsEmpty = document.getElementById('clients-empty');
  const productsPanel = document.getElementById('products-panel');
  const productsScrim = document.getElementById('products-scrim');
  const productForm = document.getElementById('product-form');
  const productsList = document.getElementById('products-list');
  const productsEmpty = document.getElementById('products-empty');
  const aiPanel = document.getElementById('ai-panel');
  const aiScrim = document.getElementById('ai-scrim');
  const aiForm = document.getElementById('ai-form');
  const aiList = document.getElementById('ai-list');
  const aiEmpty = document.getElementById('ai-empty');
  const aiMetricActive = document.getElementById('ai-metric-active');
  const aiMetricTraining = document.getElementById('ai-metric-training');
  const aiMetricQueued = document.getElementById('ai-metric-queued');
  const aiFloatingActions = document.querySelector('.ai-floating-actions');
  const defaultPanelSubtitle = panelSubtitle ? panelSubtitle.textContent : '';

  let appState = null;
  let activeMonth = null;
  let unsavedChanges = false;
  let fallbackNoticeShown = false;
  let saveTimeout = null;
  let pendingCloseAction = null;
  let modalResolver = null;
  let clientsPanelOpen = false;
  let productsPanelOpen = false;
  let aiPanelOpen = false;
  const openProductIds = new Set();
  const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB limit for product thumbnails

  if (newNoteButton) {
    newNoteButton.setAttribute('aria-expanded', 'false');
  }

  init();

  async function init() {
    try {
      const stored = await window.metcorDB.readState();
      if (stored) {
        appState = hydrateState(stored);
      } else {
        const initial = await fetch('data/initial-notes.json').then((res) => res.json()).catch(() => ({}));
        appState = createDefaultState(initial);
        await persistState(true);
      }
    } catch (err) {
      console.error('Błąd inicjalizacji stanu', err);
      appState = createDefaultState({});
    }

    window.metcorDB.onFallback(() => {
      if (!fallbackNoticeShown) {
        fallbackNoticeShown = true;
        createToast('Tryb offline: dane zapisywane w localStorage', 'warning');
      }
    });

    renderTimeline();
    renderClientsList();
    renderProductsList();
    renderAiBotsList();
    bindEvents();
    applyTheme(appState.ui.theme || 'light');
    setMenuActive('timeline');

    if (appState.ui.lastOpenedMonth) {
      openMonth(appState.ui.lastOpenedMonth);
    }
  }

  function generateMonthRange(start, end) {
    const result = [];
    const [startYear, startMonth] = start.split('-').map(Number);
    const [endYear, endMonth] = end.split('-').map(Number);
    let year = startYear;
    let month = startMonth - 1;
    const endDate = new Date(endYear, endMonth - 1, 1);
    while (new Date(year, month, 1) <= endDate) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      result.push(key);
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    return result;
  }

  function createDefaultState(initialData) {
    const source = initialData || {};
    const monthSeed = source.months && typeof source.months === 'object' ? source.months : source;
    const initialClients = Array.isArray(source.clients) ? source.clients : [];
    const initialProducts = Array.isArray(source.products) ? source.products : [];
    const initialAiBots = Array.isArray(source.aiBots) ? source.aiBots : [];
    const state = {
      months: {},
      ui: {
        lastOpenedMonth: null,
        theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      },
      clients: [],
      products: [],
      aiBots: [],
    };
    for (const month of monthRange) {
      const monthData = monthSeed[month] || { notes: [], files: [] };
      state.months[month] = {
        notes: (monthData.notes || []).map((note) => ({
          ...note,
          checked: Boolean(note.checked),
        })),
        files: (monthData.files || []).map((file) => ({ ...file, data: null })),
      };
    }
    state.clients = initialClients.map(normalizeClient).filter(Boolean);
    state.products = initialProducts.map(normalizeProduct).filter(Boolean);
    state.aiBots = initialAiBots.map(normalizeAiBot).filter(Boolean);
    return state;
  }

  function hydrateState(stored) {
    const state = createDefaultState({});
    if (stored && stored.months) {
      for (const month of Object.keys(stored.months)) {
        if (!state.months[month]) {
          state.months[month] = { notes: [], files: [] };
        }
        const monthData = stored.months[month];
        state.months[month].notes = (monthData.notes || []).map((note) => ({
          ...note,
          checked: Boolean(note.checked),
        }));
        state.months[month].files = (monthData.files || []).map((file) => ({ ...file, data: null }));
      }
    }
    if (stored && stored.ui) {
      state.ui = { ...state.ui, ...stored.ui };
    }
    if (stored && Array.isArray(stored.clients)) {
      state.clients = stored.clients.map(normalizeClient).filter(Boolean);
    }
    if (stored && Array.isArray(stored.products)) {
      state.products = stored.products.map(normalizeProduct).filter(Boolean);
    }
    if (stored && Array.isArray(stored.aiBots)) {
      state.aiBots = stored.aiBots.map(normalizeAiBot).filter(Boolean);
    }
    return state;
  }

  async function persistState(force = false) {
    if (!appState) return;
    if (!force && saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    try {
      await window.metcorDB.writeState(appState);
    } catch (err) {
      console.error('Nie udało się zapisać stanu', err);
      createToast('Błąd zapisu stanu', 'error');
    }
  }

  function scheduleSave() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    // 300 ms debounce to avoid hammering IndexedDB on rapid edits
    saveTimeout = setTimeout(() => {
      persistState();
      saveTimeout = null;
    }, 300);
  }

  function bindEvents() {
    monthsList.addEventListener('click', handleMonthClick);
    document.querySelector('[data-action="close-panel"]').addEventListener('click', () => closePanel());
    const clientsCloseButton = document.querySelector('[data-action="close-clients"]');
    if (clientsCloseButton) {
      clientsCloseButton.addEventListener('click', () => closeClientsPanel({ focusMenuKey: 'clients' }));
    }
    const productsCloseButton = document.querySelector('[data-action="close-products"]');
    if (productsCloseButton) {
      productsCloseButton.addEventListener('click', () => closeProductsPanel({ focusMenuKey: 'products' }));
    }
    const aiCloseButton = document.querySelector('[data-action="close-ai"]');
    if (aiCloseButton) {
      aiCloseButton.addEventListener('click', () => closeAiPanel({ focusMenuKey: 'ai' }));
    }
    if (appMenu) {
      appMenu.addEventListener('click', handleMenuClick);
    }
    if (panelScrim) {
      panelScrim.addEventListener('click', () => closePanel());
    }
    if (clientsScrim) {
      clientsScrim.addEventListener('click', () => closeClientsPanel({ focusMenuKey: 'timeline' }));
    }
    if (productsScrim) {
      productsScrim.addEventListener('click', () => closeProductsPanel({ focusMenuKey: 'timeline' }));
    }
    if (aiScrim) {
      aiScrim.addEventListener('click', () => closeAiPanel({ focusMenuKey: 'timeline' }));
    }
    noteForm.addEventListener('submit', handleNoteSubmit);
    noteForm.querySelector('[data-action="cancel-edit"]').addEventListener('click', handleNoteCancel);
    noteForm.querySelectorAll('.status-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setNoteStatus(btn.dataset.status);
        unsavedChanges = true;
      });
    });
    if (newNoteButton) {
      newNoteButton.addEventListener('click', async () => {
        if (!activeMonth) {
          return;
        }
        if (!noteForm.hidden && noteForm.dataset.mode === 'create') {
          const titleField = noteForm.elements.title;
          if (titleField) {
            titleField.focus();
          }
          return;
        }
        if (unsavedChanges) {
          const confirmed = await confirmCloseIfNeeded(() => openCreateNoteForm());
          if (!confirmed) {
            return;
          }
          return;
        }
        openCreateNoteForm();
      });
    }
    noteListEl.addEventListener('click', handleNoteActions);
    searchInput.addEventListener('input', renderNotes);
    filterStatus.addEventListener('change', renderNotes);
    filterPriority.addEventListener('change', renderNotes);
    sortSelect.addEventListener('change', renderNotes);
    dropzone.addEventListener('dragover', handleDragOver);
    dropzone.addEventListener('dragleave', handleDragLeave);
    dropzone.addEventListener('drop', handleDrop);
    dropzone.addEventListener('click', () => fileInput.click());
    fileListEl.addEventListener('click', handleFileActions);
    fileInput.addEventListener('change', handleFileInput);
    if (clientForm) {
      clientForm.addEventListener('submit', handleClientSubmit);
      clientForm.addEventListener('reset', () => {
        const nameField = clientForm.querySelector('[name="name"]');
        if (nameField) nameField.focus();
      });
    }
    if (clientsList) {
      clientsList.addEventListener('click', handleClientActions);
    }
    if (productForm) {
      productForm.addEventListener('submit', handleProductSubmit);
      productForm.addEventListener('reset', () => {
        const nameField = productForm.querySelector('[name="name"]');
        if (nameField) nameField.focus();
      });
    }
    if (productsList) {
      productsList.addEventListener('click', handleProductActions);
    }
    if (aiForm) {
      aiForm.addEventListener('submit', handleAiSubmit);
      aiForm.addEventListener('reset', () => {
        const nameField = aiForm.querySelector('[name="name"]');
        if (nameField) {
          nameField.focus();
        }
      });
    }
    if (aiList) {
      aiList.addEventListener('click', handleAiActions);
    }
    if (aiFloatingActions) {
      aiFloatingActions.addEventListener('click', handleAiFloatingActions);
    }
    document.addEventListener('keydown', handleShortcuts);
    modal.addEventListener('click', handleModalClick);
    themeToggleBtn.addEventListener('click', toggleTheme);
    document.querySelector('.logo-button').addEventListener('click', () => {
      renderTimeline();
      renderProductsList();
      renderClientsList();
      renderAiBotsList();
      if (activeMonth) {
        openMonth(activeMonth, true);
      }
      createToast('Interfejs odświeżony', 'info');
    });
  }

  function renderTimeline() {
    monthsList.innerHTML = '';
    monthRange.forEach((month, index) => {
      const monthData = appState.months[month];
      const li = document.createElement('li');
      li.className = 'timeline-item';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.month = month;
      btn.setAttribute('aria-controls', 'month-panel');
      btn.setAttribute('aria-expanded', month === activeMonth ? 'true' : 'false');
      btn.setAttribute('aria-pressed', month === activeMonth);
      if (month === activeMonth) {
        btn.classList.add('active');
      }
      const label = document.createElement('span');
      label.className = 'month-label';
      label.textContent = formatMonthLabel(month);
      const subtitle = document.createElement('span');
      subtitle.className = 'month-subtitle';
      subtitle.textContent = notesSummaryLabel(monthData?.notes);
      const progressWrapper = document.createElement('div');
      progressWrapper.className = 'progress-bar';
      const progressInner = document.createElement('span');
      progressInner.style.width = `${calculateProgress(monthData.notes)}%`;
      progressInner.title = progressTooltip(monthData.notes);
      progressWrapper.appendChild(progressInner);
      btn.appendChild(label);
      btn.appendChild(subtitle);
      btn.appendChild(progressWrapper);
      li.appendChild(btn);
      monthsList.appendChild(li);
    });
  }

  function formatMonthLabel(key) {
    const [year, month] = key.split('-').map(Number);
    const formatter = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' });
    return formatter.format(new Date(year, month - 1, 1)).replace(/^(.)/, (m) => m.toUpperCase());
  }

  function calculateProgress(notes) {
    if (!notes || notes.length === 0) return 0;
    const green = notes.filter((note) => note.status === 'green').length;
    return Math.round((green / notes.length) * 100);
  }

  function progressTooltip(notes) {
    if (!notes || notes.length === 0) return 'Brak zadań';
    const green = notes.filter((note) => note.status === 'green').length;
    const pending = notes.length - green;
    const percent = calculateProgress(notes);
    return `${percent}% gotowe (Wykonane: ${green} | Niewykonane: ${pending})`;
  }

  function notesSummaryLabel(notes) {
    if (!notes || notes.length === 0) {
      return 'Brak zadań';
    }
    const total = notes.length;
    const done = notes.filter((note) => note.status === 'green').length;
    const pending = total - done;
    return `Zadania: ${total} | Wykonane: ${done} | Niewykonane: ${pending}`;
  }

  function renderClientsList() {
    if (!clientsList) return;
    const clients = Array.isArray(appState?.clients) ? appState.clients : [];
    if (clientsEmpty) {
      clientsEmpty.hidden = clients.length > 0;
    }
    if (clients.length === 0) {
      clientsList.innerHTML = '';
      return;
    }
    clientsList.innerHTML = clients
      .map((client) => {
        const tooltip = client.updatedAt
          ? `Ostatnia aktualizacja: ${formatDate(client.updatedAt)}`
          : '';
        const notes = client.notes
          ? `<p class="client-notes">${escapeHtml(client.notes).replace(/\n/g, '<br>')}</p>`
          : '';
        return `
          <tr data-id="${client.id}"${tooltip ? ` title="${escapeHtml(tooltip)}"` : ''}>
            <td>
              <div class="client-name">${escapeHtml(client.name)}</div>
              ${notes}
            </td>
            <td>${client.industry ? escapeHtml(client.industry) : '—'}</td>
            <td>${client.owner ? escapeHtml(client.owner) : '—'}</td>
            <td>${client.contact ? escapeHtml(client.contact) : '—'}</td>
            <td><span class="${getClientStatusClass(client.status)}">${formatClientStatus(client.status)}</span></td>
            <td class="col-actions">
              <button type="button" class="btn btn-secondary btn-compact" data-action="remove-client" data-id="${client.id}">Usuń</button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function renderProductsList() {
    if (!productsList) return;
    const products = Array.isArray(appState?.products) ? appState.products : [];
    const validIds = new Set(products.map((product) => product.id));
    Array.from(openProductIds).forEach((id) => {
      if (!validIds.has(id)) {
        openProductIds.delete(id);
      }
    });
    productsList.innerHTML = '';
    if (productsEmpty) {
      productsEmpty.hidden = products.length > 0;
    }
    if (products.length === 0) {
      return;
    }
    products
      .slice()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
      .forEach((product) => {
        const description = product.description
          ? `<p>${escapeHtml(product.description).replace(/\n/g, '<br>')}</p>`
          : '<p class="product-description placeholder">Brak opisu produktu</p>';
        const safeLink = sanitizeUrl(product.link);
        const linkMarkup = safeLink
          ? `<a href="${safeLink}" class="product-link" target="_blank" rel="noopener noreferrer">Materiały (${escapeHtml(
              formatProductLinkLabel(safeLink),
            )})</a>`
          : '<span class="product-link product-link--empty">Brak linku</span>';
        const item = document.createElement('li');
        item.className = 'product-item';
        item.dataset.id = product.id;
        const detailsId = `product-details-${product.id}`;
        const isOpen = openProductIds.has(product.id);
        const thumbnail = product.image
          ? `<img src="${product.image}" alt="Podgląd ${escapeHtml(product.name)}" loading="lazy" />`
          : `<span class="product-thumb__placeholder" aria-hidden="true">${escapeHtml(getProductInitial(product.name))}</span>`;
        item.innerHTML = `
          <article class="product-card${isOpen ? ' is-open' : ''}" aria-labelledby="${detailsId}-label">
            <button type="button" class="product-summary" data-action="toggle-product" data-id="${product.id}" aria-expanded="${isOpen}" aria-controls="${detailsId}">
              <span class="product-thumb">${thumbnail}</span>
              <span class="product-title" id="${detailsId}-label">${escapeHtml(product.name)}</span>
              <span class="product-toggle-indicator" aria-hidden="true"></span>
            </button>
            <div class="product-details" id="${detailsId}" ${isOpen ? '' : 'hidden'}>
              ${description}
              <div class="product-meta">
                ${linkMarkup}
                <small>Aktualizacja: ${formatDate(product.updatedAt || product.createdAt)}</small>
              </div>
              <div class="product-actions">
                <button type="button" class="btn btn-secondary btn-compact" data-action="remove-product" data-id="${product.id}">Usuń</button>
              </div>
            </div>
          </article>
        `;
        productsList.appendChild(item);
      });
  }

  function renderAiBotsList() {
    const bots = Array.isArray(appState?.aiBots) ? appState.aiBots : [];
    updateAiMetrics(bots);
    if (!aiList) {
      if (aiEmpty) {
        aiEmpty.hidden = bots.length > 0;
      }
      return;
    }
    if (aiEmpty) {
      aiEmpty.hidden = bots.length > 0;
    }
    aiList.innerHTML = '';
    if (bots.length === 0) {
      return;
    }
    bots
      .slice()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
      .forEach((bot) => {
        const item = document.createElement('li');
        item.className = 'ai-item';
        item.dataset.id = bot.id;
        const statusClass = getAiStatusClass(bot.status);
        const statusLabel = formatAiStatus(bot.status);
        const goal = bot.goal ? escapeHtml(bot.goal).replace(/\n/g, '<br>') : 'Brak przypisanego celu';
        const channel = bot.channel ? escapeHtml(bot.channel) : '—';
        const cadence = bot.cadence ? escapeHtml(bot.cadence) : '—';
        const notes = bot.notes ? `<p class="ai-card__notes">${escapeHtml(bot.notes).replace(/\n/g, '<br>')}</p>` : '';
        const headingId = `ai-bot-${bot.id}`;
        item.innerHTML = `
          <article class="ai-card" aria-labelledby="${headingId}">
            <div class="ai-card__header">
              <span class="ai-card__name" id="${headingId}">${escapeHtml(bot.name)}</span>
              <span class="${statusClass}">${statusLabel}</span>
            </div>
            <p class="ai-card__goal">${goal}</p>
            <div class="ai-card__meta">
              <div>
                <span class="ai-card__meta-label">Kanał</span>
                <span class="ai-card__meta-value">${channel}</span>
              </div>
              <div>
                <span class="ai-card__meta-label">Częstotliwość</span>
                <span class="ai-card__meta-value">${cadence}</span>
              </div>
              <div>
                <span class="ai-card__meta-label">Aktualizacja</span>
                <span class="ai-card__meta-value">${formatDate(bot.updatedAt || bot.createdAt)}</span>
              </div>
            </div>
            ${notes}
            <div class="ai-card__footer">
              <button type="button" class="btn btn-secondary btn-compact" data-action="remove-ai" data-id="${bot.id}">Usuń</button>
            </div>
          </article>
        `;
        aiList.appendChild(item);
      });
  }

  function updateAiMetrics(bots) {
    if (!aiMetricActive || !aiMetricTraining || !aiMetricQueued) return;
    const active = bots.filter((bot) => bot.status === 'active').length;
    const training = bots.filter((bot) => bot.status === 'training').length;
    const queued = bots.filter((bot) => bot.status === 'paused').length;
    aiMetricActive.textContent = String(active);
    aiMetricTraining.textContent = String(training);
    aiMetricQueued.textContent = String(queued);
  }

  function updatePanelMetrics(month) {
    if (!panelSubtitle || !notesMetric || !filesMetric || !progressMetric) return;
    const monthData = appState.months[month];
    if (!monthData) return;
    const notes = monthData.notes || [];
    const files = monthData.files || [];
    const percent = calculateProgress(notes);
    const tooltip = progressTooltip(notes);
    panelSubtitle.textContent = notes.length
      ? `Postęp prac: ${percent}% gotowe`
      : 'Brak notatek w tym miesiącu';
    notesMetric.textContent = String(notes.length);
    filesMetric.textContent = String(files.length);
    progressMetric.textContent = `${percent}%`;
    progressMetric.dataset.tooltip = tooltip;
    progressMetric.setAttribute('aria-label', tooltip);
  }

  function resetPanelInsights() {
    if (!panelSubtitle || !notesMetric || !filesMetric || !progressMetric) return;
    panelSubtitle.textContent = defaultPanelSubtitle;
    notesMetric.textContent = '0';
    filesMetric.textContent = '0';
    progressMetric.textContent = '0%';
    delete progressMetric.dataset.tooltip;
    progressMetric.removeAttribute('aria-label');
  }

  function refreshPanelInsights() {
    if (activeMonth) {
      updatePanelMetrics(activeMonth);
    } else {
      resetPanelInsights();
    }
  }

  async function handleMonthClick(event) {
    const button = event.target.closest('button[data-month]');
    if (!button) return;
    const targetMonth = button.dataset.month;
    if (activeMonth === targetMonth) return;
    await confirmCloseIfNeeded(() => openMonth(targetMonth));
  }

  function openMonth(month, skipFocus = false) {
    activeMonth = month;
    closeClientsPanel({ suppressMenu: true });
    closeProductsPanel({ suppressMenu: true });
    closeAiPanel({ suppressMenu: true });
    showScrim(panelScrim);
    panel.classList.add('open');
    panel.removeAttribute('aria-hidden');
    panelTitle.textContent = formatMonthLabel(month);
    appState.ui.lastOpenedMonth = month;
    renderNotes();
    renderFiles();
    renderTimeline();
    setMenuActive('timeline');
    scheduleSave();
    unsavedChanges = false;
    collapseNoteForm();
    if (!skipFocus) {
      panel.focus();
    }
  }

  async function closePanel() {
    const proceed = await confirmCloseIfNeeded(() => {
      collapseNoteForm();
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
      hideScrim(panelScrim);
      activeMonth = null;
      appState.ui.lastOpenedMonth = null;
      renderTimeline();
      setMenuActive('timeline');
      scheduleSave();
      resetPanelInsights();
    });
    return proceed;
  }

  async function handleMenuClick(event) {
    const button = event.target.closest('[data-menu]');
    if (!button) return;
    const target = button.dataset.menu;
    if (target === 'clients') {
      if (clientsPanelOpen) {
        focusMenuButton('clients');
        return;
      }
      if (activeMonth) {
        const closed = await closePanel();
        if (!closed) {
          setMenuActive('timeline');
          return;
        }
      }
      closeProductsPanel({ suppressMenu: true });
      openClientsPanel();
    } else if (target === 'products') {
      if (productsPanelOpen) {
        focusMenuButton('products');
        return;
      }
      if (activeMonth) {
        const closed = await closePanel();
        if (!closed) {
          setMenuActive('timeline');
          return;
        }
      }
      closeClientsPanel({ suppressMenu: true });
      openProductsPanel();
    } else if (target === 'ai') {
      if (aiPanelOpen) {
        focusMenuButton('ai');
        return;
      }
      if (activeMonth) {
        const closed = await closePanel();
        if (!closed) {
          setMenuActive('timeline');
          return;
        }
      }
      closeClientsPanel({ suppressMenu: true });
      closeProductsPanel({ suppressMenu: true });
      openAiPanel();
    } else if (target === 'timeline') {
      setMenuActive('timeline');
      closeClientsPanel({ suppressMenu: true, focusMenuKey: 'timeline' });
      closeProductsPanel({ suppressMenu: true, focusMenuKey: 'timeline' });
      closeAiPanel({ suppressMenu: true, focusMenuKey: 'timeline' });
    }
  }

  function setMenuActive(key) {
    if (!appMenu) return;
    appMenu.querySelectorAll('.menu-link').forEach((link) => {
      const isActive = link.dataset.menu === key;
      link.classList.toggle('is-active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function openClientsPanel() {
    if (!clientsPanel) return;
    closeAiPanel({ suppressMenu: true });
    setMenuActive('clients');
    showScrim(clientsScrim);
    clientsPanel.classList.add('open');
    clientsPanel.removeAttribute('aria-hidden');
    clientsPanelOpen = true;
    renderClientsList();
    if (clientForm) {
      clientForm.reset();
      const nameField = clientForm.querySelector('[name="name"]');
      if (nameField) {
        nameField.focus();
      }
    }
  }

  function closeClientsPanel(options = {}) {
    const { suppressMenu = false, focusMenuKey } = options;
    if (!clientsPanelOpen || !clientsPanel) {
      if (!suppressMenu) {
        setMenuActive('timeline');
      }
      if (focusMenuKey) {
        focusMenuButton(focusMenuKey);
      }
      return;
    }
    clientsPanel.classList.remove('open');
    clientsPanel.setAttribute('aria-hidden', 'true');
    hideScrim(clientsScrim);
    clientsPanelOpen = false;
    if (!suppressMenu) {
      setMenuActive('timeline');
    }
    if (focusMenuKey) {
      focusMenuButton(focusMenuKey);
    }
  }

  function openProductsPanel() {
    if (!productsPanel) return;
    closeAiPanel({ suppressMenu: true });
    setMenuActive('products');
    showScrim(productsScrim);
    productsPanel.classList.add('open');
    productsPanel.removeAttribute('aria-hidden');
    productsPanelOpen = true;
    renderProductsList();
    if (productForm) {
      productForm.reset();
      const nameField = productForm.querySelector('[name="name"]');
      if (nameField) {
        nameField.focus();
      }
    }
  }

  function closeProductsPanel(options = {}) {
    const { suppressMenu = false, focusMenuKey } = options;
    if (!productsPanelOpen || !productsPanel) {
      if (!suppressMenu) {
        setMenuActive('timeline');
      }
      if (focusMenuKey) {
        focusMenuButton(focusMenuKey);
      }
      return;
    }
    productsPanel.classList.remove('open');
    productsPanel.setAttribute('aria-hidden', 'true');
    hideScrim(productsScrim);
    productsPanelOpen = false;
    if (!suppressMenu) {
      setMenuActive('timeline');
    }
    if (focusMenuKey) {
      focusMenuButton(focusMenuKey);
    }
  }

  function openAiPanel() {
    if (!aiPanel) return;
    closeClientsPanel({ suppressMenu: true });
    closeProductsPanel({ suppressMenu: true });
    setMenuActive('ai');
    showScrim(aiScrim);
    aiPanel.classList.add('open');
    aiPanel.removeAttribute('aria-hidden');
    aiPanelOpen = true;
    renderAiBotsList();
    if (aiForm) {
      aiForm.reset();
      const nameField = aiForm.querySelector('[name="name"]');
      if (nameField) {
        nameField.focus();
      }
    }
  }

  function closeAiPanel(options = {}) {
    const { suppressMenu = false, focusMenuKey } = options;
    if (!aiPanelOpen || !aiPanel) {
      if (!suppressMenu) {
        setMenuActive('timeline');
      }
      if (focusMenuKey) {
        focusMenuButton(focusMenuKey);
      }
      return;
    }
    aiPanel.classList.remove('open');
    aiPanel.setAttribute('aria-hidden', 'true');
    hideScrim(aiScrim);
    aiPanelOpen = false;
    if (!suppressMenu) {
      setMenuActive('timeline');
    }
    if (focusMenuKey) {
      focusMenuButton(focusMenuKey);
    }
  }

  function focusMenuButton(key) {
    if (!appMenu) return;
    const button = appMenu.querySelector(`[data-menu="${key}"]`);
    if (button) {
      button.focus();
    }
  }

  function handleClientSubmit(event) {
    event.preventDefault();
    if (!clientForm) return;
    const formData = new FormData(clientForm);
    const name = (formData.get('name') || '').toString().trim();
    if (!name) {
      createToast('Nazwa klienta jest wymagana', 'error');
      const nameField = clientForm.querySelector('[name="name"]');
      if (nameField) {
        nameField.focus();
      }
      return;
    }
    const now = new Date().toISOString();
    const payload = normalizeClient({
      name,
      industry: (formData.get('industry') || '').toString().trim(),
      owner: (formData.get('owner') || '').toString().trim(),
      contact: (formData.get('contact') || '').toString().trim(),
      status: (formData.get('status') || 'prospect').toString(),
      notes: (formData.get('notes') || '').toString().trim(),
      createdAt: now,
      updatedAt: now,
    });
    appState.clients.push(payload);
    clientForm.reset();
    renderClientsList();
    scheduleSave();
    createToast('Dodano klienta do listy', 'success');
  }

  function handleClientActions(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'remove-client' && id) {
      removeClient(id);
    }
  }

  function removeClient(id) {
    if (!id) return;
    const index = appState.clients.findIndex((client) => client.id === id);
    if (index === -1) return;
    appState.clients.splice(index, 1);
    renderClientsList();
    scheduleSave();
    createToast('Klient został usunięty', 'info');
  }

  async function handleProductSubmit(event) {
    event.preventDefault();
    if (!productForm) return;
    const formData = new FormData(productForm);
    const name = (formData.get('name') || '').toString().trim();
    if (!name) {
      createToast('Nazwa produktu jest wymagana', 'error');
      const nameField = productForm.querySelector('[name="name"]');
      if (nameField) {
        nameField.focus();
      }
      return;
    }
    const description = (formData.get('description') || '').toString().trim();
    const rawLink = (formData.get('link') || '').toString().trim();
    const safeLink = sanitizeUrl(rawLink);
    if (!safeLink && rawLink) {
      createToast('Podano nieprawidłowy link – pominięto', 'warning');
    }
    const imageFile = formData.get('image');
    let imageData = '';
    if (imageFile instanceof File && imageFile.size > 0) {
      if (imageFile.size > MAX_PRODUCT_IMAGE_SIZE) {
        createToast('Zdjęcie produktu jest zbyt duże (maks. 5 MB)', 'error');
        return;
      }
      if (imageFile.type && !imageFile.type.startsWith('image/')) {
        createToast('Można przesyłać wyłącznie pliki graficzne', 'error');
        return;
      }
      try {
        imageData = await readFileAsDataURL(imageFile);
      } catch (err) {
        console.error('Błąd odczytu zdjęcia produktu', err);
        createToast('Nie udało się wczytać zdjęcia produktu', 'error');
        return;
      }
      if (typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
        createToast('Nie udało się zweryfikować formatu zdjęcia', 'error');
        return;
      }
    }
    const now = new Date().toISOString();
    const payload = normalizeProduct({
      name,
      description,
      link: safeLink,
      image: imageData,
      createdAt: now,
      updatedAt: now,
    });
    appState.products.push(payload);
    productForm.reset();
    const nameField = productForm.querySelector('[name="name"]');
    if (nameField) {
      nameField.focus();
    }
    if (payload.id) {
      openProductIds.add(payload.id);
    }
    renderProductsList();
    scheduleSave();
    createToast('Dodano produkt do katalogu', 'success');
  }

  function handleProductActions(event) {
    const toggleButton = event.target.closest('button[data-action="toggle-product"]');
    if (toggleButton) {
      event.preventDefault();
      toggleProductDetails(toggleButton.dataset.id);
      return;
    }
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'remove-product' && id) {
      removeProduct(id);
    }
  }

  function toggleProductDetails(id) {
    if (!id || !productsList) return;
    const item = productsList.querySelector(`.product-item[data-id="${escapeSelector(id)}"]`);
    if (!item) return;
    const isOpen = openProductIds.has(id);
    if (isOpen) {
      openProductIds.delete(id);
    } else {
      openProductIds.add(id);
    }
    const card = item.querySelector('.product-card');
    if (card) {
      card.classList.toggle('is-open', !isOpen);
    }
    const details = item.querySelector('.product-details');
    if (details) {
      details.hidden = isOpen;
    }
    const summary = item.querySelector('.product-summary');
    if (summary) {
      summary.setAttribute('aria-expanded', String(!isOpen));
    }
  }

  function escapeSelector(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
  }

  function removeProduct(id) {
    if (!id) return;
    const index = appState.products.findIndex((product) => product.id === id);
    if (index === -1) return;
    appState.products.splice(index, 1);
    openProductIds.delete(id);
    renderProductsList();
    scheduleSave();
    createToast('Produkt usunięty z katalogu', 'info');
  }

  function handleAiSubmit(event) {
    event.preventDefault();
    if (!aiForm) return;
    const formData = new FormData(aiForm);
    const name = (formData.get('name') || '').toString().trim();
    if (!name) {
      createToast('Nazwa bota jest wymagana', 'error');
      const nameField = aiForm.querySelector('[name="name"]');
      if (nameField) {
        nameField.focus();
      }
      return;
    }
    const now = new Date().toISOString();
    const payload = normalizeAiBot({
      name,
      channel: (formData.get('channel') || '').toString().trim(),
      cadence: (formData.get('cadence') || '').toString().trim(),
      status: (formData.get('status') || 'training').toString(),
      goal: (formData.get('goal') || '').toString().trim(),
      notes: (formData.get('notes') || '').toString().trim(),
      createdAt: now,
      updatedAt: now,
    });
    appState.aiBots.push(payload);
    aiForm.reset();
    const nameField = aiForm.querySelector('[name="name"]');
    if (nameField) {
      nameField.focus();
    }
    renderAiBotsList();
    scheduleSave();
    createToast('Dodano bota AI', 'success');
  }

  function handleAiActions(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'remove-ai' && id) {
      removeAiBot(id);
    }
  }

  function removeAiBot(id) {
    if (!id) return;
    const index = appState.aiBots.findIndex((bot) => bot.id === id);
    if (index === -1) return;
    appState.aiBots.splice(index, 1);
    renderAiBotsList();
    scheduleSave();
    createToast('Bot został usunięty', 'info');
  }

  function handleAiFloatingActions(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'ai-focus-form') {
      if (aiForm) {
        const nameField = aiForm.querySelector('[name="name"]');
        if (nameField) {
          nameField.focus();
        }
      }
    } else if (action === 'ai-manage') {
      createToast('Panel zarządzania botami w przygotowaniu', 'info');
    }
  }

  function handleNoteSubmit(event) {
    event.preventDefault();
    if (!activeMonth) return;
    const formData = new FormData(noteForm);
    const title = formData.get('title').trim();
    if (!title) {
      createToast('Tytuł jest wymagany', 'error');
      noteForm.elements.title.focus();
      return;
    }
    const id = formData.get('noteId');
    const content = formData.get('content').trim();
    const priority = formData.get('priority');
    const status = formData.get('status');
    const now = new Date().toISOString();
    const notes = appState.months[activeMonth].notes;

    if (id) {
      const note = notes.find((n) => n.id === id);
      if (!note) return;
      Object.assign(note, {
        title,
        content,
        priority,
        status,
        updatedAt: now,
      });
      createToast('Notatka zaktualizowana', 'success');
    } else {
      notes.push({
        id: crypto.randomUUID(),
        title,
        content,
        status,
        priority,
        checked: false,
        createdAt: now,
        updatedAt: now,
      });
      createToast('Dodano notatkę', 'success');
    }
    renderNotes();
    renderTimeline();
    collapseNoteForm();
    scheduleSave();
  }

  async function handleNoteActions(event) {
    const item = event.target.closest('.note-item');
    if (!item) return;
    const noteId = item.dataset.id;
    const notes = appState.months[activeMonth].notes;
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    if (event.target.matches('input[type="checkbox"]')) {
      note.checked = event.target.checked;
      note.updatedAt = new Date().toISOString();
      scheduleSave();
      renderTimeline();
      refreshPanelInsights();
      return;
    }

    const actionBtn = event.target.closest('button[data-action]');
    if (!actionBtn) return;
    const action = actionBtn.dataset.action;
    if (action === 'edit-note') {
      if (unsavedChanges) {
        const confirmed = await confirmCloseIfNeeded(() => fillNoteForm(note));
        if (!confirmed) {
          return;
        }
        return;
      }
      fillNoteForm(note);
    } else if (action === 'delete-note') {
      if (confirm('Usunąć notatkę?')) {
        const idx = notes.findIndex((n) => n.id === noteId);
        notes.splice(idx, 1);
        renderNotes();
        renderTimeline();
        scheduleSave();
        createToast('Notatka usunięta', 'info');
      }
    }
  }

  function openCreateNoteForm() {
    resetNoteForm();
    noteForm.hidden = false;
    noteForm.dataset.mode = 'create';
    toggleNoteFormPlaceholder(false);
    updateNewNoteButtonExpanded(true);
    const titleField = noteForm.elements.title;
    if (titleField) {
      titleField.focus();
    }
  }

  function handleNoteCancel() {
    collapseNoteForm({ focusButton: true });
  }

  function collapseNoteForm({ focusButton = false } = {}) {
    resetNoteForm();
    noteForm.hidden = true;
    noteForm.removeAttribute('data-mode');
    toggleNoteFormPlaceholder(true);
    updateNewNoteButtonExpanded(false);
    if (focusButton && newNoteButton) {
      newNoteButton.focus();
    }
  }

  function toggleNoteFormPlaceholder(show) {
    if (!noteFormPlaceholder) return;
    noteFormPlaceholder.hidden = !show;
  }

  function updateNewNoteButtonExpanded(expanded) {
    if (!newNoteButton) return;
    newNoteButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function fillNoteForm(note) {
    noteForm.hidden = false;
    noteForm.dataset.mode = 'edit';
    toggleNoteFormPlaceholder(false);
    updateNewNoteButtonExpanded(true);
    noteForm.elements.noteId.value = note.id;
    noteForm.elements.title.value = note.title;
    noteForm.elements.content.value = note.content;
    noteForm.elements.priority.value = note.priority;
    noteForm.elements.status.value = note.status;
    setStatusButtons(note.status);
    noteForm.elements.title.focus();
    unsavedChanges = false;
  }

  function resetNoteForm() {
    noteForm.reset();
    noteForm.elements.noteId.value = '';
    noteForm.elements.status.value = 'red';
    setStatusButtons('red');
    unsavedChanges = false;
  }

  function setNoteStatus(status) {
    noteForm.elements.status.value = status;
    setStatusButtons(status);
  }

  function setStatusButtons(status) {
    noteForm.querySelectorAll('.status-btn').forEach((btn) => {
      btn.dataset.active = btn.dataset.status === status ? 'true' : 'false';
    });
  }

  function renderNotes() {
    if (!activeMonth) {
      noteListEl.innerHTML = '';
      resetPanelInsights();
      return;
    }
    const notes = [...appState.months[activeMonth].notes];
    const query = searchInput.value.trim().toLowerCase();
    const statusFilter = filterStatus.value;
    const priorityFilter = filterPriority.value;
    const sortValue = sortSelect.value;

    const filtered = notes.filter((note) => {
      const matchesQuery = !query || note.title.toLowerCase().includes(query) || note.content.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || note.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || note.priority === priorityFilter;
      return matchesQuery && matchesStatus && matchesPriority;
    });

    const [sortField, sortDirection] = sortValue.split('-');
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'title' || sortField === 'status') {
        comparison = a[sortField].localeCompare(b[sortField]);
      } else {
        comparison = new Date(a[sortField]) - new Date(b[sortField]);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    noteListEl.innerHTML = '';
    filtered.forEach((note) => {
      const li = document.createElement('li');
      li.className = 'note-item';
      li.dataset.id = note.id;
      li.innerHTML = `
        <div class="note-meta">
          <div>
            <strong>${escapeHtml(note.title)}</strong>
            <span class="badge badge-${note.priority}">${translatePriority(note.priority)}</span>
          </div>
          <div class="note-actions">
            <input type="checkbox" ${note.checked ? 'checked' : ''} aria-label="Zakończone" />
            <button class="btn btn-secondary" data-action="edit-note">Edytuj</button>
            <button class="btn btn-secondary" data-action="delete-note">Usuń</button>
          </div>
        </div>
        <div class="note-content">${escapeHtml(note.content)}</div>
        <div class="note-footer">
          <small>Status: ${translateStatus(note.status)}</small>
        </div>
      `;
      li.title = `Utworzono: ${formatDate(note.createdAt)}\nAktualizacja: ${formatDate(note.updatedAt)}`;
      noteListEl.appendChild(li);
    });
    refreshPanelInsights();
  }

  function translatePriority(priority) {
    switch (priority) {
      case 'low':
        return 'Niski';
      case 'medium':
        return 'Średni';
      case 'high':
        return 'Wysoki';
      default:
        return priority;
    }
  }

  function translateStatus(status) {
    switch (status) {
      case 'green':
        return 'Gotowa';
      case 'orange':
        return 'W trakcie';
      case 'red':
        return 'Niezrealizowane';
      default:
        return status;
    }
  }

  function renderFiles() {
    if (!activeMonth) {
      fileListEl.innerHTML = '';
      resetPanelInsights();
      return;
    }
    fileListEl.innerHTML = '';
    const files = appState.months[activeMonth].files || [];
    files.forEach((file) => {
      const li = document.createElement('li');
      li.className = 'file-item';
      li.dataset.id = file.id;
      li.innerHTML = `
        <div class="file-meta">
          <div>
            <strong>${escapeHtml(file.name)}</strong>
            <small>${formatBytes(file.size)} • ${file.type || 'Nieznany'}</small>
          </div>
          <div class="file-actions">
            <button class="btn btn-secondary" data-action="download-file">Pobierz</button>
            <button class="btn btn-secondary" data-action="remove-file">Usuń</button>
          </div>
        </div>
        <small>Dodano: ${formatDate(file.addedAt)}</small>
      `;
      fileListEl.appendChild(li);
    });
    refreshPanelInsights();
  }

  function handleDragOver(event) {
    event.preventDefault();
    dropzone.classList.add('dragover');
  }

  function handleDragLeave(event) {
    event.preventDefault();
    dropzone.classList.remove('dragover');
  }

  function handleDrop(event) {
    event.preventDefault();
    dropzone.classList.remove('dragover');
    if (!event.dataTransfer.files.length) return;
    processFiles(event.dataTransfer.files);
  }

  function handleFileInput(event) {
    if (!event.target.files.length) return;
    processFiles(event.target.files);
    event.target.value = '';
  }

  function handleFileActions(event) {
    const item = event.target.closest('.file-item');
    if (!item) return;
    const fileId = item.dataset.id;
    const files = appState.months[activeMonth].files;
    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    const action = event.target.closest('button')?.dataset.action;
    if (!action) return;
    if (action === 'remove-file') {
      if (confirm('Usunąć plik?')) {
        const idx = files.findIndex((f) => f.id === fileId);
        files.splice(idx, 1);
        window.metcorDB.removeFile(fileId);
        renderFiles();
        scheduleSave();
        createToast('Plik usunięty', 'info');
      }
    } else if (action === 'download-file') {
      downloadFile(fileId, file);
    }
  }

  async function downloadFile(fileId, fileMeta) {
    try {
      const files = await window.metcorDB.getFilesByMonth(activeMonth);
      const record = files.find((f) => f.id === fileId);
      if (!record) throw new Error('Brak danych pliku');
      let blob;
      if (typeof record.data === 'string') {
        blob = dataURLtoBlob(record.data);
      } else {
        blob = record.data;
      }
      triggerDownload(blob, fileMeta.safeName);
      createToast('Pobieranie rozpoczęte', 'success');
    } catch (err) {
      console.error(err);
      createToast('Błąd pobierania pliku', 'error');
    }
  }

  function processFiles(fileList) {
    if (!activeMonth) {
      createToast('Wybierz miesiąc aby dodać pliki', 'warning');
      return;
    }
    Array.from(fileList).forEach(async (file) => {
      if (file.size > 25 * 1024 * 1024) {
        createToast(`Plik ${file.name} przekracza limit 25 MB`, 'error');
        return;
      }
      const safeName = sanitizeFileName(file.name);
      const record = {
        id: crypto.randomUUID(),
        name: file.name,
        safeName,
        size: file.size,
        type: file.type,
        month: activeMonth,
        data: file,
        addedAt: new Date().toISOString(),
      };
      appState.months[activeMonth].files.push({ ...record, data: null });
      await window.metcorDB.addFile(record);
      renderFiles();
      scheduleSave();
      createToast(`Dodano plik ${file.name}`, 'success');
    });
  }

  function sanitizeFileName(name) {
    return name.replace(/[^a-z0-9\-_.]+/gi, '_');
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char]);
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  function formatDate(date) {
    if (!date) return '—';
    return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
  }

  function sanitizeUrl(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url, window.location.origin);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return '';
      }
      return parsed.href;
    } catch (err) {
      return '';
    }
  }

  function getProductInitial(name) {
    const text = (name || '').trim();
    if (!text) return 'P';
    const char = text.charAt(0).toUpperCase();
    return /[A-ZĄĆĘŁŃÓŚŹŻ0-9]/i.test(char) ? char : 'P';
  }

  function formatProductLinkLabel(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch (err) {
      return url;
    }
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Błąd odczytu pliku'));
      reader.readAsDataURL(file);
    });
  }

  function normalizeClient(client) {
    if (!client || typeof client !== 'object') return null;
    const now = new Date().toISOString();
    const allowedStatuses = new Set(['active', 'prospect', 'on-hold']);
    const normalizedStatus = allowedStatuses.has(client.status) ? client.status : 'prospect';
    return {
      id: client.id || crypto.randomUUID(),
      name: client.name ? String(client.name) : '',
      industry: client.industry ? String(client.industry) : '',
      owner: client.owner ? String(client.owner) : '',
      contact: client.contact ? String(client.contact) : '',
      status: normalizedStatus,
      notes: client.notes ? String(client.notes) : '',
      createdAt: client.createdAt || now,
      updatedAt: client.updatedAt || client.createdAt || now,
    };
  }

  function normalizeProduct(product) {
    if (!product || typeof product !== 'object') return null;
    const now = new Date().toISOString();
    const rawImage = typeof product.image === 'string' ? product.image : '';
    const image = rawImage.startsWith('data:image/') ? rawImage : '';
    return {
      id: product.id || crypto.randomUUID(),
      name: product.name ? String(product.name) : '',
      description: product.description ? String(product.description) : '',
      link: sanitizeUrl(product.link),
      image,
      createdAt: product.createdAt || now,
      updatedAt: product.updatedAt || product.createdAt || now,
    };
  }

  function normalizeAiBot(bot) {
    if (!bot || typeof bot !== 'object') return null;
    const now = new Date().toISOString();
    const allowedStatuses = new Set(['active', 'training', 'paused']);
    const status = allowedStatuses.has(bot.status) ? bot.status : 'training';
    return {
      id: bot.id || crypto.randomUUID(),
      name: bot.name ? String(bot.name) : '',
      channel: bot.channel ? String(bot.channel) : '',
      cadence: bot.cadence ? String(bot.cadence) : '',
      goal: bot.goal ? String(bot.goal) : '',
      status,
      notes: bot.notes ? String(bot.notes) : '',
      createdAt: bot.createdAt || now,
      updatedAt: bot.updatedAt || bot.createdAt || now,
    };
  }

  function formatClientStatus(status) {
    switch (status) {
      case 'active':
        return 'Aktywny';
      case 'prospect':
        return 'Prospekt';
      case 'on-hold':
        return 'Wstrzymany';
      default:
        return 'Prospekt';
    }
  }

  function getClientStatusClass(status) {
    if (status === 'active') return 'client-status client-status--active';
    if (status === 'on-hold') return 'client-status client-status--on-hold';
    return 'client-status client-status--prospect';
  }

  function formatAiStatus(status) {
    switch (status) {
      case 'active':
        return 'Aktywny';
      case 'training':
        return 'Szkolenie';
      case 'paused':
        return 'Wstrzymany';
      default:
        return 'Szkolenie';
    }
  }

  function getAiStatusClass(status) {
    if (status === 'active') return 'ai-status ai-status--active';
    if (status === 'paused') return 'ai-status ai-status--paused';
    return 'ai-status ai-status--training';
  }

  function handleDragLeaveGlobal(event) {
    if (event.target === dropzone) {
      dropzone.classList.remove('dragover');
    }
  }

  // Guard closing panel/month switch when the form has pending edits
  async function confirmCloseIfNeeded(action) {
    if (!unsavedChanges) {
      action();
      return true;
    }
    return new Promise((resolve) => {
      pendingCloseAction = () => {
        unsavedChanges = false;
        action();
        resolve(true);
      };
      modalResolver = resolve;
      modal.hidden = false;
      modal.querySelector('[data-action="confirm-close"]').focus();
    });
  }

  function handleModalClick(event) {
    const action = event.target.closest('button')?.dataset.action;
    if (!action) return;
    if (action === 'confirm-close') {
      modal.hidden = true;
      if (typeof pendingCloseAction === 'function') {
        pendingCloseAction();
        pendingCloseAction = null;
      }
      if (typeof modalResolver === 'function') {
        modalResolver(true);
        modalResolver = null;
      }
    } else if (action === 'cancel-close') {
      modal.hidden = true;
      pendingCloseAction = null;
      if (typeof modalResolver === 'function') {
        modalResolver(false);
        modalResolver = null;
      }
    }
  }

  async function handleShortcuts(event) {
    const target = event.target;
    const tagName = target && target.tagName;
    const isEditable = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';

    if (event.key === 'Escape') {
      if (aiPanelOpen) {
        event.preventDefault();
        closeAiPanel({ focusMenuKey: 'ai' });
        return;
      }
      if (productsPanelOpen) {
        event.preventDefault();
        closeProductsPanel({ focusMenuKey: 'products' });
        return;
      }
      if (clientsPanelOpen) {
        event.preventDefault();
        closeClientsPanel({ focusMenuKey: 'clients' });
        return;
      }
      if (activeMonth) {
        event.preventDefault();
        closePanel();
        return;
      }
    }

    if (!activeMonth) return;
    if (isEditable) return;

    if (event.key === 'n' || event.key === 'N') {
      event.preventDefault();
      if (!noteForm.hidden && noteForm.dataset.mode === 'create') {
        noteForm.elements.title.focus();
        return;
      }
      if (unsavedChanges) {
        await confirmCloseIfNeeded(() => openCreateNoteForm());
      } else {
        openCreateNoteForm();
      }
    } else if (event.key === 'f' || event.key === 'F') {
      event.preventDefault();
      fileInput.click();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      persistState();
      createToast('Stan zapisany', 'success');
    }
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(`theme-${theme}`);
    themeToggleBtn.textContent = theme === 'light' ? 'Tryb ciemny' : 'Tryb jasny';
    themeToggleBtn.setAttribute('aria-pressed', theme === 'dark');
    appState.ui.theme = theme;
    scheduleSave();
  }

  function toggleTheme() {
    const next = appState.ui.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    createToast(`Włączono tryb ${next === 'dark' ? 'ciemny' : 'jasny'}`, 'info');
  }

  function createToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('visible');
    }, 50);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  function dataURLtoBlob(dataUrl) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    requestAnimationFrame(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    });
  }

  function debounce(fn, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function showScrim(scrim) {
    if (!scrim) return;
    scrim.hidden = false;
    requestAnimationFrame(() => {
      scrim.classList.add('visible');
    });
  }

  function hideScrim(scrim) {
    if (!scrim) return;
    const wasVisible = scrim.classList.contains('visible');
    scrim.classList.remove('visible');
    if (!wasVisible) {
      scrim.hidden = true;
      return;
    }
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      scrim.hidden = true;
      return;
    }
    const handleTransitionEnd = () => {
      scrim.hidden = true;
      scrim.removeEventListener('transitionend', handleTransitionEnd);
    };
    scrim.addEventListener('transitionend', handleTransitionEnd, { once: true });
  }

  // Track inline edits for accessibility friendly unsaved-change prompts
  document.addEventListener('input', (event) => {
    if (noteForm.contains(event.target)) {
      unsavedChanges = true;
    }
  });

  document.addEventListener('dragleave', handleDragLeaveGlobal);
})();