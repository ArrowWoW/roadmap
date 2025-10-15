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
  const aiMonthSelect = document.getElementById('ai-month');
  const aiScheduleList = document.getElementById('ai-schedule-list');
  const aiScheduleEmpty = document.getElementById('ai-schedule-empty');
  const kpiRefreshButton = document.querySelector('[data-action="refresh-kpi"]');
  const kpiTotalNotes = document.getElementById('kpi-total-notes');
  const kpiTotalCost = document.getElementById('kpi-total-cost');
  const kpiOverallProgress = document.getElementById('kpi-overall-progress');
  const kpiCompletedNotes = document.getElementById('kpi-completed-notes');
  const kpiTotalFiles = document.getElementById('kpi-total-files');
  const kpiFileCoverage = document.getElementById('kpi-file-coverage');
  const kpiNextDeadline = document.getElementById('kpi-next-deadline');
  const kpiNextDeadlineOwner = document.getElementById('kpi-next-deadline-owner');
  const kpiTrendBody = document.getElementById('kpi-trend-body');
  const kpiUpcomingList = document.getElementById('kpi-upcoming-deadlines');
  const kpiUpcomingEmpty = document.getElementById('kpi-upcoming-empty');
  const clientsSearch = document.getElementById('clients-search');
  const clientsFilterStatus = document.getElementById('clients-filter-status');
  const clientsFilterOwner = document.getElementById('clients-filter-owner');
  const clientsSort = document.getElementById('clients-sort');
  const clientsSegments = document.getElementById('clients-segments');
  const productsSearch = document.getElementById('products-search');
  const productsFilterCategory = document.getElementById('products-filter-category');
  const productsFilterRelease = document.getElementById('products-filter-release');
  const productsFilterOwner = document.getElementById('products-filter-owner');
  const productsSort = document.getElementById('products-sort');
  const historyList = document.getElementById('history-list');
  const historyEmpty = document.getElementById('history-empty');
  const defaultPanelSubtitle = panelSubtitle ? panelSubtitle.textContent : '';
  const clientsEmptyDefault = clientsEmpty ? clientsEmpty.textContent : '';
  const productsEmptyDefault = productsEmpty ? productsEmpty.textContent : '';
  const aiEmptyDefault = aiEmpty ? aiEmpty.textContent : '';
  const historyEmptyDefault = historyEmpty ? historyEmpty.textContent : '';
  const kpiUpcomingEmptyDefault = kpiUpcomingEmpty ? kpiUpcomingEmpty.textContent : '';
  const currencyFormatter = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const shortDateFormatter = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium' });

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
  const HISTORY_LIMIT = 200;

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
    populateAiMonthOptions();
    renderAiBotsList();
    renderHistory();
    bindEvents();
    applyTheme(appState.ui.theme || 'light');
    setMenuActive('timeline');

    if (appState.ui.lastOpenedMonth) {
      openMonth(appState.ui.lastOpenedMonth);
    }
    renderGlobalKpi();
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
      history: Array.isArray(source.history)
        ? source.history.map(normalizeHistoryEntry).filter(Boolean)
        : [],
    };
    for (const month of monthRange) {
      const monthData = monthSeed[month] || { notes: [], files: [] };
      state.months[month] = {
        notes: (monthData.notes || []).map(normalizeNote).filter(Boolean),
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
        state.months[month].notes = (monthData.notes || []).map(normalizeNote).filter(Boolean);
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
    if (stored && Array.isArray(stored.history)) {
      state.history = stored.history.map(normalizeHistoryEntry).filter(Boolean);
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
    if (kpiRefreshButton) {
      kpiRefreshButton.addEventListener('click', () => {
        renderGlobalKpi();
        createToast('Odświeżono wskaźniki kokpitu', 'success');
      });
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
    renderGlobalKpi();
  }

  function formatMonthLabel(key) {
    const [year, month] = key.split('-').map(Number);
    const formatter = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' });
    return formatter.format(new Date(year, month - 1, 1)).replace(/^(.)/, (m) => m.toUpperCase());
  }

  function populateAiMonthOptions() {
    if (!aiMonthSelect) return;
    const current = aiMonthSelect.value;
    aiMonthSelect.innerHTML = '<option value="">Brak przypisania</option>';
    monthRange.forEach((monthKey) => {
      const option = document.createElement('option');
      option.value = monthKey;
      option.textContent = formatMonthLabel(monthKey);
      aiMonthSelect.appendChild(option);
    });
    if (current && monthRange.includes(current)) {
      aiMonthSelect.value = current;
    }
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

  function renderGlobalKpi() {
    if (!kpiTotalNotes || !appState || !appState.months) return;
    let totalNotes = 0;
    let totalCompleted = 0;
    let totalFiles = 0;
    let totalCost = 0;
    let monthsWithFiles = 0;
    const trend = [];
    const upcoming = [];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    monthRange.forEach((monthKey) => {
      const monthData = appState.months[monthKey] || { notes: [], files: [] };
      const notes = Array.isArray(monthData.notes) ? monthData.notes : [];
      const files = Array.isArray(monthData.files) ? monthData.files : [];
      const monthTotal = notes.length;
      const monthCompleted = notes.filter((note) => note.status === 'green').length;
      const monthCost = notes.reduce(
        (acc, note) => acc + (Number.isFinite(note.estimatedCost) ? note.estimatedCost : 0),
        0,
      );
      totalNotes += monthTotal;
      totalCompleted += monthCompleted;
      totalFiles += files.length;
      if (files.length > 0) {
        monthsWithFiles += 1;
      }
      totalCost += monthCost;
      const percent = monthTotal ? Math.round((monthCompleted / monthTotal) * 100) : 0;
      trend.push({ monthKey, monthTotal, monthCompleted, percent, files: files.length });

      notes.forEach((note) => {
        if (!note.dueDate) return;
        const due = parseDueDate(note.dueDate);
        if (!due) return;
        upcoming.push({
          due,
          overdue: due < startOfToday,
          title: note.title,
          responsible: note.responsible,
          monthKey,
        });
      });
    });

    const overallProgress = totalNotes ? Math.round((totalCompleted / totalNotes) * 100) : 0;
    kpiTotalNotes.textContent = String(totalNotes);
    if (kpiTotalCost) {
      kpiTotalCost.innerHTML = `Budżet: ${formatCurrencyValue(totalCost)}`;
    }
    if (kpiOverallProgress) {
      kpiOverallProgress.textContent = `${overallProgress}%`;
    }
    if (kpiCompletedNotes) {
      kpiCompletedNotes.textContent = `${totalCompleted} ukończonych`;
    }
    if (kpiTotalFiles) {
      kpiTotalFiles.textContent = String(totalFiles);
    }
    if (kpiFileCoverage) {
      kpiFileCoverage.textContent = `${monthsWithFiles} miesięcy z plikami`;
    }

    if (kpiTrendBody) {
      kpiTrendBody.innerHTML = '';
      trend.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <th scope="row">${escapeHtml(formatMonthLabel(row.monthKey))}</th>
          <td>${row.monthTotal}</td>
          <td>${row.monthCompleted}</td>
          <td>${row.percent}%</td>
          <td>${row.files}</td>
        `;
        kpiTrendBody.appendChild(tr);
      });
    }

    const sortedUpcoming = upcoming
      .slice()
      .sort((a, b) => a.due - b.due || a.title.localeCompare(b.title || '', 'pl'))
      .slice(0, 5);

    if (sortedUpcoming.length > 0) {
      const next = sortedUpcoming[0];
      if (kpiNextDeadline) {
        kpiNextDeadline.textContent = formatShortDate(next.due);
      }
      if (kpiNextDeadlineOwner) {
        const ownerParts = [formatMonthLabel(next.monthKey)];
        if (next.responsible) {
          ownerParts.push(next.responsible);
        }
        kpiNextDeadlineOwner.textContent = ownerParts.join(' • ');
      }
    } else {
      if (kpiNextDeadline) {
        kpiNextDeadline.textContent = '—';
      }
      if (kpiNextDeadlineOwner) {
        kpiNextDeadlineOwner.textContent = 'Brak przypisania';
      }
    }

    if (kpiUpcomingList) {
      kpiUpcomingList.innerHTML = '';
      sortedUpcoming.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'kpi-upcoming__item';
        if (item.overdue) {
          li.classList.add('is-overdue');
        }
        const description = [];
        if (item.responsible) {
          description.push(`Odpowiedzialny: ${escapeHtml(item.responsible)}`);
        }
        description.push(formatMonthLabel(item.monthKey));
        li.innerHTML = `
          <span>${escapeHtml(item.title || 'Zadanie')}</span>
          <time datetime="${item.due.toISOString().split('T')[0]}">${formatShortDate(item.due)}${
          item.overdue ? ' (po terminie)' : ''
        }</time>
          <small>${description.join(' • ')}</small>
        `;
        kpiUpcomingList.appendChild(li);
      });
      if (kpiUpcomingEmpty) {
        kpiUpcomingEmpty.hidden = sortedUpcoming.length > 0;
      }
      kpiUpcomingList.hidden = sortedUpcoming.length === 0;
    }
    if (kpiUpcomingEmpty && (!kpiUpcomingList || sortedUpcoming.length === 0)) {
      kpiUpcomingEmpty.hidden = false;
    }
  }

  function formatCurrencyValue(value) {
    const safe = Number.isFinite(value) ? value : 0;
    return currencyFormatter.format(Math.max(0, safe));
  }

  function parseDueDate(value) {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    const normalized = typeof value === 'string' ? value : String(value);
    let date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      date = new Date(`${normalized}T00:00:00`);
    }
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatShortDate(date) {
    const parsed = parseDueDate(date);
    if (!parsed) return '—';
    return shortDateFormatter.format(parsed);
  }

  function renderClientsList() {
    if (!clientsList) return;
    const clients = Array.isArray(appState?.clients) ? appState.clients.slice() : [];
    const search = (clientsSearch?.value || '').toString().trim().toLowerCase();
    const statusFilterValue = clientsFilterStatus ? clientsFilterStatus.value : 'all';
    const ownerFilterValue = clientsFilterOwner ? clientsFilterOwner.value : 'all';
    const sortValue = clientsSort ? clientsSort.value : 'updatedAt-desc';

    const owners = Array.from(
      new Set(
        clients
          .map((client) => (client.owner ? String(client.owner).trim() : ''))
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));
    updateClientsOwnerOptions(owners);

    const filtered = clients.filter((client) => {
      const statusMatch = statusFilterValue === 'all' || client.status === statusFilterValue;
      const ownerMatch = ownerFilterValue === 'all' || client.owner === ownerFilterValue;
      const haystack = [client.name, client.industry, client.owner, client.notes, client.contact]
        .map((value) => (value || '').toString().toLowerCase())
        .join(' ');
      const searchMatch = !search || haystack.includes(search);
      return statusMatch && ownerMatch && searchMatch;
    });

    filtered.sort((a, b) => {
      switch (sortValue) {
        case 'name-asc':
          return a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' });
        case 'name-desc':
          return b.name.localeCompare(a.name, 'pl', { sensitivity: 'base' });
        case 'status-asc':
          return formatClientStatus(a.status).localeCompare(formatClientStatus(b.status), 'pl');
        case 'owner-asc':
          return (a.owner || '').localeCompare(b.owner || '', 'pl', { sensitivity: 'base' });
        case 'updatedAt-desc':
        default:
          return (
            new Date(b.updatedAt || b.createdAt || 0).getTime() -
            new Date(a.updatedAt || a.createdAt || 0).getTime()
          );
      }
    });

    if (clientsEmpty) {
      if (clients.length === 0) {
        clientsEmpty.textContent = clientsEmptyDefault;
        clientsEmpty.hidden = false;
      } else if (filtered.length === 0) {
        clientsEmpty.textContent = 'Brak wyników dla zastosowanych filtrów.';
        clientsEmpty.hidden = false;
      } else {
        clientsEmpty.textContent = clientsEmptyDefault;
        clientsEmpty.hidden = true;
      }
    }

    clientsList.innerHTML = filtered
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

    if (clientsSegments) {
      const segments = { active: 0, prospect: 0, 'on-hold': 0 };
      clients.forEach((client) => {
        if (segments[client.status] !== undefined) {
          segments[client.status] += 1;
        }
      });
      clientsSegments.innerHTML = `
        <div class="clients-segment">
          <strong>${clients.length}</strong>
          <span>Wszyscy</span>
        </div>
        <div class="clients-segment">
          <strong>${segments.active}</strong>
          <span>${formatClientStatus('active')}</span>
        </div>
        <div class="clients-segment">
          <strong>${segments.prospect}</strong>
          <span>${formatClientStatus('prospect')}</span>
        </div>
        <div class="clients-segment">
          <strong>${segments['on-hold']}</strong>
          <span>${formatClientStatus('on-hold')}</span>
        </div>
        <div class="clients-segment">
          <strong>${filtered.length}</strong>
          <span>Widok po filtrach</span>
        </div>
      `;
    }
  }

  function updateClientsOwnerOptions(owners) {
    if (!clientsFilterOwner) return;
    const current = clientsFilterOwner.value;
    const existing = Array.from(clientsFilterOwner.options)
      .slice(1)
      .map((option) => option.value);
    const isSame =
      existing.length === owners.length &&
      existing.every((value, index) => value === owners[index]);
    if (isSame) {
      if (owners.includes(current)) {
        clientsFilterOwner.value = current;
      } else {
        clientsFilterOwner.value = 'all';
      }
      return;
    }
    clientsFilterOwner.innerHTML = '<option value="all">Opiekun: wszyscy</option>';
    owners.forEach((owner) => {
      const option = document.createElement('option');
      option.value = owner;
      option.textContent = owner;
      clientsFilterOwner.appendChild(option);
    });
    if (owners.includes(current)) {
      clientsFilterOwner.value = current;
    }
  }

  function updateProductsFilterOptions(categories, owners) {
    if (productsFilterCategory) {
      const current = productsFilterCategory.value;
      const existing = Array.from(productsFilterCategory.options)
        .slice(1)
        .map((option) => option.value);
      const isSame =
        existing.length === categories.length &&
        existing.every((value, index) => value === categories[index]);
      if (!isSame) {
        productsFilterCategory.innerHTML = '<option value="all">Kategoria: wszystkie</option>';
        categories.forEach((category) => {
          const option = document.createElement('option');
          option.value = category;
          option.textContent = category;
          productsFilterCategory.appendChild(option);
        });
      }
      if (categories.includes(current)) {
        productsFilterCategory.value = current;
      } else {
        productsFilterCategory.value = 'all';
      }
    }

    if (productsFilterOwner) {
      const currentOwner = productsFilterOwner.value;
      const existingOwners = Array.from(productsFilterOwner.options)
        .slice(1)
        .map((option) => option.value);
      const sameOwners =
        existingOwners.length === owners.length &&
        existingOwners.every((value, index) => value === owners[index]);
      if (!sameOwners) {
        productsFilterOwner.innerHTML = '<option value="all">Właściciel: wszyscy</option>';
        owners.forEach((owner) => {
          const option = document.createElement('option');
          option.value = owner;
          option.textContent = owner;
          productsFilterOwner.appendChild(option);
        });
      }
      if (owners.includes(currentOwner)) {
        productsFilterOwner.value = currentOwner;
      } else {
        productsFilterOwner.value = 'all';
      }
    }
  }

  function renderProductsList() {
    if (!productsList) return;
    const products = Array.isArray(appState?.products) ? appState.products.slice() : [];
    const validIds = new Set(products.map((product) => product.id));
    Array.from(openProductIds).forEach((id) => {
      if (!validIds.has(id)) {
        openProductIds.delete(id);
      }
    });

    const search = (productsSearch?.value || '').toString().trim().toLowerCase();
    const categoryFilterValue = productsFilterCategory ? productsFilterCategory.value : 'all';
    const releaseFilterValue = productsFilterRelease ? productsFilterRelease.value : 'all';
    const ownerFilterValue = productsFilterOwner ? productsFilterOwner.value : 'all';
    const sortValue = productsSort ? productsSort.value : 'updatedAt-desc';

    const categories = Array.from(
      new Set(products.map((product) => (product.category ? String(product.category).trim() : '')).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));
    const owners = Array.from(
      new Set(products.map((product) => (product.owner ? String(product.owner).trim() : '')).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));
    updateProductsFilterOptions(categories, owners);

    const filtered = products.filter((product) => {
      const categoryMatch = categoryFilterValue === 'all' || product.category === categoryFilterValue;
      const releaseMatch = releaseFilterValue === 'all' || product.release === releaseFilterValue;
      const ownerMatch = ownerFilterValue === 'all' || product.owner === ownerFilterValue;
      const tagsText = Array.isArray(product.tags) ? product.tags.join(' ') : '';
      const haystack = [product.name, product.description, product.category, product.owner, tagsText]
        .map((value) => (value || '').toString().toLowerCase())
        .join(' ');
      const searchMatch = !search || haystack.includes(search);
      return categoryMatch && releaseMatch && ownerMatch && searchMatch;
    });

    filtered.sort((a, b) => {
      switch (sortValue) {
        case 'name-asc':
          return a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' });
        case 'name-desc':
          return b.name.localeCompare(a.name, 'pl', { sensitivity: 'base' });
        case 'category-asc':
          return (a.category || '').localeCompare(b.category || '', 'pl', { sensitivity: 'base' });
        case 'updatedAt-desc':
        default:
          return (
            new Date(b.updatedAt || b.createdAt || 0).getTime() -
            new Date(a.updatedAt || a.createdAt || 0).getTime()
          );
      }
    });

    if (productsEmpty) {
      if (products.length === 0) {
        productsEmpty.textContent = productsEmptyDefault;
        productsEmpty.hidden = false;
      } else if (filtered.length === 0) {
        productsEmpty.textContent = 'Brak wyników dla zastosowanych filtrów.';
        productsEmpty.hidden = false;
      } else {
        productsEmpty.textContent = productsEmptyDefault;
        productsEmpty.hidden = true;
      }
    }

    productsList.innerHTML = '';
    filtered.forEach((product) => {
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
      const chipItems = [];
      if (product.category) {
        chipItems.push(`<span class="product-chip">${escapeHtml(product.category)}</span>`);
      }
      chipItems.push(
        `<span class="product-chip product-chip--release-${product.release}">${formatProductRelease(product.release)}</span>`,
      );
      if (product.owner) {
        chipItems.push(`<span class="product-chip">${escapeHtml(product.owner)}</span>`);
      }
      if (Array.isArray(product.tags)) {
        chipItems.push(...product.tags.map((tag) => `<span class="product-chip">${escapeHtml(tag)}</span>`));
      }
      const tagsSection = chipItems.length ? `<div class="product-tags">${chipItems.join('')}</div>` : '';
      item.innerHTML = `
        <article class="product-card${isOpen ? ' is-open' : ''}" aria-labelledby="${detailsId}-label">
          <button type="button" class="product-summary" data-action="toggle-product" data-id="${product.id}" aria-expanded="${isOpen}" aria-controls="${detailsId}">
            <span class="product-thumb">${thumbnail}</span>
            <span class="product-title" id="${detailsId}-label">${escapeHtml(product.name)}</span>
            <span class="product-toggle-indicator" aria-hidden="true"></span>
          </button>
          <div class="product-details" id="${detailsId}" ${isOpen ? '' : 'hidden'}>
            ${description}
            ${tagsSection}
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
        aiEmpty.textContent = aiEmptyDefault;
        aiEmpty.hidden = bots.length > 0;
      }
      renderAiSchedule();
      return;
    }
    if (aiEmpty) {
      aiEmpty.textContent = aiEmptyDefault;
      aiEmpty.hidden = bots.length > 0;
    }
    aiList.innerHTML = '';
    if (bots.length === 0) {
      renderAiSchedule();
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
        const goal = bot.goal ? escapeHtml(bot.goal).replace(/
/g, '<br>') : 'Brak przypisanego celu';
        const channel = bot.channel ? escapeHtml(bot.channel) : '—';
        const cadence = bot.cadence ? escapeHtml(bot.cadence) : '—';
        const notes = bot.notes ? `<p class="ai-card__notes">${escapeHtml(bot.notes).replace(/
/g, '<br>')}</p>` : '';
        const owner = bot.owner ? escapeHtml(bot.owner) : '—';
        const assignedMonth = bot.assignedMonth ? formatMonthLabel(bot.assignedMonth) : 'Brak przypisania';
        const nextAction = bot.nextAction ? formatShortDate(bot.nextAction) : 'Brak terminu';
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
                <span class="ai-card__meta-label">Opiekun</span>
                <span class="ai-card__meta-value">${owner}</span>
              </div>
            </div>
            <div class="ai-card__timeline">
              <span>Następne działanie: ${nextAction}</span>
              <span>Przypisanie: ${escapeHtml(assignedMonth)}</span>
            </div>
            ${notes}
            <div class="ai-card__footer">
              <button type="button" class="btn btn-secondary btn-compact" data-action="remove-ai" data-id="${bot.id}">Usuń</button>
            </div>
          </article>
        `;
        aiList.appendChild(item);
      });
    renderAiSchedule();
  }

  function renderAiSchedule() {
    if (!aiScheduleList) return;
    const bots = Array.isArray(appState?.aiBots) ? appState.aiBots : [];
    const tasks = [];
    bots.forEach((bot) => {
      if (bot.nextAction) {
        const date = parseDueDate(bot.nextAction);
        if (date) {
          tasks.push({ type: 'next', date, bot });
        }
      }
      if (bot.assignedMonth) {
        const date = parseDueDate(`${bot.assignedMonth}-01`);
        if (date) {
          tasks.push({ type: 'month', date, bot });
        }
      }
    });
    tasks.sort((a, b) => {
      const diff = a.date - b.date;
      if (diff !== 0) return diff;
      if (a.type === b.type) return a.bot.name.localeCompare(b.bot.name, 'pl');
      return a.type === 'next' ? -1 : 1;
    });
    const upcoming = tasks.slice(0, 6);
    aiScheduleList.innerHTML = '';
    if (upcoming.length === 0) {
      if (aiScheduleEmpty) {
        aiScheduleEmpty.hidden = false;
      }
      aiScheduleList.hidden = true;
      return;
    }
    aiScheduleList.hidden = false;
    upcoming.forEach((task) => {
      const li = document.createElement('li');
      li.className = 'ai-schedule__item';
      const label = task.type === 'next' ? 'Najbliższe działanie' : 'Przypisanie miesiąca';
      const monthLabel = task.type === 'month' && task.bot.assignedMonth
        ? formatMonthLabel(task.bot.assignedMonth)
        : '';
      li.innerHTML = `
        <div>
          <strong>${escapeHtml(task.bot.name)}</strong>
          <small>${label}${monthLabel ? ` • ${escapeHtml(monthLabel)}` : ''}</small>
        </div>
        <small>${formatShortDate(task.date)}</small>
      `;
      aiScheduleList.appendChild(li);
    });
    if (aiScheduleEmpty) {
      aiScheduleEmpty.hidden = true;
    }
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
    logHistory({
      type: 'client',
      title: 'Dodano klienta',
      description: `${payload.name} • ${formatClientStatus(payload.status)}`,
      actor: 'Użytkownik',
      meta: { action: 'create', clientId: payload.id },
    });
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
    const [removed] = appState.clients.splice(index, 1);
    renderClientsList();
    if (removed) {
      logHistory({
        type: 'client',
        title: 'Usunięto klienta',
        description: removed.name || 'Klient',
        actor: 'Użytkownik',
        meta: { action: 'delete', clientId: removed.id },
      });
    }
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
      category: (formData.get('category') || '').toString().trim(),
      release: (formData.get('release') || 'released').toString(),
      owner: (formData.get('owner') || '').toString().trim(),
      tags: (formData.get('tags') || '').toString(),
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
    logHistory({
      type: 'product',
      title: 'Dodano produkt',
      description: `${payload.name} • ${formatProductRelease(payload.release)}`,
      actor: 'Użytkownik',
      meta: { action: 'create', productId: payload.id },
    });
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
    const [removedProduct] = appState.products.splice(index, 1);
    openProductIds.delete(id);
    renderProductsList();
    if (removedProduct) {
      logHistory({
        type: 'product',
        title: 'Usunięto produkt',
        description: removedProduct.name || 'Produkt',
        actor: 'Użytkownik',
        meta: { action: 'delete', productId: removedProduct.id },
      });
    }
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
      owner: (formData.get('owner') || '').toString().trim(),
      assignedMonth: (formData.get('assignedMonth') || '').toString(),
      nextAction: (formData.get('nextAction') || '').toString(),
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
    logHistory({
      type: 'ai',
      title: 'Dodano bota AI',
      description: `${payload.name} • ${formatAiStatus(payload.status)}`,
      actor: 'Użytkownik',
      meta: { action: 'create', botId: payload.id },
    });
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
    const [removedBot] = appState.aiBots.splice(index, 1);
    renderAiBotsList();
    if (removedBot) {
      logHistory({
        type: 'ai',
        title: 'Usunięto bota AI',
        description: removedBot.name ? removedBot.name : 'Bot AI',
        actor: 'Użytkownik',
        meta: { action: 'delete', botId: removedBot.id },
      });
    }
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
    const title = (formData.get('title') || '').toString().trim();
    if (!title) {
      createToast('Tytuł jest wymagany', 'error');
      noteForm.elements.title.focus();
      return;
    }
    const id = (formData.get('noteId') || '').toString();
    const content = (formData.get('content') || '').toString().trim();
    const priority = (formData.get('priority') || 'medium').toString();
    const status = (formData.get('status') || 'red').toString();
    const responsible = (formData.get('responsible') || '').toString().trim();
    const dueDateValue = (formData.get('dueDate') || '').toString();
    const dueDate = dueDateValue ? dueDateValue : '';
    const estimatedCostValue = (formData.get('estimatedCost') || '').toString().trim();
    let estimatedCost = estimatedCostValue ? Number.parseFloat(estimatedCostValue.replace(',', '.')) : 0;
    if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
      estimatedCost = 0;
    }
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
        responsible,
        dueDate,
        estimatedCost,
        updatedAt: now,
      });
      createToast('Notatka zaktualizowana', 'success');
      logHistory({
        type: 'note',
        title: `Zmieniono notatkę • ${formatMonthLabel(activeMonth)}`,
        description: `${title} • Status: ${translateStatus(status)}`,
        actor: 'Użytkownik',
        meta: { action: 'update', month: activeMonth, noteId: note.id },
      });
    } else {
      const noteId = crypto.randomUUID();
      const payload = normalizeNote({
        id: noteId,
        title,
        content,
        status,
        priority,
        responsible,
        dueDate,
        estimatedCost,
        checked: false,
        createdAt: now,
        updatedAt: now,
      });
      notes.push(payload);
      createToast('Dodano notatkę', 'success');
      logHistory({
        type: 'note',
        title: `Dodano notatkę • ${formatMonthLabel(activeMonth)}`,
        description: `${title} • Status: ${translateStatus(status)}`,
        actor: 'Użytkownik',
        meta: { action: 'create', month: activeMonth, noteId },
      });
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
        if (idx === -1) {
          return;
        }
        const [removed] = notes.splice(idx, 1);
        renderNotes();
        renderTimeline();
        scheduleSave();
        createToast('Notatka usunięta', 'info');
        if (removed) {
          logHistory({
            type: 'note',
            title: `Usunięto notatkę • ${formatMonthLabel(activeMonth)}`,
            description: removed.title ? `${removed.title}` : 'Usunięto zadanie',
            actor: 'Użytkownik',
            meta: { action: 'delete', month: activeMonth, noteId },
          });
        }
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
    if (noteForm.elements.responsible) {
      noteForm.elements.responsible.value = note.responsible || '';
    }
    if (noteForm.elements.dueDate) {
      noteForm.elements.dueDate.value = note.dueDate || '';
    }
    if (noteForm.elements.estimatedCost) {
      noteForm.elements.estimatedCost.value =
        Number.isFinite(note.estimatedCost) && note.estimatedCost > 0 ? String(note.estimatedCost) : '';
    }
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
      const dueLabel = note.dueDate ? formatShortDate(note.dueDate) : '';
      const haystack = [note.title, note.content, note.responsible, dueLabel]
        .map((value) => (value || '').toString().toLowerCase())
        .join(' ');
      const matchesQuery = !query || haystack.includes(query);
      const matchesStatus = statusFilter === 'all' || note.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || note.priority === priorityFilter;
      return matchesQuery && matchesStatus && matchesPriority;
    });

    const [sortField, sortDirection] = sortValue.split('-');
    const direction = sortDirection === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      switch (sortField) {
        case 'title':
        case 'status':
          return (
            direction *
            (a[sortField] || '').localeCompare(b[sortField] || '', 'pl', {
              sensitivity: 'base',
            })
          );
        case 'responsible':
          return (
            direction *
            (a.responsible || '').localeCompare(b.responsible || '', 'pl', {
              sensitivity: 'base',
            })
          );
        case 'estimatedCost':
          return direction * ((a.estimatedCost || 0) - (b.estimatedCost || 0));
        case 'dueDate': {
          const fallback = sortDirection === 'asc' ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
          const aTime = parseDueDate(a.dueDate)?.getTime() ?? fallback;
          const bTime = parseDueDate(b.dueDate)?.getTime() ?? fallback;
          return direction * (aTime - bTime);
        }
        case 'createdAt':
        case 'updatedAt':
          return (
            direction *
            (new Date(a[sortField] || 0).getTime() - new Date(b[sortField] || 0).getTime())
          );
        default:
          return (
            direction *
            (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
          );
      }
    });

    noteListEl.innerHTML = '';
    filtered.forEach((note) => {
      const li = document.createElement('li');
      li.className = 'note-item';
      li.dataset.id = note.id;
      const responsibleLabel = note.responsible
        ? `<span><span class="meta-icon" aria-hidden="true">👤</span>${escapeHtml(note.responsible)}</span>`
        : '';
      const dueLabel = note.dueDate
        ? `<span><span class="meta-icon" aria-hidden="true">🗓</span>${formatShortDate(note.dueDate)}</span>`
        : '';
      const costLabel = Number.isFinite(note.estimatedCost) && note.estimatedCost > 0
        ? `<span><span class="meta-icon" aria-hidden="true">💰</span>${formatCurrencyValue(note.estimatedCost)}</span>`
        : '';
      const noteMeta = [
        `<span><span class="meta-icon" aria-hidden="true">●</span>${translateStatus(note.status)}</span>`,
        responsibleLabel,
        dueLabel,
        costLabel,
      ]
        .filter(Boolean)
        .join('');
      const noteDescription = note.content
        ? `<div class="note-content">${escapeHtml(note.content).replace(/\n/g, '<br>')}</div>`
        : '';
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
        ${noteDescription}
        <div class="note-footer">
          <div class="note-footer__meta">${noteMeta}</div>
          <small>Aktualizacja: ${formatDate(note.updatedAt || note.createdAt)}</small>
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
        const [removedFile] = files.splice(idx, 1);
        window.metcorDB.removeFile(fileId);
        renderFiles();
        renderTimeline();
        if (removedFile) {
          logHistory({
            type: 'file',
            title: `Usunięto plik • ${formatMonthLabel(activeMonth)}`,
            description: removedFile.safeName || removedFile.name || 'Plik',
            actor: 'Użytkownik',
            meta: { action: 'delete', month: activeMonth, fileId },
          });
        }
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
      renderTimeline();
      logHistory({
        type: 'file',
        title: `Dodano plik • ${formatMonthLabel(activeMonth)}`,
        description: `${safeName} (${formatBytes(file.size)})`,
        actor: 'Użytkownik',
        meta: { action: 'create', month: activeMonth, fileId: record.id },
      });
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

  function formatProductRelease(release) {
    switch (release) {
      case 'released':
        return 'W produkcji';
      case 'beta':
        return 'Beta / pilotaż';
      case 'roadmap':
        return 'W przygotowaniu';
      case 'retired':
        return 'Wycofany';
      default:
        return release;
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

  function normalizeNote(note) {
    if (!note || typeof note !== 'object') return null;
    const now = new Date().toISOString();
    const allowedStatuses = new Set(['green', 'orange', 'red']);
    const allowedPriority = new Set(['low', 'medium', 'high']);
    const rawCost =
      typeof note.estimatedCost === 'number'
        ? note.estimatedCost
        : parseFloat(note.estimatedCost || '0');
    const estimatedCost = Number.isFinite(rawCost) && rawCost >= 0 ? Number(rawCost) : 0;
    const dueDate = note.dueDate ? String(note.dueDate) : '';
    return {
      id: note.id || crypto.randomUUID(),
      title: note.title ? String(note.title) : '',
      content: note.content ? String(note.content) : '',
      status: allowedStatuses.has(note.status) ? note.status : 'red',
      priority: allowedPriority.has(note.priority) ? note.priority : 'medium',
      checked: Boolean(note.checked),
      responsible: note.responsible ? String(note.responsible) : '',
      dueDate,
      estimatedCost,
      createdAt: note.createdAt || now,
      updatedAt: note.updatedAt || note.createdAt || now,
    };
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
    const tags = Array.isArray(product.tags)
      ? product.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : typeof product.tags === 'string'
      ? product.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];
    const allowedRelease = new Set(['released', 'beta', 'roadmap', 'retired']);
    const release = allowedRelease.has(product.release) ? product.release : 'released';
    return {
      id: product.id || crypto.randomUUID(),
      name: product.name ? String(product.name) : '',
      description: product.description ? String(product.description) : '',
      link: sanitizeUrl(product.link),
      image,
      category: product.category ? String(product.category) : '',
      release,
      owner: product.owner ? String(product.owner) : '',
      tags,
      createdAt: product.createdAt || now,
      updatedAt: product.updatedAt || product.createdAt || now,
    };
  }

  function normalizeAiBot(bot) {
    if (!bot || typeof bot !== 'object') return null;
    const now = new Date().toISOString();
    const allowedStatuses = new Set(['active', 'training', 'paused']);
    const status = allowedStatuses.has(bot.status) ? bot.status : 'training';
    const assignedMonth = bot.assignedMonth && monthRange.includes(bot.assignedMonth)
      ? bot.assignedMonth
      : '';
    const nextAction = bot.nextAction ? String(bot.nextAction) : '';
    return {
      id: bot.id || crypto.randomUUID(),
      name: bot.name ? String(bot.name) : '',
      channel: bot.channel ? String(bot.channel) : '',
      cadence: bot.cadence ? String(bot.cadence) : '',
      goal: bot.goal ? String(bot.goal) : '',
      status,
      notes: bot.notes ? String(bot.notes) : '',
      owner: bot.owner ? String(bot.owner) : '',
      assignedMonth,
      nextAction,
      createdAt: bot.createdAt || now,
      updatedAt: bot.updatedAt || bot.createdAt || now,
    };
  }

  function normalizeHistoryEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const now = new Date().toISOString();
    const allowedTypes = new Set(['note', 'file', 'client', 'product', 'ai']);
    const type = allowedTypes.has(entry.type) ? entry.type : 'note';
    return {
      id: entry.id || crypto.randomUUID(),
      type,
      title: entry.title ? String(entry.title) : '',
      description: entry.description ? String(entry.description) : '',
      actor: entry.actor ? String(entry.actor) : 'System',
      createdAt: entry.createdAt || now,
      meta: entry.meta && typeof entry.meta === 'object' ? entry.meta : {},
    };
  }

  function renderHistory() {
    if (!historyList) return;
    const entries = Array.isArray(appState?.history) ? appState.history.slice(0, HISTORY_LIMIT) : [];
    historyList.innerHTML = '';
    if (entries.length === 0) {
      historyList.hidden = true;
      if (historyEmpty) {
        historyEmpty.hidden = false;
        historyEmpty.textContent = historyEmptyDefault;
      }
      return;
    }
    historyList.hidden = false;
    if (historyEmpty) {
      historyEmpty.hidden = true;
      historyEmpty.textContent = historyEmptyDefault;
    }
    entries.forEach((entry) => {
      const li = document.createElement('li');
      li.className = 'history-entry';
      const badgeClass = getHistoryBadgeModifier(entry.type);
      const safeTitle = escapeHtml(entry.title || 'Aktualizacja');
      const safeActor = escapeHtml(entry.actor || 'System');
      const timestamp = entry.createdAt || '';
      const description = entry.description
        ? `<p>${escapeHtml(entry.description).replace(/\n/g, '<br>')}</p>`
        : '';
      li.innerHTML = `
        <div class="history-entry__meta">
          <span class="history-entry__badge ${badgeClass}">${formatHistoryType(entry.type)}</span>
          <span>${safeActor}</span>
          <time datetime="${timestamp}">${formatDate(timestamp)}</time>
        </div>
        <div>
          <strong>${safeTitle}</strong>
          ${description}
        </div>
      `;
      historyList.appendChild(li);
    });
  }

  function logHistory(entry) {
    if (!appState) return;
    const normalized = normalizeHistoryEntry(entry);
    if (!normalized) return;
    appState.history.unshift(normalized);
    if (appState.history.length > HISTORY_LIMIT) {
      appState.history.length = HISTORY_LIMIT;
    }
    renderHistory();
  }

  function formatHistoryType(type) {
    switch (type) {
      case 'file':
        return 'Pliki';
      case 'client':
        return 'Klienci';
      case 'product':
        return 'Produkty';
      case 'ai':
        return 'AI';
      case 'note':
      default:
        return 'Notatki';
    }
  }

  function getHistoryBadgeModifier(type) {
    switch (type) {
      case 'file':
        return 'history-entry__badge--files';
      case 'client':
        return 'history-entry__badge--clients';
      case 'product':
        return 'history-entry__badge--products';
      case 'ai':
        return 'history-entry__badge--ai';
      case 'note':
      default:
        return 'history-entry__badge--notes';
    }
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
