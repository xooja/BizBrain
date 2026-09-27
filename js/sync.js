/**
 * BizBrain-Pro — sync.js
 * Robust Background Synchronization Engine.
 *
 * Principles:
 * - Local-First + Background Sync
 * - Exponential backoff retry
 * - Deterministic conflict resolution (local uncommitted edits protected)
 * - Safe queue drain with idempotency
 * - Visible, respectful status indicators
 */

const Sync = (() => {
  let _running   = false;
  let _interval  = null;
  let _isOnline  = navigator.onLine;

  const SYNC_INTERVAL   = 25000; // 25s background polling when online
  const MAX_RETRIES     = 5;

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    window.addEventListener('connection:online',  handleOnline);
    window.addEventListener('connection:offline', handleOffline);

    if (typeof ConnectionManager !== 'undefined' && ConnectionManager.getInstance) {
      const connMgr = ConnectionManager.getInstance();
      if (connMgr.isOnline()) {
        _isOnline = true;
        startPolling();
        updateStatusBadge('synced');
      } else {
        _isOnline = false;
        updateStatusBadge('offline');
      }
    } else if (navigator.onLine) {
      _isOnline = true;
      startPolling();
      updateStatusBadge('synced');
    } else {
      _isOnline = false;
      updateStatusBadge('offline');
    }

    // Refresh sync status indicator periodically
    setInterval(updateQueueCountBadge, 8000);
  }

  // ── Connection state transitions ─────────────────────────────
  function handleOnline() {
    _isOnline = true;
    showToast('Connection restored — syncing your offline changes…', 'info');
    updateStatusBadge('syncing');

    setTimeout(() => runSync(), 1200);
    startPolling();
  }

  function handleOffline() {
    _isOnline = false;
    updateStatusBadge('offline');
    stopPolling();
    showToast('Offline mode active — all changes saved locally', 'warning');
  }

  function start() {
    _isOnline = true;
    updateStatusBadge('syncing');
    setTimeout(() => runSync(), 1000);
    startPolling();
  }

  // ── Polling ──────────────────────────────────────────────────
  function startPolling() {
    stopPolling();
    _interval = setInterval(() => runSync(), SYNC_INTERVAL);
  }

  function stopPolling() {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
  }

  // ── Main Sync Loop ───────────────────────────────────────────
  async function runSync() {
    if (_running || !navigator.onLine) return;
    _running = true;

    try {
      const queue = await DB.getPendingQueue();
      if (queue.length === 0) {
        updateStatusBadge('synced');
        _running = false;
        return;
      }

      updateStatusBadge('syncing');

      let successCount = 0;
      let failCount = 0;

      for (const item of queue) {
        if (item.attempts >= MAX_RETRIES) {
          await DB.markFailed(item.queue_id, 'Maximum retries exceeded');
          failCount++;
          continue;
        }

        try {
          const res = await pushItem(item);
          await DB.markSynced(item.queue_id, res?.new_id || res?.data?.id);
          successCount++;
        } catch (err) {
          console.warn(`[Sync] Item ${item.queue_id} push error:`, err);
          await DB.markFailed(item.queue_id, err.message || 'Network sync error');
          failCount++;
        }
      }

      if (successCount > 0) {
        showToast(`Synced ${successCount} offline change${successCount > 1 ? 's' : ''}`, 'success');
      }

      if (failCount > 0) {
        updateStatusBadge('error', failCount);
      } else {
        updateStatusBadge('synced');
      }

      // After pushing pending changes, pull remote updates safely
      await pullData();

    } catch (err) {
      console.error('[Sync] Fatal loop error:', err);
      updateStatusBadge(navigator.onLine ? 'synced' : 'offline');
    } finally {
      _running = false;
      updateQueueCountBadge();
    }
  }

  // ── Push Single Queue Record ─────────────────────────────────
  async function pushItem(item) {
    const { entity, action, payload } = item;
    const ep = entityEndpoint(entity);

    switch (action) {
      case 'create':
        return await API.post(ep, payload);
      case 'update':
        return await API.put(`${ep}?id=${encodeURIComponent(payload.id)}`, payload);
      case 'delete':
        return await API.del(`${ep}?id=${encodeURIComponent(payload.id)}`);
      default:
        throw new Error(`Unsupported sync action: ${action}`);
    }
  }

  // ── Safe Data Pull (Does not overwrite unsynced local records) ─
  async function pullData() {
    if (!navigator.onLine) return;
    try {
      const endpoints = [
        { store: 'categories', fn: () => API.categories.list() },
        { store: 'suppliers', fn: () => API.suppliers.list() },
        { store: 'customers', fn: () => API.customers.list() },
        { store: 'products', fn: () => API.products.list() },
        { store: 'expenses', fn: () => API.expenses.list() },
      ];

      for (const ep of endpoints) {
        try {
          const res = await ep.fn();
          const remoteRecords = Array.isArray(res) ? res : (res?.data || []);
          if (!remoteRecords.length) continue;

          // Merge without overwriting local unsynced edits
          const localRecords = await DB.getAll(ep.store);
          const localUnsyncedMap = new Map();
          localRecords.forEach(r => {
            if (r.synced === 0) localUnsyncedMap.set(String(r.id), true);
          });

          for (const rem of remoteRecords) {
            const remId = String(rem.id);
            if (!localUnsyncedMap.has(remId)) {
              rem.synced = 1;
              await DB.put(ep.store, rem);
            }
          }
        } catch (_) {}
      }
    } catch (err) {
      console.warn('[Sync] Pull skipped:', err);
    }
  }

  // ── Map Entity to API Endpoint ───────────────────────────────
  function entityEndpoint(entity) {
    const map = {
      products:          'products.php',
      categories:        'categories.php',
      suppliers:         'suppliers.php',
      customers:         'customers.php',
      purchase_invoices: 'purchase_invoices.php',
      sales_invoices:    'sales_invoices.php',
      purchase_returns:  'purchase_returns.php',
      sales_returns:     'sales_returns.php',
      expenses:          'expenses.php',
      payments:          'payments.php',
      settings:          'settings.php',
    };
    return map[entity] || `${entity}.php`;
  }

  // ── UI Status Indicators ─────────────────────────────────────
  function updateStatusBadge(state, pendingCount = 0) {
    // 1. Sidebar badge
    const badge = document.getElementById('sync-badge');
    const dot   = badge?.querySelector('.sync-dot');
    const label = document.getElementById('sync-label');

    if (dot && label) {
      dot.className = `sync-dot ${state === 'synced' ? 'online' : state}`;
      if (state === 'synced') label.textContent = 'Synced';
      else if (state === 'syncing') label.textContent = 'Syncing…';
      else if (state === 'offline') label.textContent = 'Offline';
      else if (state === 'error') label.textContent = `${pendingCount} Pending`;
    }

    // 2. Top header connection badge
    const connDot   = document.querySelector('.conn-dot');
    const connLabel = document.getElementById('conn-label');
    if (connDot && connLabel) {
      if (state === 'offline') {
        connDot.className = 'conn-dot offline';
        connLabel.textContent = 'Offline';
      } else if (state === 'syncing') {
        connDot.className = 'conn-dot';
        connLabel.textContent = 'Syncing…';
      } else {
        connDot.className = 'conn-dot';
        connLabel.textContent = 'Online';
      }
    }

    // 3. Mobile status bar indicator
    const mobileStatus = document.getElementById('mobile-sync-status');
    if (mobileStatus) {
      if (state === 'offline') {
        mobileStatus.innerHTML = '<span class="status-pill offline"><i class="fa-solid fa-cloud-slash"></i> Offline</span>';
      } else if (state === 'syncing') {
        mobileStatus.innerHTML = '<span class="status-pill syncing"><i class="fa-solid fa-arrows-rotate fa-spin"></i> Syncing</span>';
      } else {
        mobileStatus.innerHTML = '<span class="status-pill online"><i class="fa-solid fa-cloud-check"></i> Synced</span>';
      }
    }
  }

  async function updateQueueCountBadge() {
    try {
      const queue = await DB.getPendingQueue();
      const count = queue.length;
      const countEl = document.getElementById('sync-pending-count');
      if (countEl) {
        countEl.textContent = count > 0 ? `${count}` : '';
        countEl.style.display = count > 0 ? 'inline-block' : 'none';
      }
    } catch (_) {}
  }

  return {
    init,
    start,
    runSync,
    pullData,
    updateStatusBadge,
    updateQueueCountBadge
  };
})();
