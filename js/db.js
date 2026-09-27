/**
 * BizBrain — db.js
 * IndexedDB wrapper for offline-first data storage.
 * Provides a simple promise-based API over IndexedDB.
 */

const DB = (() => {
  const DB_NAME    = 'BizBrainDB';
  const DB_VERSION = 3;


  let _db = null;

  // ── Schema ──────────────────────────────────────────────
  const STORES = {
    users:              { keyPath: 'id', indexes: ['email'] },
    expenses:           { keyPath: 'id', indexes: ['category', 'synced'] },
    settings:           { keyPath: 'key' },
    activity:           { keyPath: 'id', indexes: ['type', 'created_at'] },
    sync_queue:         { keyPath: 'queue_id', indexes: ['status', 'entity', 'created_at'] },
    session:            { keyPath: 'key' },
    suppliers:          { keyPath: 'id', indexes: ['synced'] },
    products:           { keyPath: 'id', indexes: ['synced'] },
    customers:          { keyPath: 'id', indexes: ['synced'] },
    customer_activity:  { keyPath: 'id', indexes: ['type', 'time'] },
    supplier_activity:  { keyPath: 'id', indexes: ['type', 'time'] },
    category_activity:  { keyPath: 'id', indexes: ['type', 'time'] },
  };

  // ── Open DB ──────────────────────────────────────────────
  function open() {
    if (_db) return Promise.resolve(_db);

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        Object.entries(STORES).forEach(([name, cfg]) => {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: cfg.keyPath });
            (cfg.indexes || []).forEach(idx => store.createIndex(idx, idx, { unique: false }));
          }
        });
      };

      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ── Generic transaction helper ───────────────────────────
  async function tx(storeName, mode, callback) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const req = callback(store);
      transaction.oncomplete = () => {};
      if (req) {
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
      } else {
        transaction.oncomplete = () => resolve();
        transaction.onerror    = (e) => reject(e.target.error);
      }
    });
  }

  // ── CRUD ─────────────────────────────────────────────────

  /** Get one record by key */
  function get(store, key) {
    return tx(store, 'readonly', s => s.get(key));
  }

  /** Get all records in a store */
  function getAll(store) {
    return new Promise(async (resolve, reject) => {
      const db = await open();
      const t = db.transaction(store, 'readonly');
      const req = t.objectStore(store).getAll();
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  /** Get records by index value */
  function getByIndex(store, indexName, value) {
    return new Promise(async (resolve, reject) => {
      const db = await open();
      const t = db.transaction(store, 'readonly');
      const idx = t.objectStore(store).index(indexName);
      const req = idx.getAll(value);
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  /** Put (insert or update) a record */
  function put(store, record) {
    return tx(store, 'readwrite', s => s.put(record));
  }

  /** Put multiple records */
  async function putAll(store, records) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readwrite');
      const s = t.objectStore(store);
      records.forEach(r => s.put(r));
      t.oncomplete = () => resolve(records.length);
      t.onerror    = (e) => reject(e.target.error);
    });
  }

  /** Delete a record */
  function del(store, key) {
    return tx(store, 'readwrite', s => s.delete(key));
  }

  /** Clear all records in a store */
  function clear(store) {
    return tx(store, 'readwrite', s => s.clear());
  }

  /** Count records in store */
  function count(store) {
    return new Promise(async (resolve, reject) => {
      const db = await open();
      const t  = db.transaction(store, 'readonly');
      const req = t.objectStore(store).count();
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ── Session helpers ──────────────────────────────────────

  async function setSession(data) {
    await put('session', { key: 'current', ...data });
  }

  async function getSession() {
    return get('session', 'current');
  }

  async function clearSession() {
    return del('session', 'current');
  }

  // ── Setting helpers ──────────────────────────────────────

  async function getSetting(key, defaultVal = null) {
    const r = await get('settings', key);
    return r ? r.value : defaultVal;
  }

  async function setSetting(key, value) {
    return put('settings', { key, value });
  }

  // ── Sync Queue helpers ───────────────────────────────────

  /**
   * Add operation to sync queue.
   * @param {string} entity  - store name: 'clients', 'invoices', etc.
   * @param {string} action  - 'create' | 'update' | 'delete'
   * @param {object} payload - data to send
   */
  async function enqueue(entity, action, payload) {
    const item = {
      queue_id:   `q_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      entity,
      action,
      payload,
      status:     'pending',
      attempts:   0,
      created_at: new Date().toISOString(),
    };
    await put('sync_queue', item);
    return item;
  }

  /** Get all pending sync items */
  function getPendingQueue() {
    return getByIndex('sync_queue', 'status', 'pending');
  }

  /** Mark a queue item as synced */
  async function markSynced(queue_id) {
    const item = await get('sync_queue', queue_id);
    if (item) {
      item.status = 'synced';
      item.synced_at = new Date().toISOString();
      await put('sync_queue', item);
    }
  }

  /** Mark queue item as failed */
  async function markFailed(queue_id, error) {
    const item = await get('sync_queue', queue_id);
    if (item) {
      item.status   = 'failed';
      item.attempts = (item.attempts || 0) + 1;
      item.error    = error;
      await put('sync_queue', item);
    }
  }

  /** Generate a local temporary ID */
  function localId() {
    return `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  return {
    open, get, getAll, getByIndex, put, putAll, del, clear, count,
    setSession, getSession, clearSession,
    getSetting, setSetting,
    enqueue, getPendingQueue, markSynced, markFailed,
    localId,
  };
})();
