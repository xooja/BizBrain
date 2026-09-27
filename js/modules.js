/**
 * BizBrain — modules.js
 * 2-Panel Supplier Profile Module (Shopify-style)
 * Left: Searchable supplier list | Right: Dashboard-style profile
 */

(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────
  let _overlay = null;
  let _sheet   = null;
  let _titleEl = null;
  let _bodyEl  = null;
  let _supplierTemplate = null;
  let _allSuppliers = [];
  let _filteredSuppliers = [];
  let _selectedId = null;

  // ── Get base path for subdirectory deployment ─────────
  function getBasePath() {
    const base = document.querySelector('base')?.getAttribute('href') || '/';
    return new URL(base, window.location.origin).pathname.replace(/\/$/, '');
  }

  // ── Private helpers ───────────────────────────────────────
  function qs(s, ctx) {
    if (!ctx) ctx = document;
    const el = ctx.querySelector(s);
    if (!el) console.warn(`[modules] element not found: ${s}`);
    return el;
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function setFormVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val != null ? val : '';
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatDate(d) {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return d; }
  }

  function formatCurrency(n) {
    const v = Number(n) || 0;
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 2 }).format(v);
  }

  // Named shortcuts used in HTML onclick
  window.Fmt = {
    date: formatDate,
    currency: formatCurrency,
  };

  // ── Color palette for avatars ──────────────────────────────
  const _avatarColors = [
    '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
    '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
  ];

  function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return _avatarColors[Math.abs(hash) % _avatarColors.length];
  }

  function getInitials(name) {
    return (name || 'SP').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  // ── Normalise supplier data shape ─────────────────────────
  function normaliseSupplier(s) {
    return {
      id:              s.id,
      company_name:    s.company_name || s.companyName || '',
      contact_person:  s.contact_person || s.contactPerson || '',
      email:           s.email || '',
      phone:           s.phone || '',
      whatsapp:        s.whatsapp || '',
      city:            s.city || '',
      address:         s.address || '',
      opening_balance: Number(s.opening_balance || s.openingBalance || 0),
      current_balance: Number(s.current_balance || s.currentBalance || 0),
      credit_limit:    Number(s.credit_limit || s.creditLimit || 0),
      status:          s.status || 'active',
      notes:           s.notes || '',
      total_purchases:       Number(s.total_purchases || s.totalPurchases || 0),
      total_purchase_amount: Number(s.total_purchase_amount || s.totalPurchaseAmount || 0),
      total_payments:        Number(s.total_payments || s.totalPayments || 0),
      last_purchase_date:    s.last_purchase_date || s.lastPurchaseDate || null,
      created_at:            s.created_at || s.createdAt || '',
      company:         s.company_name || s.companyName || s.company || '',
      contact:         s.contact_person || s.contactPerson || '',
      balance:         Number(s.current_balance || s.currentBalance || 0),
      creditLimit:     Number(s.credit_limit || s.creditLimit || 0),
      balanceType:     (s.opening_balance_type || s.balanceType || 'payable').toLowerCase(),
      lastPurchaseDate: s.last_purchase_date || s.lastPurchaseDate || null,
      createdAt:       s.created_at || s.createdAt || '',
    };
  }

  // ── Internal data cache ───────────────────────────────────
  const _Module = {
    data: null,
    supplierId: null,
    currentTab: 'overview',
    isOpen: false,
    about: 'supplier-profile',
  };

  window._Module = _Module;

  // ── Initialise ───────────────────────────────────────────
  function init() {
    _overlay = document.getElementById('module-overlay');
    _sheet   = document.getElementById('module-sheet');
    _titleEl = document.getElementById('module-title');
    _bodyEl  = document.getElementById('module-body');

    if (!_overlay || !_sheet || !_bodyEl) {
      console.warn('[modules] overlay/sheet body missing from DOM');
      return;
    }

    // Close on overlay click
    _overlay.addEventListener('click', (e) => {
      if (e.target === _overlay) closeModule();
    });

    console.log('[modules] Supplier Profile module initialised');
  }

  // ── Fetch & cache the supplier template ──────────────────
  async function _ensureSupplierTemplate() {
    if (_supplierTemplate) return;
    try {
      const res = await fetch('./pages/supplier-profile.html');
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      _supplierTemplate = doc.body.innerHTML;
    } catch (err) {
      console.error('[modules] Failed to load supplier template', err);
      _supplierTemplate = '<div class="sp-empty" style="padding:80px"><p>Failed to load profile</p></div>';
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  LEFT SIDEBAR — Supplier List
  // ══════════════════════════════════════════════════════════════

  async function _loadAllSuppliers() {
    try {
      const res = await API.suppliers.list();
      _allSuppliers = Array.isArray(res) ? res : (res?.data || []);
      _allSuppliers = _allSuppliers.map(normaliseSupplier);
      // Sort by name
      _allSuppliers.sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''));
      _filteredSuppliers = [..._allSuppliers];
      _renderSupplierList();
    } catch (e) {
      console.error('[modules] Failed to load suppliers', e);
      _allSuppliers = [];
      _filteredSuppliers = [];
      _renderSupplierList();
    }
  }

  function _renderSupplierList() {
    const container = document.getElementById('sp-list-items');
    const countEl = document.getElementById('sp-list-count');
    if (!container) return;

    if (countEl) {
      countEl.textContent = `${_filteredSuppliers.length} supplier${_filteredSuppliers.length !== 1 ? 's' : ''}`;
    }

    if (!_filteredSuppliers.length) {
      container.innerHTML = `<div class="module-list-empty"><i class="fa-solid fa-truck"></i><p>No suppliers found</p></div>`;
      return;
    }

    container.innerHTML = _filteredSuppliers.map(s => {
      const isActive = String(s.id) === String(_selectedId);
      const balance = s.balance || 0;
      const isReceivable = s.balanceType === 'receivable';
      const balanceClass = isReceivable ? 'receivable' : (Number(balance) < 0 ? 'negative' : 'payable');
      return `<div class="supplier-list-card ${isActive ? 'active' : ''}" onclick="selectSupplier(${s.id})" data-id="${s.id}">
        <div class="supplier-list-avatar" style="background:${getAvatarColor(s.company_name)}">${getInitials(s.company_name)}</div>
        <div class="supplier-list-info">
          <div class="supplier-list-name">${esc(s.company_name || 'Unnamed')}</div>
          <div class="supplier-list-company">${esc(s.contact_person || s.city || '')}</div>
        </div>
        <div class="supplier-list-meta">
          <div class="supplier-list-balance ${balanceClass}">${formatCurrency(balance)}</div>
          <div class="supplier-list-status ${s.status === 'active' ? 'active' : 'inactive'}"></div>
        </div>
      </div>`;
    }).join('');
  }

  // ── Mobile sidebar panel toggle ──────────────────────────────
  window.toggleSidebarPanel = function () {
    const panel = document.getElementById('module-list-panel');
    const overlay = document.getElementById('module-list-overlay');
    if (!panel) return;
    panel.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
  };

  // ── Search / Filter ────────────────────────────────────────
  window.filterSupplierList = function () {
    const q = (document.getElementById('sp-list-search')?.value || '').toLowerCase().trim();
    if (!q) {
      _filteredSuppliers = [..._allSuppliers];
    } else {
      _filteredSuppliers = _allSuppliers.filter(s =>
        (s.company_name || '').toLowerCase().includes(q) ||
        (s.contact_person || '').toLowerCase().includes(q) ||
        (s.city || '').toLowerCase().includes(q) ||
        (s.phone || '').includes(q)
      );
    }
    _renderSupplierList();
  };

  // ── Select a supplier ──────────────────────────────────────
  window.selectSupplier = async function (id, name, phone, address, fromRoute = false) {
    _selectedId = Number(id);
    _renderSupplierList();

    // Show profile content, hide empty state
    const emptyState = document.getElementById('sp-empty-state');
    const profileContent = document.getElementById('sp-profile-content');
    if (emptyState) emptyState.style.display = 'none';
    if (profileContent) profileContent.style.display = 'block';

    // Find data from cached list first
    let s = _allSuppliers.find(x => x.id === id);
    if (s) {
      _Module.data = s;
      _Module.supplierId = id;
      _fillSupplierProfile(s);
      _loadTabData('overview');
    }

    // Fetch fresh data
    try {
      const res = await API.suppliers.get(id);
      const fresh = res?.data || res;
      if (fresh) {
        const normalised = normaliseSupplier(fresh);
        _Module.data = normalised;
        _Module.supplierId = id;
        // Update in allSuppliers cache too
        const idx = _allSuppliers.findIndex(x => x.id === id);
        if (idx >= 0) _allSuppliers[idx] = normalised;
        _fillSupplierProfile(normalised);
        _loadTabData('overview');
      }
    } catch (e) {
      console.error('[modules] Failed to fetch supplier', e);
    }

    // Update URL
    if (!fromRoute) {
      const url = getBasePath() + `/suppliers/${id}`;
      window.history.pushState({ module: 'supplier', id }, '', url);
    }

    // Set title
    if (_titleEl && _Module.data) {
      _titleEl.textContent = _Module.data.company_name || 'Supplier Profile';
    }
  };

  // ══════════════════════════════════════════════════════════════
  //  FILL PROFILE (Header, Stats, Overview, Settings)
  // ══════════════════════════════════════════════════════════════

  function _fillSupplierProfile(d) {
    _fillSupplierHeader(d);
    _fillSupplierStats(d);
    _fillSupplierOverview(d);
    _fillSupplierSettings(d);
    _switchTab('overview');
  }

  function _fillSupplierHeader(d) {
    const avatar = document.getElementById('sp-avatar');
    if (avatar) {
      avatar.textContent = getInitials(d.company_name);
      avatar.style.background = getAvatarColor(d.company_name);
    }

    setEl('sp-name', d.company_name || 'Supplier');
    setEl('sp-company', d.contact_person || '');
    setEl('sp-phone', d.phone || '—');
    setEl('sp-whatsapp', d.whatsapp || d.phone || '—');
    setEl('sp-city', d.city || '—');
    setEl('sp-email', d.email || '—');

    const badge = document.getElementById('sp-status-badge');
    if (badge) {
      badge.textContent = d.status === 'active' ? 'Active' : 'Inactive';
      badge.className = 'badge badge-' + (d.status === 'active' ? 'success' : 'muted');
    }

    const statusDot = document.getElementById('sp-avatar-status');
    if (statusDot) {
      statusDot.className = 'sp-avatar-status ' + (d.status === 'active' ? 'active' : 'inactive');
    }

    const activateBtn = document.getElementById('sp-action-activate');
    if (activateBtn) {
      activateBtn.style.display = d.status === 'inactive' ? '' : 'none';
    }
  }

  function _fillSupplierStats(d) {
    const totalPurchases = d.total_purchases || 0;
    const totalPurchaseAmount = d.total_purchase_amount || 0;
    const totalPayments = d.total_payments || 0;
    const avgOrder = totalPurchases > 0 ? totalPurchaseAmount / totalPurchases : 0;

    setEl('sp-kpi-purchases', totalPurchases.toString());
    setEl('sp-kpi-purchase-amount', formatCurrency(totalPurchaseAmount));
    setEl('sp-kpi-payments', formatCurrency(totalPayments));
    setEl('sp-kpi-outstanding', formatCurrency(Math.abs(d.balance || 0)));
    setEl('sp-kpi-avg-order', formatCurrency(avgOrder));
  }

  function _fillSupplierOverview(d) {
    setEl('sp-ov-balance', formatCurrency(d.balance));
    setEl('sp-ov-credit-limit', formatCurrency(d.creditLimit));
    const avail = (d.creditLimit || 0) - Math.abs(d.balance || 0);
    setEl('sp-ov-avail-credit', formatCurrency(Math.max(0, avail)));
    const balanceType = d.balanceType || 'payable';
    const balanceTypeLabel = balanceType === 'receivable' ? 'Receivable (They owe)' : 'Payable (I owe)';
    setEl('sp-ov-balance-type', balanceTypeLabel);

    // Apply balance color classes
    const balanceEl = document.getElementById('sp-ov-balance');
    if (balanceEl) {
      balanceEl.className = 'sp-info-value sp-balance-' + balanceType;
    }
    setEl('sp-ov-phone', d.phone || '—');
    setEl('sp-ov-email', d.email || '—');
    setEl('sp-ov-contact', d.contact_person || '—');
    setEl('sp-ov-whatsapp', d.whatsapp || d.phone || '—');
    setEl('sp-ov-city', d.city || '—');
    setEl('sp-ov-company', d.company_name || '—');
    setEl('sp-ov-address', d.address || '—');
    setEl('sp-ov-notes', d.notes || '—');
    setEl('sp-ov-last-purchase', d.lastPurchaseDate ? formatDate(d.lastPurchaseDate) : '—');
    setEl('sp-ov-created', d.createdAt ? formatDate(d.createdAt) : '—');

    const badge = document.getElementById('sp-status-badge');
    if (badge) {
      badge.textContent = d.status === 'active' ? 'Active' : 'Inactive';
      badge.className = 'badge badge-' + (d.status === 'active' ? 'success' : 'muted');
    }
  }

  function _fillSupplierSettings(d) {
    setFormVal('sp-settings-name', d.company_name || '');
    setFormVal('sp-settings-company', d.contact_person || '');
    setFormVal('sp-settings-phone', d.phone || '');
    setFormVal('sp-settings-whatsapp', d.whatsapp || '');
    setFormVal('sp-settings-email', d.email || '');
    setFormVal('sp-settings-city', d.city || '');
    setFormVal('sp-settings-address', d.address || '');
    setFormVal('sp-settings-opening-balance', d.opening_balance || 0);
    setFormVal('sp-settings-credit-limit', d.creditLimit || 0);
    setFormVal('sp-settings-status', d.status || 'active');
    setFormVal('sp-settings-notes', d.notes || '');

    const bt = document.getElementById('sp-settings-balance-type');
    if (bt) bt.value = d.balanceType || 'payable';
  }

  // ══════════════════════════════════════════════════════════════
  //  OPEN / CLOSE MODULE
  // ══════════════════════════════════════════════════════════════

  async function openModule(type, id, fromRoute) {
    // Handle product and customer types via edit modal
    if (type === 'product') {
      if (typeof editProduct === 'function') editProduct(id);
      return;
    }
    if (type === 'customer') {
      if (typeof editCustomer === 'function') editCustomer(id);
      return;
    }
    if (type !== 'supplier') return;

    if (!_overlay || !_bodyEl) init();

    _Module.isOpen = true;
    _selectedId = id || null;

    // Show overlay & sheet
    _overlay.classList.add('open');
    if (_sheet) _sheet.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Load template
    await _ensureSupplierTemplate();
    _bodyEl.innerHTML = _supplierTemplate;

    // Reset
    const emptyState = document.getElementById('sp-empty-state');
    const profileContent = document.getElementById('sp-profile-content');
    if (emptyState) emptyState.style.display = '';
    if (profileContent) profileContent.style.display = 'none';

    // Load all suppliers into left sidebar
    await _loadAllSuppliers();

    // If supplier ID provided, select it
    if (id) {
      await window.selectSupplier(id, null, null, null, fromRoute);
    } else {
      if (_titleEl) _titleEl.textContent = 'Suppliers';
    }

    // Update URL
    if (!fromRoute) {
      const url = id ? getBasePath() + `/suppliers/${id}` : getBasePath() + '/suppliers';
      window.history.pushState({ module: 'supplier', id: id || null }, '', url);
    }
  }

  function closeModule(silent) {
    if (!_overlay) return;
    _overlay.classList.remove('open');
    if (_sheet) _sheet.classList.remove('open');
    document.body.style.overflow = '';
    _Module.isOpen = false;
    _selectedId = null;

    if (silent === true) return;

    const url = getBasePath() + '/suppliers';
    window.history.pushState({ module: null }, '', url);
  }

  // ── Expose globally ──────────────────────────────────────
  window.openModule   = openModule;
  window.closeModule  = closeModule;

  // ══════════════════════════════════════════════════════════════
  //  TAB SYSTEM
  // ══════════════════════════════════════════════════════════════

  function _switchTab(tabId) {
    _Module.currentTab = tabId;

    const tabs = document.querySelectorAll('.sp-tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-sp-tab="${tabId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    const panels = document.querySelectorAll('.sp-tab-content');
    panels.forEach(p => p.style.display = 'none');
    const activePanel = document.getElementById(`sp-tab-${tabId}`);
    if (activePanel) activePanel.style.display = 'block';

    _loadTabData(tabId);
  }

  window.switchModuleTab = _switchTab;

  function _loadTabData(tabId) {
    if (!_Module.data) return;
    switch (tabId) {
      case 'overview': break;
      case 'purchase-history': _loadPurchaseHistory(); break;
      case 'ledger': _loadLedger(); break;
      case 'payments': _loadPayments(); break;
      case 'products-purchased': _loadProductsPurchased(); break;
      case 'documents': _loadDocuments(); break;
      case 'activity': _loadActivityLog(); break;
      case 'settings': break;
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  PURCHASE HISTORY
  // ══════════════════════════════════════════════════════════════

  let _purchaseData = [];

  async function _loadPurchaseHistory() {
    const tbody = document.getElementById('sp-ph-tbody');
    if (!tbody) return;
    try {
      const res = await API.purchaseInvoices.list({ supplier_id: _Module.data.id });
      const invoices = Array.isArray(res) ? res : (res?.data || []);
      _purchaseData = invoices;
      _renderPurchaseTable(invoices);
    } catch (e) {
      console.error('[modules] Failed to load purchase history', e);
      tbody.innerHTML = `<tr><td colspan="6"><div class="sp-empty"><i class="fa-solid fa-exclamation-triangle"></i><p>Failed to load data</p></div></td></tr>`;
    }
  }

  function _renderPurchaseTable(invoices) {
    const tbody = document.getElementById('sp-ph-tbody');
    const count = document.getElementById('sp-ph-count');
    if (!tbody) return;
    if (count) count.textContent = `${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`;

    if (!invoices.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="sp-empty"><i class="fa-solid fa-cart-shopping"></i><p>No purchase history</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = invoices.map(inv => {
      const statusClass = (inv.status || 'draft').toLowerCase().replace(/\s+/g, '-');
      return `<tr>
        <td><a href="#" onclick="event.preventDefault();alert('View invoice #${esc(inv.invoice_no || inv.id)}')" class="sp-invoice-link" style="color:var(--accent);text-decoration:none;font-weight:600">#${esc(inv.invoice_no || inv.invoiceNumber || inv.id)}</a></td>
        <td>${formatDate(inv.date || inv.created_at)}</td>
        <td>${inv.item_count || inv.items || 0}</td>
        <td style="text-align:right">${formatCurrency(inv.total || inv.total_amount || 0)}</td>
        <td><span class="badge badge-${statusClass}">${esc(inv.status || 'Draft')}</span></td>
        <td>
          <button class="btn btn-secondary btn-xs" onclick="alert('Invoice #${esc(inv.invoice_no || inv.id)}')" title="View Invoice"><i class="fa-solid fa-eye"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  window.spFilterPurchases = function () {
    const search = (document.getElementById('sp-ph-search')?.value || '').toLowerCase();
    const from = document.getElementById('sp-ph-from')?.value || '';
    const to = document.getElementById('sp-ph-to')?.value || '';

    let filtered = _purchaseData;
    if (search) {
      filtered = filtered.filter(inv =>
        (inv.invoice_no || inv.invoiceNumber || '').toLowerCase().includes(search) ||
        (inv.status || '').toLowerCase().includes(search)
      );
    }
    if (from) filtered = filtered.filter(inv => (inv.date || '').split('T')[0] >= from);
    if (to) filtered = filtered.filter(inv => (inv.date || '').split('T')[0] <= to);
    _renderPurchaseTable(filtered);
  };

  // ══════════════════════════════════════════════════════════════
  //  LEDGER
  // ══════════════════════════════════════════════════════════════

  async function _loadLedger() {
    const tbody = document.getElementById('sp-ledger-tbody');
    if (!tbody) return;
    try {
      const res = await API.ledger.list({ entity: 'supplier', entity_id: _Module.data.id });
      const entries = Array.isArray(res) ? res : (res?.data || []);
      const count = document.getElementById('sp-ledger-count');
      if (count) count.textContent = `${entries.length} entr${entries.length !== 1 ? 'ies' : 'y'}`;

      if (!entries.length) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="sp-empty"><i class="fa-solid fa-book"></i><p>No ledger entries yet</p></div></td></tr>`;
        return;
      }

      let balance = 0;
      tbody.innerHTML = entries.map(e => {
        balance += (e.debit || 0) - (e.credit || 0);
        return `<tr>
          <td>${formatDate(e.date || e.created_at)}</td>
          <td>${esc(e.reference || e.description || '—')}</td>
          <td style="text-align:right">${e.debit ? formatCurrency(e.debit) : '—'}</td>
          <td style="text-align:right">${e.credit ? formatCurrency(e.credit) : '—'}</td>
          <td style="text-align:right;font-weight:600">${formatCurrency(balance)}</td>
        </tr>`;
      }).join('');
    } catch (e) {
      console.error('[modules] Failed to load ledger', e);
      tbody.innerHTML = `<tr><td colspan="5"><div class="sp-empty"><i class="fa-solid fa-exclamation-triangle"></i><p>Failed to load ledger</p></div></td></tr>`;
    }
  }

  window.spExportLedger = function (format) {
    alert(`Exporting as ${format.toUpperCase()}... (coming soon)`);
  };

  // ══════════════════════════════════════════════════════════════
  //  PAYMENTS
  // ══════════════════════════════════════════════════════════════

  async function _loadPayments() {
    const tbody = document.getElementById('sp-payments-tbody');
    if (!tbody) return;
    try {
      const res = await API.payments.list({ party_type: 'supplier', party_id: _Module.data.id });
      const payments = Array.isArray(res) ? res : (res?.data || []);
      const count = document.getElementById('sp-payments-count');
      if (count) count.textContent = `${payments.length} payment${payments.length !== 1 ? 's' : ''}`;

      if (!payments.length) {
        tbody.innerHTML = `<tr><td colspan="4"><div class="sp-empty"><i class="fa-solid fa-credit-card"></i><p>No payments recorded</p></div></td></tr>`;
        return;
      }

      tbody.innerHTML = payments.map(p => `<tr>
        <td>${formatDate(p.date || p.created_at)}</td>
        <td>${esc(p.method || p.payment_method || '—')}</td>
        <td>${esc(p.reference || p.reference_no || '—')}</td>
        <td style="text-align:right">${formatCurrency(p.amount || 0)}</td>
      </tr>`).join('');
    } catch (e) {
      console.error('[modules] Failed to load payments', e);
      tbody.innerHTML = `<tr><td colspan="4"><div class="sp-empty"><i class="fa-solid fa-exclamation-triangle"></i><p>Failed to load payments</p></div></td></tr>`;
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  PRODUCTS PURCHASED
  // ══════════════════════════════════════════════════════════════

  async function _loadProductsPurchased() {
    const tbody = document.getElementById('sp-products-tbody');
    if (!tbody) return;
    try {
      const res = await API.get('products-purchased.php', { supplier_id: _Module.data.id });
      const products = Array.isArray(res) ? res : (res?.data || []);
      const count = document.getElementById('sp-products-count');
      if (count) count.textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;

      if (!products.length) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="sp-empty"><i class="fa-solid fa-cube"></i><p>No products purchased yet</p></div></td></tr>`;
        return;
      }

      tbody.innerHTML = products.map(p => `<tr>
        <td><strong>${esc(p.name || p.product_name || '—')}</strong></td>
        <td style="text-align:right">${Number(p.total_qty || p.total_quantity || 0)}</td>
        <td style="text-align:right">${formatCurrency(p.avg_cost || p.average_cost || 0)}</td>
        <td>${formatDate(p.last_purchase_date || p.lastPurchaseDate)}</td>
        <td style="text-align:right">${formatCurrency(p.last_price || p.lastPurchasePrice || 0)}</td>
      </tr>`).join('');
    } catch (e) {
      console.error('[modules] Failed to load products', e);
      tbody.innerHTML = `<tr><td colspan="5"><div class="sp-empty"><i class="fa-solid fa-exclamation-triangle"></i><p>Failed to load products</p></div></td></tr>`;
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  DOCUMENTS
  // ══════════════════════════════════════════════════════════════

  async function _loadDocuments() {
    const list = document.getElementById('sp-docs-list');
    if (!list) return;
    try {
      const res = await API.uploads.list({ entity: 'supplier', entity_id: _Module.data.id });
      const docs = Array.isArray(res) ? res : (res?.data || []);
      if (!docs.length) {
        list.innerHTML = '<div class="sp-empty"><i class="fa-solid fa-folder"></i><p>No documents uploaded yet</p></div>';
        return;
      }

      list.innerHTML = docs.map(d => {
        const icon = d.type?.includes('image') ? 'fa-file-image' : 'fa-file';
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--border)">
          <i class="fa-solid ${icon}" style="color:var(--accent)"></i>
          <span style="flex:1;font-size:13px">${esc(d.name || d.filename || 'Document')}</span>
          <button class="btn btn-secondary btn-xs" onclick="spDeleteDoc(${d.id})"><i class="fa-solid fa-trash"></i></button>
        </div>`;
      }).join('');
    } catch (e) {
      console.error('[modules] Failed to load documents', e);
    }
  }

  window.spDeleteDoc = async function (docId) {
    if (!confirm('Delete this document?')) return;
    try {
      await API.uploads.delete(docId);
      _loadDocuments();
    } catch (e) {
      alert('Failed to delete document');
    }
  };

  // ── Drag & drop upload ─────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
      const dropZone = e.target.closest('#sp-drop-zone');
      if (dropZone) {
        const input = document.getElementById('sp-file-input');
        if (input) input.click();
      }
    });

    document.addEventListener('change', (e) => {
      if (e.target.id === 'sp-file-input') {
        handleDocUpload(e.target.files, _Module.data?.id);
        e.target.value = '';
      }
    });

    document.addEventListener('dragover', (e) => {
      const dz = e.target.closest('#sp-drop-zone');
      if (dz) { e.preventDefault(); dz.classList.add('dragover'); }
    });

    document.addEventListener('dragleave', (e) => {
      const dz = e.target.closest('#sp-drop-zone');
      if (dz) { e.preventDefault(); dz.classList.remove('dragover'); }
    });

    document.addEventListener('drop', (e) => {
      const dz = e.target.closest('#sp-drop-zone');
      if (dz) {
        e.preventDefault();
        dz.classList.remove('dragover');
        handleDocUpload(e.dataTransfer.files, _Module.data?.id);
      }
    });
  });

  async function handleDocUpload(files, supplierId) {
    const docsList = document.getElementById('sp-docs-list');
    if (!docsList || !files.length) return;

    for (const file of files) {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--border)';
      item.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color:var(--accent)"></i> <span style="font-size:13px">${esc(file.name)} — uploading...</span>`;
      docsList.prepend(item);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('supplier_id', supplierId);
        formData.append('entity', 'supplier');
        formData.append('entity_id', supplierId);
        await API.upload(formData);
        item.innerHTML = `<i class="fa-solid fa-file" style="color:var(--success)"></i> <span style="font-size:13px">${esc(file.name)}</span> <span style="color:var(--success);margin-left:auto">✓</span>`;
      } catch (e) {
        item.innerHTML = `<i class="fa-solid fa-file" style="color:var(--danger)"></i> <span style="font-size:13px">${esc(file.name)}</span> <span style="color:var(--danger);margin-left:auto">✗</span>`;
      }
    }
    setTimeout(() => _loadDocuments(), 500);
  }

  // ══════════════════════════════════════════════════════════════
  //  ACTIVITY LOG
  // ══════════════════════════════════════════════════════════════

  async function _loadActivityLog() {
    const timeline = document.getElementById('sp-timeline');
    if (!timeline) return;
    try {
      const res = await API.activity?.list?.({ entity: 'supplier', entity_id: _Module.data.id }) || { data: [] };
      const activities = Array.isArray(res) ? res : (res?.data || []);
      if (!activities.length) {
        timeline.innerHTML = '<div class="sp-empty"><i class="fa-solid fa-clock-rotate-left"></i><p>No activity recorded yet</p></div>';
        return;
      }

      const icons = {
        create: 'fa-plus-circle', update: 'fa-pen-to-square', delete: 'fa-trash-can',
        upload: 'fa-upload', payment: 'fa-money-bill-wave', purchase: 'fa-cart-shopping', default: 'fa-circle',
      };

      timeline.innerHTML = activities.map(a => {
        const icon = icons[a.type] || icons.default;
        const color = a.type === 'delete' ? 'red' : a.type === 'create' ? 'green' : 'blue';
        return `<div class="sp-timeline-item">
          <div class="sp-timeline-icon ${color}"><i class="fa-solid ${icon}"></i></div>
          <div class="sp-timeline-content">
            <div class="sp-timeline-title">${esc(a.title || a.action || 'Action')}</div>
            <div class="sp-timeline-desc">${esc(a.description || a.detail || '')}</div>
            <div class="sp-timeline-time">${formatDate(a.created_at)}</div>
          </div>
        </div>`;
      }).join('');
    } catch (e) {
      console.error('[modules] Failed to load activity', e);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  MORE ACTIONS MENU
  // ══════════════════════════════════════════════════════════════

  window.toggleSupplierMenu = function () {
    const menu = document.getElementById('sp-more-menu');
    if (menu) {
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
      if (menu.style.display === 'block') {
        setTimeout(() => {
          document.addEventListener('click', _closeMenuOnOutside, { once: true });
        }, 10);
      }
    }
  };

  function _closeMenuOnOutside(e) {
    const menu = document.getElementById('sp-more-menu');
    const btn = document.getElementById('sp-more-btn');
    if (menu && !menu.contains(e.target) && !btn?.contains(e.target)) {
      menu.style.display = 'none';
    }
  }

  window.spAction = function (action) {
    const menu = document.getElementById('sp-more-menu');
    if (menu) menu.style.display = 'none';

    if (!_Module.data) return;

    switch (action) {
      case 'purchase_invoice':
        window.location.href = `./pages/purchase_invoices.html?supplier_id=${_Module.data.id}`;
        break;
      case 'payment':
        window.location.href = `./pages/payments.html?party_type=supplier&party_id=${_Module.data.id}`;
        break;
      case 'ledger':
        _switchTab('ledger');
        break;
      case 'statement':
        alert('View Statement — coming soon');
        break;
      case 'print':
        window.print();
        break;
      case 'upload':
        _switchTab('documents');
        break;
      case 'block':
        if (confirm(`Block supplier "${_Module.data.company_name}"?`)) {
          _updateSupplierStatus('inactive');
        }
        break;
      case 'activate':
        _updateSupplierStatus('active');
        break;
      case 'archive':
        if (confirm(`Archive supplier "${_Module.data.company_name}"?`)) {
          _updateSupplierStatus('inactive');
        }
        break;
      case 'delete':
        if (confirm(`DELETE "${_Module.data.company_name}"?\n\nThis CANNOT be undone.`)) {
          _deleteSupplier();
        }
        break;
      default:
        console.warn('[modules] Unknown action:', action);
    }
  };

  async function _updateSupplierStatus(status) {
    try {
      await API.suppliers.update(_Module.data.id, { status });
      _Module.data.status = status;
      _fillSupplierHeader(_Module.data);
      _fillSupplierOverview(_Module.data);
      // Update list
      const idx = _allSuppliers.findIndex(x => x.id === _Module.data.id);
      if (idx >= 0) _allSuppliers[idx].status = status;
      _renderSupplierList();
      alert(`Supplier ${status === 'active' ? 'activated' : 'blocked'} successfully.`);
    } catch (e) {
      alert('Failed to update status');
    }
  }

  async function _deleteSupplier() {
    try {
      await API.suppliers.delete(_Module.data.id);
      // Remove from list
      _allSuppliers = _allSuppliers.filter(x => x.id !== _Module.data.id);
      _filteredSuppliers = [..._allSuppliers];
      _selectedId = null;

      // Show empty state
      const emptyState = document.getElementById('sp-empty-state');
      const profileContent = document.getElementById('sp-profile-content');
      if (emptyState) emptyState.style.display = '';
      if (profileContent) profileContent.style.display = 'none';

      _renderSupplierList();
      if (_titleEl) _titleEl.textContent = 'Suppliers';
      alert('Supplier deleted successfully.');
    } catch (e) {
      alert('Failed to delete supplier');
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  SAVE SETTINGS
  // ══════════════════════════════════════════════════════════════

  window.saveSupplierSettings = async function () {
    const data = {
      company_name: document.getElementById('sp-settings-name')?.value || '',
      contact_person: document.getElementById('sp-settings-company')?.value || '',
      phone: document.getElementById('sp-settings-phone')?.value || '',
      whatsapp: document.getElementById('sp-settings-whatsapp')?.value || '',
      email: document.getElementById('sp-settings-email')?.value || '',
      city: document.getElementById('sp-settings-city')?.value || '',
      address: document.getElementById('sp-settings-address')?.value || '',
      opening_balance: parseFloat(document.getElementById('sp-settings-opening-balance')?.value || 0),
      opening_balance_type: document.getElementById('sp-settings-balance-type')?.value || 'payable',
      credit_limit: parseFloat(document.getElementById('sp-settings-credit-limit')?.value || 0),
      status: document.getElementById('sp-settings-status')?.value || 'active',
      notes: document.getElementById('sp-settings-notes')?.value || '',
    };

    try {
      await API.suppliers.update(_Module.data.id, data);
      // Update local data
      Object.assign(_Module.data, {
        company_name: data.company_name,
        contact_person: data.contact_person,
        phone: data.phone,
        whatsapp: data.whatsapp,
        email: data.email,
        city: data.city,
        address: data.address,
        status: data.status,
        notes: data.notes,
        creditLimit: data.credit_limit,
        balance: data.opening_balance,
        opening_balance: data.opening_balance,
      });

      // Update list
      const idx = _allSuppliers.findIndex(x => x.id === _Module.data.id);
      if (idx >= 0) _allSuppliers[idx] = { ..._Module.data };
      _renderSupplierList();

      _fillSupplierHeader(_Module.data);
      _fillSupplierOverview(_Module.data);
      _fillSupplierStats(_Module.data);

      if (_titleEl) _titleEl.textContent = _Module.data.company_name || 'Supplier Profile';
      alert('Supplier updated successfully!');
      _switchTab('overview');
    } catch (e) {
      alert('Failed to save changes');
    }
  };

  // ══════════════════════════════════════════════════════════════
  //  RENDER SUPPLIER PROFILE (public entry point from app.js)
  // ══════════════════════════════════════════════════════════════

  window.renderSupplierProfile = async function (d) {
    const data = normaliseSupplier(d);
    _Module.data = data;
    _Module.supplierId = data.id;
    _Module.isOpen = true;
    _selectedId = data.id;

    if (!_overlay || !_bodyEl) init();
    _overlay.classList.add('open');
    if (_sheet) _sheet.classList.add('open');
    document.body.style.overflow = 'hidden';

    if (_titleEl) _titleEl.textContent = data.company_name || 'Supplier Profile';

    await _ensureSupplierTemplate();
    _bodyEl.innerHTML = _supplierTemplate;

    // Load suppliers list and select the current one
    await _loadAllSuppliers();

    const emptyState = document.getElementById('sp-empty-state');
    const profileContent = document.getElementById('sp-profile-content');
    if (emptyState) emptyState.style.display = 'none';
    if (profileContent) profileContent.style.display = 'block';

    _fillSupplierProfile(data);
    _renderSupplierList();
  };

  // ── Auto-initialise ─────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
