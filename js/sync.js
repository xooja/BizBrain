/**
 * BizBrain — sync.js
 * Automatic synchronization engine.
 * Detects connectivity, drains the sync queue, and updates MySQL.
 */

const Sync = (() => {
  let _running   = false;
  let _interval  = null;
  let _isOnline  = navigator.onLine;

  const SYNC_INTERVAL = 30000; // 30s polling when online
  const MAX_RETRIES   = 3;

  // ── Init ─────────────────────────────────────────────────
  function init() {
    // Listen for ConnectionManager events (centralised)
    window.addEventListener('connection:online',  handleOnline);
    window.addEventListener('connection:offline', handleOffline);

    // Initial state from ConnectionManager, fallback to navigator
    if (typeof ConnectionManager !== 'undefined' && ConnectionManager.getInstance) {
      const connMgr = ConnectionManager.getInstance();
      if (connMgr.isOnline()) { _isOnline = true; startPolling(); updateBadge('online'); }
      else { _isOnline = false; updateBadge('offline'); }
    } else if (navigator.onLine) {
      _isOnline = true;
      startPolling();
      updateBadge('online');
    } else {
      _isOnline = false;
      updateBadge('offline');
    }
  }

  // ── Connection events (from ConnectionManager) ────────────
  function handleOnline() {
    _isOnline = true;
    showToast('Back online — syncing your changes…', 'info');
    updateBadge('syncing');
    updateConnBadge(true);

    setTimeout(() => runSync(), 1500);
    startPolling();
  }

  function handleOffline() {
    _isOnline = false;
    updateBadge('offline');
    updateConnBadge(false);
    stopPolling();
    showToast('You are offline — changes saved locally', 'warning');
  }

  // ── start() – called by ConnectionManager on reconnect ───
  function start() {
    if (!_isOnline) _isOnline = true;
    updateBadge('syncing');
    setTimeout(() => runSync(), 1500);
    startPolling();
  }

  // ── Polling ──────────────────────────────────────────────
  function startPolling() {
    stopPolling();
    _interval = setInterval(() => runSync(), SYNC_INTERVAL);
  }

  function stopPolling() {
    if (_interval) { clearInterval(_interval); _interval = null; }
  }

  // ── Main sync run ────────────────────────────────────────
  async function runSync() {
    if (_running || !navigator.onLine) return;
    _running = true;

    try {
      const queue = await DB.getPendingQueue();
      if (queue.length === 0) {
        updateBadge('online');
        return;
      }

      updateBadge('syncing');

      let success = 0, failed = 0;

      for (const item of queue) {
        if (item.attempts >= MAX_RETRIES) {
          await DB.markFailed(item.queue_id, 'Max retries exceeded');
          failed++;
          continue;
        }

        try {
          await pushItem(item);
          await DB.markSynced(item.queue_id);
          success++;
        } catch (err) {
          await DB.markFailed(item.queue_id, err.message || 'Unknown error');
          failed++;
        }
      }

      if (success > 0) showToast(`Synced ${success} change${success > 1 ? 's' : ''}`, 'success');
      if (failed  > 0) showToast(`${failed} item${failed > 1 ? 's' : ''} failed to sync`, 'error');

      updateBadge('online');

      // Pull fresh data after push
      await pullData();

    } catch (err) {
      console.error('[Sync] Error:', err);
      updateBadge(navigator.onLine ? 'online' : 'offline');
    } finally {
      _running = false;
    }
  }

  // ── Push single queue item ───────────────────────────────
  async function pushItem(item) {
    const { entity, action, payload } = item;
    const ep = entityEndpoint(entity);

    switch (action) {
      case 'create':
        await API.post(ep, payload);
        break;
      case 'update':
        await API.put(`${ep}?id=${payload.id}`, payload);
        break;
      case 'delete':
        await API.del(`${ep}?id=${payload.id}`);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // ── Pull fresh data from server ──────────────────────────
  async function pullData() {
    if (!navigator.onLine) return;
    try {
      const results = await Promise.allSettled([
        API.expenses.list(),
        API.suppliers.list(),
        API.products.list(),
        API.customers.list(),
      ]);

      if (results[0].status === 'fulfilled' && results[0].value?.data)
        await DB.putAll('expenses', results[0].value.data.map(r => ({ ...r, synced: 1 })));
      if (results[1].status === 'fulfilled' && results[1].value?.data)
        await DB.putAll('suppliers', results[1].value.data.map(r => ({ ...r, synced: 1 })));
      if (results[2].status === 'fulfilled' && results[2].value?.data)
        await DB.putAll('products', results[2].value.data.map(r => ({ ...r, synced: 1 })));
      if (results[3].status === 'fulfilled' && results[3].value?.data)
        await DB.putAll('customers', results[3].value.data.map(r => ({ ...r, synced: 1 })));

    } catch (err) {
      console.warn('[Sync] Pull failed:', err);
    }
  }

  // ── Entity → endpoint mapping ────────────────────────────
  function entityEndpoint(entity) {
    const map = {
      expenses: 'expenses.php',
      settings: 'settings.php',
      suppliers: 'suppliers.php',
      products: 'products.php',
      customers: 'customers.php',
      purchase_invoices: 'purchase_invoices.php',
      sales_invoices: 'sales_invoices.php',
    };
    return map[entity] || `${entity}.php`;
  }

  // ── Badge UI helpers ─────────────────────────────────────
  function updateBadge(state) {
    const dot   = document.getElementById('sync-badge')?.querySelector('.sync-dot');
    const label = document.getElementById('sync-label');
    if (!dot || !label) return;

    dot.className = `sync-dot ${state}`;
    const labels = { online: 'Synced', syncing: 'Syncing…', offline: 'Offline' };
    label.textContent = labels[state] || state;
  }

  function updateConnBadge(online) {
    const dot   = document.querySelector('.conn-dot');
    const label = document.getElementById('conn-label');
    if (!dot || !label) return;

    dot.className = `conn-dot${online ? '' : ' offline'}`;
    label.textContent = online ? 'Online' : 'Offline';
  }

  // ── Manually trigger sync ────────────────────────────────
  function trigger() {
    runSync();
  }

  // ── Get pending count ────────────────────────────────────
  async function pendingCount() {
    const queue = await DB.getPendingQueue();
    return queue.length;
  }

  return { init, start, trigger, pullData, pendingCount };
})();

// ── Offline-aware data helpers ───────────────────────────────
// These wrap API calls with IndexedDB fallback.

const DataLayer = (() => {

  // ── Generic fetch-with-fallback ──────────────────────────
  async function fetchOrCache(store, apiFn) {
    if (navigator.onLine) {
      try {
        const res = await apiFn();
        if (res?.data) {
          await DB.putAll(store, res.data.map(r => ({ ...r, synced: 1 })));
          return res.data;
        }
      } catch (err) {
        // If server says 401 Unauthorized, redirect to login
        if (err.status === 401) {
          console.error('[DataLayer] 401 Unauthorized — session expired, redirecting to login');
          await Auth.logout();
          document.getElementById('app-shell').style.display  = 'none';
          document.getElementById('login-screen').style.display = 'flex';
          showToast('Session expired — please sign in again', 'error');
          throw err;
        }
        // Otherwise, silently fall back to cache (offline)
      }
    }
    // Offline fallback
    return DB.getAll(store);
  }

  // ── Generic save-with-queue ──────────────────────────────
  async function saveRecord(store, record, isNew = true) {
    const isLocal = String(record.id || '').startsWith('local_');

    if (navigator.onLine && !isLocal) {
      try {
        let res;
        if (isNew) {
          res = await API.post(`${store}.php`, record);
        } else {
          res = await API.put(`${store}.php?id=${record.id}`, record);
        }
        const saved = res.data || record;
        await DB.put(store, { ...saved, synced: 1 });
        return saved;
      } catch (err) {
        if (!err.offline) throw err;
      }
    }

    // Offline — save locally + enqueue
    const localRecord = { ...record, synced: 0 };
    if (!localRecord.id) localRecord.id = DB.localId();
    await DB.put(store, localRecord);
    await DB.enqueue(store, isNew ? 'create' : 'update', localRecord);
    return localRecord;
  }

  // ── Generic delete-with-queue ────────────────────────────
  async function deleteRecord(store, id) {
    if (navigator.onLine && !String(id).startsWith('local_')) {
      try {
        await API.del(`${store}.php?id=${id}`);
        await DB.del(store, id);
        return true;
      } catch (err) {
        if (!err.offline) throw err;
      }
    }
    await DB.del(store, id);
    if (!String(id).startsWith('local_')) {
      await DB.enqueue(store, 'delete', { id });
    }
    return true;
  }

  // ── Expenses ─────────────────────────────────────────────
  const expenses = {
    list:   ()           => fetchOrCache('expenses', () => API.expenses.list()),
    get:    (id)         => DB.get('expenses', id),
    save:   (r, isNew)   => saveRecord('expenses', r, isNew),
    delete: (id)         => deleteRecord('expenses', id),
  };

  return { expenses };
})();
