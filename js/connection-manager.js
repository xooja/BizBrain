/**
 * BizBrain — connection-manager.js
 * Centralised Connection Manager (Singleton).
 *
 * RESPONSIBILITIES
 *  - Internet connectivity detection (navigator.onLine + live probe)
 *  - Server availability check  (GET /php/api/ping.php)
 *  - Background monitoring loop (every 10 s)
 *  - Broadcasting connection state changes via CustomEvent
 *  - UI connection-indicator updates
 *  - Triggering Sync when the connection comes back online
 *
 * RULES
 *  - No business logic lives here.
 *  - No other module ever calls the server directly for a connectivity check.
 *  - Only ONE interval ever runs (guarded by #running).
 */

class ConnectionManager {
  // ── Private fields ──────────────────────────────────────────────
  #status;               // 'online' | 'offline' | 'checking'
  #lastChecked;          // Date | null
  #lastSuccessfulPing;   // Date | null
  #timer;                // setInterval handle | null
  #controller;           // AbortController | null – for cancelling in-flight pings
  #running;              // boolean – is the background loop active?
  #syncTriggered;        // boolean – prevent duplicate sync calls on reconnect
  #pingUrl;              // string  – URL to the ping endpoint
  #pollIntervalMs;       // number  – ms between checks
  #timeoutMs;            // number  – fetch timeout

  // ── Singleton enforcement ───────────────────────────────────────
  /** @type {ConnectionManager|null} */
  static #instance = null;

  /**
   * Return (and lazily create) the single ConnectionManager instance.
   * @returns {ConnectionManager}
   */
  static getInstance() {
    if (!ConnectionManager.#instance) {
      ConnectionManager.#instance = new ConnectionManager();
    }
    return ConnectionManager.#instance;
  }

