/* ZIP builder using JSZip + FileSaver */
(function () {
  async function fetchAsText(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Nie można pobrać pliku: ${path}`);
    return response.text();
  }

  async function fetchAsBinary(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Nie można pobrać pliku: ${path}`);
    return response.arrayBuffer();
  }

  // Bundle the full project + user payload into a downloadable ZIP
  async function buildProjectZip(state) {
    const zip = new JSZip();
    const root = zip.folder('metcor-roadmap');

    const filesToInclude = [
      { path: 'index.html', type: 'text' },
      { path: 'css/styles.css', type: 'text' },
      { path: 'js/app.js', type: 'text' },
      { path: 'js/db.js', type: 'text' },
      { path: 'js/zip.js', type: 'text' },
      { path: 'data/initial-notes.json', type: 'text' },
      { path: 'assets/metcor.png', type: 'binary' },
      { path: 'assets/background.jpg', type: 'binary' },
    ];

    for (const file of filesToInclude) {
      try {
        if (file.type === 'text') {
          const content = await fetchAsText(file.path);
          root.file(file.path, content);
        } else {
          const content = await fetchAsBinary(file.path);
          root.file(file.path, content, { binary: true });
        }
      } catch (err) {
        console.error(err);
      }
    }

    const months = [
      '2025-10', '2025-11', '2025-12',
      '2026-01', '2026-02', '2026-03', '2026-04',
      '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
    ];

    for (const month of months) {
      root.folder(`months/${month}`);
    }

    const dbFiles = await window.metcorDB.exportFiles();
    for (const file of dbFiles) {
      const folder = root.folder(`months/${file.month}`);
      if (!folder) continue;
      let data = file.data;
      if (typeof data === 'string') {
        const base64 = data.split(',')[1];
        folder.file(file.safeName, base64, { base64: true });
      } else {
        const arrayBuffer = await file.data.arrayBuffer();
        folder.file(file.safeName, arrayBuffer);
      }
    }

    root.file('README.md', `# Metcor Marketing Roadmap\n\nTen plik ZIP został wygenerowany ${new Date().toISOString()} i zawiera aktualny stan aplikacji wraz z danymi użytkownika.`);

    const stateJson = JSON.stringify(state, null, 2);
    root.file('data/state-export.json', stateJson);

    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'metcor-roadmap.zip');
  }

  window.metcorZip = {
    buildProjectZip,
  };
})();