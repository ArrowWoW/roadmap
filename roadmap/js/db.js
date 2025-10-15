/* IndexedDB storage layer with localStorage fallback */
(function () {
  // Central IndexedDB configuration (object stores mirror spec structure)
  const DB_NAME = 'metcor-marketing-roadmap';
  const DB_VERSION = 1;
  const STATE_STORE = 'state';
  const FILE_STORE = 'files';

  const listeners = new Set();
  let dbInstance = null;
  let useFallback = false;

  // Notify listeners when we drop down to localStorage persistence
  function emitFallback() {
    if (useFallback) {
      return;
    }
    useFallback = true;
    console.warn('IndexedDB niedostępne – użyto localStorage');
    listeners.forEach((fn) => fn());
  }

  function onFallback(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        emitFallback();
        reject(new Error('Brak wsparcia IndexedDB'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STATE_STORE)) {
          db.createObjectStore(STATE_STORE);
        }
        if (!db.objectStoreNames.contains(FILE_STORE)) {
          const store = db.createObjectStore(FILE_STORE, { keyPath: 'id' });
          store.createIndex('month', 'month');
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function ensureDb() {
    if (dbInstance || useFallback) {
      return dbInstance;
    }
    if (!dbInstance) {
      try {
        dbInstance = await openDatabase();
      } catch (err) {
        emitFallback();
        throw err;
      }
    }
    return dbInstance;
  }

  // Load serialized SPA state (notes + metadata) from the backing store
  async function readState() {
    if (useFallback) {
      const data = localStorage.getItem(DB_NAME);
      if (!data) return null;
      try {
        return JSON.parse(data);
      } catch (err) {
        console.error('Nieprawidłowe dane localStorage', err);
        return null;
      }
    }

    const db = await ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STATE_STORE, 'readonly');
      const store = tx.objectStore(STATE_STORE);
      const request = store.get('primary');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Persist the entire SPA state snapshot (debounced upstream)
  async function writeState(state) {
    if (useFallback) {
      localStorage.setItem(DB_NAME, JSON.stringify(state));
      return;
    }
    const db = await ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STATE_STORE, 'readwrite');
      const store = tx.objectStore(STATE_STORE);
      const request = store.put(state, 'primary');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(blob);
    });
  }

  function base64ToBlob(dataUrl) {
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

  // Store binary payloads separately to keep the main state JSON friendly
  async function addFile(record) {
    if (useFallback) {
      const key = `${DB_NAME}-file-${record.id}`;
      const payload = { ...record };
      payload.data = await blobToBase64(record.data);
      localStorage.setItem(key, JSON.stringify(payload));
      return;
    }
    const db = await ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readwrite');
      const store = tx.objectStore(FILE_STORE);
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function getFilesByMonth(month) {
    if (useFallback) {
      const files = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${DB_NAME}-file-`)) {
          const data = localStorage.getItem(key);
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.month === month) {
              files.push({ ...parsed, data: base64ToBlob(parsed.data) });
            }
          } catch (err) {
            console.error('Błąd odczytu pliku', err);
          }
        }
      }
      return files;
    }
    const db = await ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readonly');
      const index = tx.objectStore(FILE_STORE).index('month');
      const request = index.getAll(IDBKeyRange.only(month));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function removeFile(id) {
    if (useFallback) {
      localStorage.removeItem(`${DB_NAME}-file-${id}`);
      return;
    }
    const db = await ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readwrite');
      const store = tx.objectStore(FILE_STORE);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function exportFiles() {
    if (useFallback) {
      const files = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${DB_NAME}-file-`)) {
          const data = localStorage.getItem(key);
          if (!data) continue;
          try {
            files.push(JSON.parse(data));
          } catch (err) {
            console.error('Błąd eksportu plików', err);
          }
        }
      }
      return files;
    }
    const db = await ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readonly');
      const store = tx.objectStore(FILE_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function importFiles(files = []) {
    if (!Array.isArray(files)) return;
    for (const file of files) {
      if (useFallback && typeof file.data === 'string') {
        localStorage.setItem(`${DB_NAME}-file-${file.id}`, JSON.stringify(file));
      } else {
        const record = { ...file };
        if (typeof record.data === 'string') {
          record.data = base64ToBlob(record.data);
        }
        await addFile(record);
      }
    }
  }

  window.metcorDB = {
    onFallback,
    readState,
    writeState,
    addFile,
    getFilesByMonth,
    removeFile,
    exportFiles,
    importFiles,
    blobToBase64,
  };
})();