  // ── Constructor ─────────────────────────────────────────────────
  constructor() {
    // Enforce singleton – never call `new ConnectionManager()` directly
    if (ConnectionManager.#instance) {
      throw new Error('ConnectionManager is a singleton. Use ConnectionManager.getInstance().');
    }
    ConnectionManager.#instance = this;

    this.#status            = 'offline';
    this.#lastChecked       = null;
    this.#lastSuccessfulPing = null;
    this.#timer             = null;
    this.#controller        = null;
    this.#running           = false;
    this.#syncTriggered     = false;
    this.#pingUrl           = './php/api/ping.php';
    this.#pollIntervalMs    = 10000;  // 10 seconds
    this.#timeoutMs         = 3000;   // 3-second timeout

    // Listen for native browser online/offline events so we can react
    // immediately instead of waiting for the next poll interval.
    window.addEventListener('online',  () => this.#onBrowserOnline());
    window.addEventListener('offline', () => this.#onBrowserOffline());
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Start the background monitoring loop.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  start() {
    if (this.#running) return;          // already running
    this.#running   = true;
    this.#syncTriggered = false;

    // Run the first check immediately
    this.#check();
    // Then schedule periodic checks
    this.#timer = setInterval(() => this.#check(), this.#pollIntervalMs);

    console.log('[ConnectionManager] Background monitoring started.');
  }

  /**
   * Stop the background monitoring loop.
   */
  stop() {
    this.#running = false;
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    // Cancel any flight request currently in progress
    this.#cancelPendingRequest();
    console.log('[ConnectionManager] Background monitoring stopped.');
  }

  /**
   * Execute a single connectivity check immediately (outside the normal
   * interval).  Useful after a manual action or when other modules need
   * a one-shot re-check.
   * @returns {Promise<'online'|'offline'>}
   */
  async checkNow() {
    return this.#check();
  }

  /** @returns {boolean} True when both internet + server are reachable. */
  isOnline() {
    return this.#status === 'online';
  }

  /** @returns {boolean} True when internet or server is not reachable. */
  isOffline() {
    return this.#status === 'offline';
  }

  /** @returns {'online'|'offline'|'checking'} The current connection state. */
  getStatus() {
    return this.#status;
  }

  /** @returns {Date|null} Timestamp of the last connectivity check. */
  lastChecked() {
    return this.#lastChecked;
  }

  /** @returns {Date|null} Timestamp of the last successful server ping. */
  lastSuccessfulPing() {
    return this.#lastSuccessfulPing;
  }

  // ── Browser event handlers ──────────────────────────────────────

  /**
   * Fires when the browser reports it regained network connectivity.
   * We run an immediate check so the UI updates within milliseconds
   * instead of waiting up to 10 seconds.
   */
  async #onBrowserOnline() {
    console.log('[ConnectionManager] Browser reports online — verifying…');
    // Don't change status yet; let the ping confirm it.
    this.#updateUI('checking');
    await this.#check();
  }

  /**
   * Fires when the browser reports a lost network interface.
   * We instantly switch to OFFLINE — no point pinging a dead network.
   */
  #onBrowserOffline() {
    console.log('[ConnectionManager] Browser reports offline.');
    this.#cancelPendingRequest();
    this.#setStatus('offline');
  }

  // ── Core check logic ────────────────────────────────────────────

  /**
   * Full connectivity check flow:
   *   1. Internet?  No  → set OFFLINE immediately.
   *   2. Internet?  Yes → ping server (with timeout).
   *      - Ping OK     → set ONLINE.
   *      - Ping fails  → set OFFLINE (server down / unreachable).
   *
   * @returns {Promise<'online'|'offline'>}
   */
  async #check() {
    // ── Step 1: Internet availability ─────────────────────────
    if (!navigator.onLine) {
      this.#cancelPendingRequest();
      this.#setStatus('offline');
      this.#lastChecked = new Date();
      return 'offline';
    }

    // ── Step 2: Server ping ───────────────────────────────────
    this.#updateUI('checking');
    this.#cancelPendingRequest();               // safety — only one flight at a time
    this.#controller = new AbortController();
    const signal     = this.#controller.signal;

    // Timeout race — if fetch doesn't finish within #timeoutMs, abort
    const timeoutId = setTimeout(() => {
      if (this.#controller) this.#controller.abort();
    }, this.#timeoutMs);

    try {
      const response = await fetch(this.#pingUrl, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
        signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Any non-2xx response (500, 404, etc.) → server is not healthy
        throw new Error(`Server returned ${response.status}`);
      }

      const body = await response.json();

      // Validate the JSON payload shape
      if (!body || body.status !== 'online') {
        throw new Error('Unexpected ping response');
      }

      // Success!
      this.#lastSuccessfulPing = new Date();
      this.#setStatus('online');

    } catch (err) {
      clearTimeout(timeoutId);

      // Distinguish abort (timeout we initiated) from other failures
      if (err.name === 'AbortError') {
        console.warn('[ConnectionManager] Ping timed out after', this.#timeoutMs, 'ms');
      } else {
        console.warn('[ConnectionManager] Ping failed:', err.message || err);
      }

      this.#setStatus('offline');
    }

    this.#lastChecked = new Date();
    this.#controller  = null;
    return this.#status;
  }

  // ── Status mutation + broadcast ─────────────────────────────────

  /**
   * Set the internal status.  If it actually changed from the previous
   * value, fire the appropriate global event and update the UI.
   *
   * @param {'online'|'offline'} newStatus
   */
  #setStatus(newStatus) {
    const previous = this.#status;

    if (previous === newStatus) return;          // no change — nothing to do

    this.#status = newStatus;
    this.#updateUI(newStatus);

    console.log(`[ConnectionManager] Status: ${previous} → ${newStatus}`);

    // ── Dispatch global event so every listening page/module can react ──
    window.dispatchEvent(
      new CustomEvent(newStatus === 'online' ? 'connection:online' : 'connection:offline')
    );

    // ── Sync trigger (offline → online only, run once) ──────────
    if (previous === 'offline' && newStatus === 'online') {
      this.#triggerSync();
    }
  }

  /**
   * Fire the Sync engine if available.  Guarded so it only runs once
   * per reconnect cycle (reset when we go offline again).
   */
  #triggerSync() {
    if (this.#syncTriggered) return;
    this.#syncTriggered = true;

    // The global Sync object is defined in sync.js (IIFE).
    const sync = (typeof Sync !== 'undefined' && Sync.start) ? Sync : null;

    if (sync && typeof sync.start === 'function') {
      console.log('[ConnectionManager] Triggering sync after reconnect.');
      // Small delay to let the connection stabilise
      setTimeout(() => sync.start(), 1500);
    }
  }

  // ── UI update ───────────────────────────────────────────────────

  /**
   * Update the top-bar connection indicator (`.conn-badge` in the header).
   *
   * @param {'online'|'offline'|'checking'} state
   */
  #updateUI(state) {
    const dotEl   = document.querySelector('.conn-dot');
    const labelEl = document.getElementById('conn-label');

    if (!dotEl || !labelEl) return;

    // Remove all state classes, then add the current one
    dotEl.classList.remove('online', 'offline', 'checking');
    dotEl.classList.add(state);

    const labels = {
      online:   'Connected',
      offline:  'Offline',
      checking: 'Checking…',
    };
    labelEl.textContent = labels[state] || state;
  }

  // ── Helpers ─────────────────────────────────────────────────────

  /** Abort the in-flight ping request (if any). */
  #cancelPendingRequest() {
    if (this.#controller) {
      this.#controller.abort();
      this.#controller = null;
    }
  }
}

// ── EXPORT TO GLOBAL SCOPE ────────────────────────────────────────
// The existing codebase uses IIFE globals (DB, API, Auth, Sync, Router).
// We follow the same pattern so every module can reference the manager
// without needing ES module loaders.

window.ConnectionManager = ConnectionManager;