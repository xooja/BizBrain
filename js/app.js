/**
 * BizBrain — app.js
 * Main application bootstrap.
 * Wires together auth, router, sync, and all page handlers.
 */

// ── App boot ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // ── Step 1: Start the Connection Manager FIRST ────────────
  const connMgr = ConnectionManager.getInstance();
  connMgr.start();

  // ── Step 2: Register service worker ──────────────────────
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (err) {
      console.warn('[SW] Registration failed:', err);
    }
  }

  // ── Step 3: Open IndexedDB ───────────────────────────────
  await DB.open();

  // ── Step 4: Check for existing session ───────────────────
  const hasSession = await Auth.init();

  if (hasSession) {
    showApp(Auth.getUser());
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-shell').style.display    = 'none';
  }

  // Enter key on login
  document.getElementById('login-password')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('login-email')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('login-password')?.focus();
  });
});

// ── Show App ──────────────────────────────────────────────────
function showApp(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').style.display    = 'flex';

  // Set avatar
  const av = document.getElementById('user-avatar');
  if (av) av.textContent = (user?.name || 'U')[0].toUpperCase();

  // Init sync
  Sync.init();

  // Register page handlers
  Router.on('dashboard',        Pages.dashboard);
  Router.on('expenses',         Pages.expenses);
  Router.on('reports',          Pages.reports);
  Router.on('settings',         Pages.settings);
  Router.on('products',         Pages.products);
  Router.on('categories',       Pages.categories);
  Router.on('suppliers',        Pages.suppliers);
  Router.on('customers',        Pages.customers);
  Router.on('purchase_invoices',Pages.purchaseInvoices);
  Router.on('purchase_invoices_create', () => openPurchaseInvoiceModal());
  Router.on('sales_invoices',   Pages.salesInvoices);
  Router.on('purchase_returns', Pages.purchaseReturns);
  Router.on('sales_returns',    Pages.salesReturns);
  Router.on('accounts',         Pages.accounts);
  Router.on('team',             Pages.team);

  // Init router (will navigate to hash page)
  Router.init();

  // Prefetch pages in background
  setTimeout(() => Router.prefetch(), 2000);

  // Pull fresh data in background
  if (navigator.onLine) {
    setTimeout(() => Sync.pullData(), 3000);
  }
}

// ── Sidebar toggle ────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebar-overlay')?.classList.toggle('open');
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal(title, bodyHTML, opts = {}) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML    = bodyHTML;
  document.getElementById('modal-overlay').style.display = 'flex';
  if (opts.wide) document.getElementById('modal-box').style.maxWidth = '780px';
  else           document.getElementById('modal-box').style.maxWidth = '600px';
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('modal-body').innerHTML = '';
}

// ── PIN Verification Dialog ────────────────────────────────────
let _pinResolve = null;

function showPinDialog(message = 'Enter your 4-digit PIN to confirm this action.') {
  return new Promise((resolve) => {
    _pinResolve = resolve;
    document.getElementById('pin-message').textContent = message;
    document.getElementById('pin-input').value = '';
    document.getElementById('pin-error').style.display = 'none';
    document.getElementById('pin-overlay').style.display = 'flex';
    setTimeout(() => document.getElementById('pin-input').focus(), 100);
  });
}

function closePinDialog() {
  document.getElementById('pin-overlay').style.display = 'none';
  if (_pinResolve) { _pinResolve(null); _pinResolve = null; }
}

async function submitPinDialog() {
  const pin = document.getElementById('pin-input').value.trim();
  const errEl = document.getElementById('pin-error');
  const btn = document.getElementById('pin-submit-btn');
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    errEl.textContent = 'Please enter a valid 4-digit PIN';
    errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying…';
  try {
    const res = await API.auth.verifyPin(pin);
    if (res.success && res.data && res.data.verified) {
      document.getElementById('pin-overlay').style.display = 'none';
      if (_pinResolve) { _pinResolve(true); _pinResolve = null; }
    } else {
      errEl.textContent = res.message || 'Incorrect PIN';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm';
      document.getElementById('pin-input').value = '';
      document.getElementById('pin-input').focus();
    }
  } catch (err) {
    errEl.textContent = err.message || 'PIN verification failed';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm';
    document.getElementById('pin-input').value = '';
    document.getElementById('pin-input').focus();
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('pin-overlay').style.display === 'flex') {
    closePinDialog();
  }
});

// ── Toast system ──────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ── Format helpers ────────────────────────────────────────────
const Fmt = {
  currency: (n, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n || 0),
  date:     (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
  dateShort:(d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
  ago:      (d) => {
    if (!d) return '—';
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)   return 'just now';
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return Fmt.dateShort(d);
  },
  initials: (name) => (name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(),
  avatarColor: (str) => {
    const colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899'];
    let hash = 0;
    for (const c of (str || '')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  },
};

// ═══════════════════════════════════════════════════════════
// PAGE HANDLERS
// ═══════════════════════════════════════════════════════════
const Pages = {};

// ── DASHBOARD ─────────────────────────────────────────────────
Pages.dashboard = async function () {
  setEl('stat-revenue',  Fmt.currency(0));
  setEl('stat-clients',  0);
  setEl('stat-projects', 0);
  setEl('stat-pending',  0);

  drawGoogleDashboardCharts();

  const tbody = document.getElementById('recent-clients-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state" style="padding:30px"><i class="fa-solid fa-gauge-high"></i><p>Welcome to BizBrain! Use the sidebar to manage your business.</p></div></td></tr>`;

  const upcomingEl = document.getElementById('upcoming-invoices');
  if (upcomingEl) upcomingEl.innerHTML = `<div class="empty-state" style="padding:30px"><i class="fa-solid fa-clock-rotate-left"></i><p>No pending items</p></div>`;

  const activityEl = document.getElementById('activity-list');
  if (activityEl) activityEl.innerHTML = `<div class="empty-state" style="padding:24px"><i class="fa-solid fa-clock-rotate-left"></i><p>Activity tracking will appear here</p></div>`;
};

let dashboardChartsReady = false;
let googleChartsLoaded = false;

function drawGoogleDashboardCharts() {
  const revenueChart = document.getElementById('revenue-chart');
  const salesMixChart = document.getElementById('sales-mix-chart');
  if (!revenueChart || !salesMixChart) return;

  if (!window.google?.charts) {
    revenueChart.innerHTML = '<div class="chart-fallback">Charts are loading...</div>';
    salesMixChart.innerHTML = '<div class="chart-fallback">Charts are loading...</div>';
    return;
  }

  const renderCharts = () => {
    if (!document.getElementById('revenue-chart')) return;
    const revenueData = google.visualization.arrayToDataTable([
      ['Month', 'Revenue', 'Expenses'],
      ['Jan', 4200, 2600], ['Feb', 5100, 2900], ['Mar', 4700, 3100],
      ['Apr', 6400, 3500], ['May', 5900, 3800], ['Jun', 7300, 4100],
      ['Jul', 6800, 3900], ['Aug', 8200, 4500], ['Sep', 7600, 4200],
      ['Oct', 9100, 5000], ['Nov', 8700, 4700], ['Dec', 10400, 5400]
    ]);
    const revenueOptions = {
      backgroundColor: 'transparent',
      colors: ['#6d5ce7', '#ef7180'],
      areaOpacity: 0.12,
      chartArea: { left: 52, top: 14, width: '88%', height: '76%' },
      legend: { position: 'none' },
      hAxis: { textStyle: { color: '#9299aa', fontSize: 11 }, baselineColor: '#e9ecf3', gridlines: { color: 'transparent' } },
      vAxis: { textStyle: { color: '#9299aa', fontSize: 11 }, gridlines: { color: '#edf0f5' }, baselineColor: 'transparent', format: '$#,##0' },
      lineWidth: 3,
      pointSize: 5,
      curveType: 'function',
      animation: { startup: true, duration: 700, easing: 'out' }
    };
    new google.visualization.AreaChart(revenueChart).draw(revenueData, revenueOptions);

    const salesMixData = google.visualization.arrayToDataTable([
      ['Category', 'Sales'], ['Products', 46], ['Services', 28], ['Subscriptions', 16], ['Other', 10]
    ]);
    const salesMixOptions = {
      backgroundColor: 'transparent',
      colors: ['#6d5ce7', '#31ad7a', '#ee9b45', '#9ba4bb'],
      pieHole: 0.68,
      chartArea: { left: 0, top: 0, width: '100%', height: '100%' },
      legend: { position: 'right', textStyle: { color: '#7d8499', fontSize: 11 } },
      pieSliceText: 'none',
      tooltip: { text: 'percentage' },
      animation: { startup: true, duration: 700, easing: 'out' }
    };
    new google.visualization.PieChart(salesMixChart).draw(salesMixData, salesMixOptions);
    dashboardChartsReady = true;
  };

  if (!googleChartsLoaded) {
    google.charts.load('current', { packages: ['corechart'] });
    google.charts.setOnLoadCallback(() => {
      googleChartsLoaded = true;
      renderCharts();
    });
  } else {
    renderCharts();
  }
}

let chartResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(chartResizeTimer);
  chartResizeTimer = setTimeout(() => {
    if (document.getElementById('revenue-chart')) drawGoogleDashboardCharts();
    if (document.getElementById('reports-order-chart')) {
      drawReportsPerformanceChart(RPT.data.monthSalesTotal, RPT.data.monthPurchTotal, RPT.data.monthExpTotal);
    }
  }, 120);
});

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── EXPENSES ──────────────────────────────────────────────────
Pages.expenses = async function () {
  let expenses = [];
  try { expenses = await DataLayer.expenses.list(); } catch(e) {}
  renderExpensesTable(expenses);

  document.getElementById('expense-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderExpensesTable(expenses.filter(ex => ex.title?.toLowerCase().includes(q) || ex.category?.toLowerCase().includes(q)));
  });
};

function renderExpensesTable(expenses) {
  const tbody = document.getElementById('expenses-tbody');
  if (!tbody) return;
  const total = expenses.reduce((s, e) => s + (+e.amount || 0), 0);

  const totalEl = document.getElementById('expense-total');
  if (totalEl) totalEl.textContent = Fmt.currency(total);

  if (!expenses.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fa-solid fa-receipt"></i><h3>No expenses yet</h3><p>Track your first expense.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = expenses.map(e => `
    <tr>
      <td data-label="Title"><div class="cell-name">${esc(e.title || e.description || 'Expense')}</div></td>
      <td data-label="Category"><span class="badge badge-info">${esc(e.category || 'General')}</span></td>
      <td style="font-weight:600;color:var(--danger)" data-label="Amount">${Fmt.currency(e.amount)}</td>
      <td data-label="Date">${Fmt.date(e.date || e.created_at)}</td>
      <td data-label="Actions">
        <div class="table-actions">
          <button class="action-btn edit"   onclick="editExpense('${e.id}')"   title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="action-btn delete" onclick="deleteExpense('${e.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function openExpenseModal(expense = null) {
  const isEdit   = !!expense;
  const cats     = ['Travel','Software','Hardware','Marketing','Office','Utilities','Meals','Other'];

  openModal(isEdit ? 'Edit Expense' : 'Add Expense', `
    <div class="form-group">
      <label>Title *</label>
      <div class="input-wrap"><i class="fa-solid fa-receipt"></i>
        <input type="text" id="ex-title" value="${esc(expense?.title || '')}" placeholder="Flight to NYC" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Amount ($) *</label>
        <div class="input-wrap"><i class="fa-solid fa-dollar-sign"></i>
          <input type="number" id="ex-amount" value="${expense?.amount || ''}" placeholder="0.00" step="0.01" />
        </div>
      </div>
      <div class="form-group">
        <label>Date</label>
        <div class="input-wrap"><i class="fa-solid fa-calendar"></i>
          <input type="date" id="ex-date" value="${expense?.date?.slice(0,10) || new Date().toISOString().slice(0,10)}" />
        </div>
      </div>
    </div>
    <div class="form-group">
      <label>Category</label>
      <select id="ex-cat" style="max-width:200px">
        ${cats.map(c => `<option value="${c}" ${expense?.category===c?'selected':''}>${c}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Notes</label>
      <textarea id="ex-notes" placeholder="Additional details…">${esc(expense?.notes || '')}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary"   onclick="saveExpense(${isEdit ? `'${expense.id}'` : 'null'})">
        <i class="fa-solid fa-check"></i> ${isEdit ? 'Save Changes' : 'Add Expense'}
      </button>
    </div>`);
}

window.editExpense = async function(id) {
  const e = await DataLayer.expenses.get(id);
  if (e) openExpenseModal(e);
};

window.saveExpense = async function(id) {
  const title  = document.getElementById('ex-title').value.trim();
  const amount = +document.getElementById('ex-amount').value;
  if (!title)  { showToast('Title is required', 'error'); return; }
  if (!amount) { showToast('Amount is required', 'error'); return; }
  const record = {
    id:         id || undefined,
    title, amount,
    date:       document.getElementById('ex-date').value,
    category:   document.getElementById('ex-cat').value,
    notes:      document.getElementById('ex-notes').value.trim(),
    created_at: id ? undefined : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  try {
    await DataLayer.expenses.save(record, !id);
    closeModal();
    showToast(id ? 'Expense updated' : 'Expense added', 'success');
    await Pages.expenses();
  } catch (err) { showToast(err.message || 'Save failed', 'error'); }
};

window.deleteExpense = async function(id) {
  const verified = await showPinDialog('Enter your PIN to delete this expense.');
  if (!verified) return;
  try {
    await DataLayer.expenses.delete(id);
    showToast('Expense deleted', 'success');
    await Pages.expenses();
  } catch (err) { showToast('Delete failed', 'error'); }
};

// ── REPORTS & ANALYTICS ────────────────────────────────────────
Pages.reports = async function () {
  // Load all data in parallel
  let expenses = [], products = [], salesInvs = [], purchInvs = [], customers = [], suppliers = [];
  try {
    [expenses, products, customers, suppliers] = await Promise.all([
      DataLayer.expenses.list().catch(() => []),
      (async () => { try { const r = await API.products.list(); return Array.isArray(r) ? r : (r?.data || []); } catch(_) { try { return await DB.getAll('products'); } catch(_2) { return []; } } })(),
      (async () => { try { const r = await API.customers.list(); return Array.isArray(r) ? r : (r?.data || []); } catch(_) { try { return await DB.getAll('customers'); } catch(_2) { return []; } } })(),
      (async () => { try { const r = await API.suppliers.list(); return Array.isArray(r) ? r : (r?.data || []); } catch(_) { try { return await DB.getAll('suppliers'); } catch(_2) { return []; } } })(),
    ]);
  } catch(e) {}

  try { salesInvs = (await API.salesInvoices.list().catch(() => [])) || []; if (!Array.isArray(salesInvs)) salesInvs = salesInvs?.data || []; } catch(e) { salesInvs = []; }
  try { purchInvs = (await API.purchaseInvoices.list().catch(() => [])) || []; if (!Array.isArray(purchInvs)) purchInvs = purchInvs?.data || []; } catch(e) { purchInvs = []; }

  // Compute today & this month
  const now = new Date();
  const todayStr = now.toISOString().slice(0,10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);

  const todaySales     = salesInvs.filter(i => (i.date || i.created_at || '').slice(0,10) === todayStr);
  const todayPurch     = purchInvs.filter(i => (i.date || i.created_at || '').slice(0,10) === todayStr);
  const todayExpenses  = expenses.filter(e => (e.date || e.created_at || '').slice(0,10) === todayStr);
  const todaySalesTotal  = todaySales.reduce((s, i) => s + parseFloat(i.total || i.grand_total || 0), 0);
  const todayPurchTotal  = todayPurch.reduce((s, i) => s + parseFloat(i.total || i.grand_total || 0), 0);
  const todayExpTotal    = todayExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const todayProfit      = todaySalesTotal - todayPurchTotal - todayExpTotal;

  const monthSales    = salesInvs.filter(i => (i.date || i.created_at || '').slice(0,7) === todayStr.slice(0,7));
  const monthPurch    = purchInvs.filter(i => (i.date || i.created_at || '').slice(0,7) === todayStr.slice(0,7));
  const monthExpenses = expenses.filter(e => (e.date || e.created_at || '').slice(0,7) === todayStr.slice(0,7));
  const monthSalesTotal  = monthSales.reduce((s, i) => s + parseFloat(i.total || i.grand_total || 0), 0);
  const monthPurchTotal  = monthPurch.reduce((s, i) => s + parseFloat(i.total || i.grand_total || 0), 0);
  const monthExpTotal    = monthExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const monthNetProfit   = monthSalesTotal - monthPurchTotal - monthExpTotal;

  const totalReceivables = customers.reduce((s, c) => s + Math.max(0, parseFloat(c.balance || c.current_balance || 0)), 0);
  const totalPayables    = suppliers.reduce((s, su) => s + Math.max(0, parseFloat(su.current_balance || 0)), 0);
  const lowStockCount    = products.filter(p => parseFloat(p.stock || p.stock_quantity || 0) <= parseFloat(p.min_stock || 5)).length;

  // Update stats
  setEl('rpt-total-reports', salesInvs.length || 467);
  setEl('rpt-today-summary', Fmt.currency(todaySalesTotal || 35546));
  setEl('rpt-today-exp',     todaySales.length || 467);
  setEl('rpt-today-profit',  Fmt.currency(todayProfit));
  setEl('rpt-month-summary', Fmt.currency(monthSalesTotal || 1679));
  setEl('rpt-month-purch',   Fmt.currency(monthNetProfit));
  setEl('rpt-month-profit',  Fmt.currency(monthNetProfit));
  setEl('rpt-performance-profit', Fmt.currency(monthNetProfit));
  setEl('rpt-performance-sales', Fmt.currency(monthSalesTotal));
  setEl('rpt-performance-expenses', Fmt.currency(monthExpTotal));
  drawReportsPerformanceChart(monthSalesTotal, monthPurchTotal, monthExpTotal);

  // Quick report cards
  setEl('rpt-qs-today-sales',   Fmt.currency(todaySalesTotal));
  setEl('rpt-qs-today-purch',   Fmt.currency(todayPurchTotal));
  setEl('rpt-qs-today-exp',     Fmt.currency(todayExpTotal));
  setEl('rpt-qs-today-profit',  Fmt.currency(todayProfit));
  setEl('rpt-qs-receivables',   Fmt.currency(totalReceivables));
  setEl('rpt-qs-payables',      Fmt.currency(totalPayables));
  setEl('rpt-qs-low-stock',     lowStockCount);
  setEl('rpt-qs-month',         Fmt.currency(monthNetProfit));

  // Store data for RPT module
  Object.assign(RPT.data, { expenses, products, customers, suppliers, salesInvs, purchInvs,
    todaySalesTotal, todayPurchTotal, todayExpTotal, todayProfit,
    monthSalesTotal, monthPurchTotal, monthExpTotal, monthNetProfit,
    totalReceivables, totalPayables, lowStockCount });

  // Populate filter dropdowns
  RPT.populateFilters();

  // Wire search
  const searchEl = document.getElementById('rpt-search');
  if (searchEl) {
    searchEl.removeEventListener('input', RPT._onSearch);
    searchEl.addEventListener('input', RPT._onSearch);
  }

  // Initial render
  RPT.currentFilter = 'all';
  RPT.renderReportList();
  RPT.loadFavorites();
  RPT.loadRecent();
  if (!RPT.currentReport && RPT.reports.length) RPT.openReport(RPT.reports[0].id);
};

function drawReportsPerformanceChart(monthSalesTotal, monthPurchTotal, monthExpTotal) {
  const chartElement = document.getElementById('reports-performance-chart');
  const orderElement = document.getElementById('reports-order-chart');
  const salesElement = document.getElementById('reports-sales-chart');
  if ((!chartElement && !orderElement && !salesElement) || !window.google?.charts) return;
  const renderChart = () => {
    if (!document.getElementById('reports-order-chart') && !document.getElementById('reports-sales-chart')) return;
    const sales = monthSalesTotal || 7200;
    const purchases = monthPurchTotal || 4200;
    const expenses = monthExpTotal || 1800;
    const data = google.visualization.arrayToDataTable([
      ['Month', 'Sales', 'Purchases', 'Expenses'],
      ['Jan', sales * .66, purchases * .62, expenses * .70],
      ['Feb', sales * .72, purchases * .69, expenses * .78],
      ['Mar', sales * .81, purchases * .76, expenses * .73],
      ['Apr', sales * .76, purchases * .82, expenses * .86],
      ['May', sales * .91, purchases * .88, expenses * .81],
      ['Jun', sales, purchases, expenses]
    ]);
    if (chartElement) new google.visualization.AreaChart(chartElement).draw(data, {
      backgroundColor: 'transparent', colors: ['#6d5ce7', '#31ad7a', '#ee9b45'], areaOpacity: .08,
      chartArea: { left: 48, top: 12, width: '91%', height: '78%' },
      legend: { position: 'top', alignment: 'end', textStyle: { color: '#7d8499', fontSize: 11 } },
      hAxis: { textStyle: { color: '#9299aa', fontSize: 11 }, baselineColor: '#edf0f5', gridlines: { color: 'transparent' } },
      vAxis: { textStyle: { color: '#9299aa', fontSize: 11 }, gridlines: { color: '#edf0f5' }, baselineColor: 'transparent', format: '$#,##0' },
      lineWidth: 2, pointSize: 4, curveType: 'function', animation: { startup: true, duration: 650, easing: 'out' }
    });

    if (orderElement) {
      const orderData = google.visualization.arrayToDataTable([
        ['Day', 'Orders', 'Sales'], ['2 Jan', 1000, 420], ['3 Jan', 520, 210], ['4 Jan', 900, 430],
        ['5 Jan', 260, 720], ['6 Jan', 610, 430], ['7 Jan', 180, 680], ['8 Jan', 320, 900]
      ]);
      new google.visualization.ColumnChart(orderElement).draw(orderData, {
        backgroundColor:'transparent', colors:['#328fe0','#8068df'], chartArea:{left:38,top:8,width:'88%',height:'74%'},
        legend:{position:'none'}, bar:{groupWidth:'46%'}, hAxis:{textStyle:{color:'#9299aa',fontSize:10},baselineColor:'#edf0f5'},
        vAxis:{textStyle:{color:'#9299aa',fontSize:10},gridlines:{color:'#edf0f5'},baselineColor:'transparent'},
        animation:{startup:true,duration:600,easing:'out'}
      });
    }
    if (salesElement) {
      const salesData = google.visualization.arrayToDataTable([
        ['Day', 'Sales', 'Profit'], ['SAT', 8, 11], ['SUN', 13, 7], ['MON', 6, 10], ['THU', 10, 14], ['WED', 15, 12], ['THU', 7, 10], ['FRI', 10, 5]
      ]);
      new google.visualization.LineChart(salesElement).draw(salesData, {
        backgroundColor:'transparent', colors:['#328fe0','#4e8750'], chartArea:{left:40,top:8,width:'86%',height:'74%'},
        legend:{position:'none'}, pointSize:3, lineWidth:2, curveType:'function',
        hAxis:{textStyle:{color:'#9299aa',fontSize:10},baselineColor:'#edf0f5'},
        vAxis:{textStyle:{color:'#9299aa',fontSize:10},gridlines:{color:'#edf0f5'},baselineColor:'transparent',format:'$#k'},
        animation:{startup:true,duration:600,easing:'out'}
      });
    }
  };
  if (googleChartsLoaded) {
    renderChart();
  } else {
    google.charts.load('current', { packages: ['corechart'] });
    google.charts.setOnLoadCallback(() => {
      googleChartsLoaded = true;
      renderChart();
    });
  }
}

// ═══════════════════════════════════════════════════════════
// REPORTS & ANALYTICS ENGINE (RPT)
// ═══════════════════════════════════════════════════════════
const RPT = {
  data: {
    expenses: [], products: [], customers: [], suppliers: [],
    salesInvs: [], purchInvs: [],
    todaySalesTotal: 0, todayPurchTotal: 0, todayExpTotal: 0, todayProfit: 0,
    monthSalesTotal: 0, monthPurchTotal: 0, monthExpTotal: 0, monthNetProfit: 0,
    totalReceivables: 0, totalPayables: 0, lowStockCount: 0,
  },
  currentReport: null,
  currentFilter: 'all',
  favorites: new Set(),
  recent: [],

  // ── Report Definitions ────────────────────────────────────
  categories: {
    sales: {
      label: 'Sales Reports',
      icon: 'fa-chart-bar',
      iconColor: '#3b82f6',
      bgColor: 'rgba(59,130,246,0.15)',
    },
    purchases: {
      label: 'Purchase Reports',
      icon: 'fa-truck-fast',
      iconColor: '#8b5cf6',
      bgColor: 'rgba(139,92,246,0.15)',
    },
    inventory: {
      label: 'Inventory Reports',
      icon: 'fa-warehouse',
      iconColor: '#10b981',
      bgColor: 'rgba(16,185,129,0.15)',
    },
    customers: {
      label: 'Customer Reports',
      icon: 'fa-users',
      iconColor: '#06b6d4',
      bgColor: 'rgba(6,182,212,0.15)',
    },
    suppliers: {
      label: 'Supplier Reports',
      icon: 'fa-truck',
      iconColor: '#f59e0b',
      bgColor: 'rgba(245,158,11,0.15)',
    },
    financial: {
      label: 'Financial Reports',
      icon: 'fa-coins',
      iconColor: '#ec4899',
      bgColor: 'rgba(236,72,153,0.15)',
    },
    analytics: {
      label: 'Business Analytics',
      icon: 'fa-chart-pie',
      iconColor: '#14b8a6',
      bgColor: 'rgba(20,184,166,0.15)',
    },
  },

  reports: [
    // SALES
    { id: 'daily_sales',       cat: 'sales', name: 'Daily Sales Report',     desc: 'Sales breakdown by day',           icon: 'fa-calendar-day',   color: '#3b82f6' },
    { id: 'weekly_sales',      cat: 'sales', name: 'Weekly Sales Report',    desc: 'Sales trends across weeks',        icon: 'fa-calendar-week',  color: '#3b82f6' },
    { id: 'monthly_sales',     cat: 'sales', name: 'Monthly Sales Report',   desc: 'Monthly revenue analysis',         icon: 'fa-chart-bar',      color: '#3b82f6' },
    { id: 'yearly_sales',      cat: 'sales', name: 'Yearly Sales Report',    desc: 'Annual sales performance',         icon: 'fa-chart-line',     color: '#3b82f6' },
    { id: 'customer_sales',    cat: 'sales', name: 'Customer Wise Sales',    desc: 'Sales grouped by customer',        icon: 'fa-users',          color: '#3b82f6' },
    { id: 'product_sales',     cat: 'sales', name: 'Product Wise Sales',     desc: 'Sales grouped by product',         icon: 'fa-box',            color: '#3b82f6' },
    { id: 'salesman_sales',    cat: 'sales', name: 'Salesman Wise Sales',    desc: 'Sales performance by staff',       icon: 'fa-user-tie',       color: '#3b82f6' },
    { id: 'profit_report',     cat: 'sales', name: 'Profit Report',          desc: 'Profit & margin analysis',         icon: 'fa-coins',          color: '#3b82f6' },
    { id: 'top_products',      cat: 'sales', name: 'Top Selling Products',   desc: 'Best performing products',         icon: 'fa-trophy',         color: '#3b82f6' },

    // PURCHASES
    { id: 'daily_purchases',   cat: 'purchases', name: 'Daily Purchases',        desc: 'Purchase transactions by day',     icon: 'fa-cart-shopping',  color: '#8b5cf6' },
    { id: 'monthly_purchases', cat: 'purchases', name: 'Monthly Purchases',      desc: 'Monthly purchase analysis',        icon: 'fa-chart-bar',      color: '#8b5cf6' },
    { id: 'supplier_purch',    cat: 'purchases', name: 'Supplier Wise Purchases',desc: 'Purchases by supplier',            icon: 'fa-truck',          color: '#8b5cf6' },
    { id: 'product_purch',     cat: 'purchases', name: 'Product Wise Purchases', desc: 'Purchases by product',             icon: 'fa-box',            color: '#8b5cf6' },
    { id: 'purch_returns',     cat: 'purchases', name: 'Purchase Return Report',  desc: 'Returned purchase items',          icon: 'fa-rotate-left',    color: '#8b5cf6' },
    { id: 'pending_payments',  cat: 'purchases', name: 'Pending Supplier Payments',desc: 'Outstanding supplier balances',   icon: 'fa-clock',          color: '#8b5cf6' },

    // INVENTORY
    { id: 'current_stock',     cat: 'inventory', name: 'Current Stock Report',     desc: 'Current inventory levels',        icon: 'fa-warehouse',      color: '#10b981' },
    { id: 'low_stock',         cat: 'inventory', name: 'Low Stock Report',         desc: 'Products below minimum stock',    icon: 'fa-triangle-exclamation', color: '#10b981' },
    { id: 'out_of_stock',      cat: 'inventory', name: 'Out Of Stock Report',      desc: 'Zero inventory items',            icon: 'fa-circle-exclamation',  color: '#10b981' },
    { id: 'stock_movement',    cat: 'inventory', name: 'Stock Movement Report',    desc: 'Inventory movement tracking',     icon: 'fa-arrows-rotate',  color: '#10b981' },
    { id: 'stock_valuation',   cat: 'inventory', name: 'Stock Valuation Report',   desc: 'Inventory value assessment',      icon: 'fa-dollar-sign',    color: '#10b981' },
    { id: 'inventory_summary', cat: 'inventory', name: 'Inventory Summary',        desc: 'Complete inventory overview',     icon: 'fa-clipboard-list', color: '#10b981' },

    // CUSTOMERS
    { id: 'customer_ledger',   cat: 'customers', name: 'Customer Ledger',          desc: 'Detailed customer transactions',  icon: 'fa-book',           color: '#06b6d4' },
    { id: 'customer_statement',cat: 'customers', name: 'Customer Statement',       desc: 'Customer balance statement',      icon: 'fa-file-invoice',   color: '#06b6d4' },
    { id: 'receivables',       cat: 'customers', name: 'Outstanding Receivables',   desc: 'Money owed by customers',         icon: 'fa-hand-holding-dollar', color: '#06b6d4' },
    { id: 'customer_history',  cat: 'customers', name: 'Customer Transaction History',desc: 'Complete customer activity',    icon: 'fa-clock-rotate-left', color: '#06b6d4' },
    { id: 'top_customers',     cat: 'customers', name: 'Top Customers',            desc: 'Highest value customers',         icon: 'fa-crown',          color: '#06b6d4' },

    // SUPPLIERS
    { id: 'supplier_ledger',   cat: 'suppliers', name: 'Supplier Ledger',          desc: 'Detailed supplier transactions',  icon: 'fa-book',           color: '#f59e0b' },
    { id: 'supplier_statement',cat: 'suppliers', name: 'Supplier Statement',       desc: 'Supplier balance statement',      icon: 'fa-file-invoice',   color: '#f59e0b' },
    { id: 'payables',          cat: 'suppliers', name: 'Payables Report',          desc: 'Money owed to suppliers',         icon: 'fa-money-bill-wave', color: '#f59e0b' },
    { id: 'supplier_history',  cat: 'suppliers', name: 'Supplier Transaction History',desc: 'Complete supplier activity',    icon: 'fa-clock-rotate-left', color: '#f59e0b' },

    // FINANCIAL
    { id: 'cash_book',         cat: 'financial', name: 'Cash Book',                desc: 'Cash transaction records',        icon: 'fa-money-bill',     color: '#ec4899' },
    { id: 'bank_book',         cat: 'financial', name: 'Bank Book',                desc: 'Bank transaction records',        icon: 'fa-building-columns', color: '#ec4899' },
    { id: 'income_report',     cat: 'financial', name: 'Income Report',            desc: 'Revenue and income breakdown',    icon: 'fa-arrow-trend-up', color: '#ec4899' },
    { id: 'expense_report',    cat: 'financial', name: 'Expense Report',           desc: 'Expense analysis',                icon: 'fa-arrow-trend-down', color: '#ec4899' },
    { id: 'profit_loss',       cat: 'financial', name: 'Profit & Loss Statement',  desc: 'P&L for the period',              icon: 'fa-scale-balanced', color: '#ec4899' },
    { id: 'balance_sheet',     cat: 'financial', name: 'Balance Sheet',            desc: 'Assets, liabilities, equity',     icon: 'fa-file-invoice',   color: '#ec4899' },
    { id: 'cash_flow',         cat: 'financial', name: 'Cash Flow Report',         desc: 'Cash inflow & outflow',           icon: 'fa-water',          color: '#ec4899' },

    // ANALYTICS
    { id: 'sales_trends',      cat: 'analytics', name: 'Sales Trends',             desc: 'Sales pattern analysis',          icon: 'fa-chart-line',     color: '#14b8a6' },
    { id: 'revenue_trends',    cat: 'analytics', name: 'Revenue Trends',           desc: 'Revenue growth tracking',         icon: 'fa-arrow-trend-up', color: '#14b8a6' },
    { id: 'purch_trends',      cat: 'analytics', name: 'Purchase Trends',          desc: 'Purchase pattern analysis',       icon: 'fa-arrow-trend-down', color: '#14b8a6' },
    { id: 'product_perf',      cat: 'analytics', name: 'Product Performance',      desc: 'Product sales & margin analysis', icon: 'fa-boxes-stacked',  color: '#14b8a6' },
    { id: 'growth_analysis',   cat: 'analytics', name: 'Business Growth Analysis', desc: 'Overall business growth metrics', icon: 'fa-seedling',       color: '#14b8a6' },
  ],

  // ── Search handler ──────────────────────────────────────────
  _onSearch: function(e) {
    const q = e.target.value.trim().toLowerCase();
    RPT.renderReportList(q);
  },

  // ── Filter by category ─────────────────────────────────────
  filterCategory: function(cat) {
    RPT.currentFilter = cat;
    // Update tabs
    document.querySelectorAll('.rpt-tab').forEach(t => t.classList.remove('active'));
    const tab = document.querySelector(`.rpt-tab[data-cat="${cat}"]`);
    if (tab) tab.classList.add('active');
    RPT.renderReportList();
  },

  // ── Render Report List ─────────────────────────────────────
  renderReportList: function(searchTerm) {
    const container = document.getElementById('rpt-report-list');
    if (!container) return;

    const q = searchTerm || ((document.getElementById('rpt-search')?.value || '').trim().toLowerCase());
    const statusEl = document.getElementById('rpt-search-status');
    const termEl   = document.getElementById('rpt-search-term');

    if (q && statusEl && termEl) {
      statusEl.style.display = 'block';
      termEl.textContent = q;
    } else if (statusEl) {
      statusEl.style.display = 'none';
    }

    // Filter by search + category
    let filtered = RPT.reports.filter(r => {
      const matchSearch = !q || r.name.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q);
      const matchCat   = RPT.currentFilter === 'all' || r.cat === RPT.currentFilter;
      return matchSearch && matchCat;
    });

    // Group by category
    const grouped = {};
    filtered.forEach(r => {
      if (!grouped[r.cat]) grouped[r.cat] = [];
      grouped[r.cat].push(r);
    });

    // Update count
    const countEl = document.getElementById('rpt-category-count');
    if (countEl) countEl.textContent = `${filtered.length} report${filtered.length !== 1 ? 's' : ''}`;

    if (!filtered.length) {
      container.innerHTML = `<div class="empty-state" style="padding:40px">
        <i class="fa-solid fa-chart-pie"></i>
        <h3>No reports found</h3>
        <p style="font-size:13px">Try a different search or category filter</p>
      </div>`;
      return;
    }

    const catKeys = Object.keys(RPT.categories);
    let html = '';
    catKeys.forEach(cat => {
      const items = grouped[cat];
      if (!items || !items.length) return;
      const catInfo = RPT.categories[cat];
      html += `<div class="rpt-category">
        <div class="rpt-category-title">
          <i class="fa-solid ${catInfo.icon}" style="color:${catInfo.iconColor}"></i>
          ${catInfo.label}
          <span class="count-badge">${items.length}</span>
        </div>`;
      items.forEach(r => {
        const isActive = RPT.currentReport?.id === r.id;
        const isFav    = RPT.favorites.has(r.id);
        html += `<button class="rpt-item ${isActive ? 'active' : ''}" onclick="RPT.openReport('${r.id}')">
          <div class="rpt-item-icon" style="background:${r.color}20;color:${r.color}">
            <i class="fa-solid ${r.icon}"></i>
          </div>
          <div class="rpt-item-info">
            <div class="rpt-item-name">${esc(r.name)}</div>
            <div class="rpt-item-desc">${esc(r.desc)}</div>
          </div>
          <button class="rpt-item-star ${isFav ? 'active' : ''}" onclick="event.stopPropagation();RPT.toggleFavorite('${r.id}')" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
            <i class="fa-solid fa-star"></i>
          </button>
        </button>`;
      });
      html += `</div>`;
    });

    container.innerHTML = html;
  },

  // ── Open Report ─────────────────────────────────────────────
  openReport: function(id) {
    const report = RPT.reports.find(r => r.id === id);
    if (!report) return;

    RPT.currentReport = report;
    RPT.renderReportList();

    // Show viewer content
    const empty = document.getElementById('rpt-viewer-empty');
    const content = document.getElementById('rpt-viewer-content');
    if (empty) empty.style.display = 'none';
    if (content) content.style.display = 'block';

    // Update toolbar
    setEl('rpt-viewer-title', report.name);
    const badge = document.getElementById('rpt-viewer-badge');
    if (badge) {
      const catInfo = RPT.categories[report.cat];
      badge.textContent = catInfo ? catInfo.label : report.cat;
    }

    // Update preview header
    setEl('rpt-preview-subtitle', report.name);
    setEl('rpt-preview-date', 'Generated: ' + new Date().toLocaleString());
    setEl('rpt-preview-period', 'Period: Custom');

    // Set default date range
    const fromEl = document.getElementById('rpt-filter-from');
    const toEl   = document.getElementById('rpt-filter-to');
    if (fromEl && !fromEl.value) {
      const d = new Date();
      d.setDate(1);
      fromEl.value = d.toISOString().slice(0,10);
    }
    if (toEl && !toEl.value) {
      toEl.value = new Date().toISOString().slice(0,10);
    }

    // Generate report content
    RPT.generatePreview(report);

    // Add to recent
    RPT.addRecent(report);
  },

  // ── Generate Preview ───────────────────────────────────────
  generatePreview: function(report) {
    const body = document.getElementById('rpt-preview-body');
    if (!body) return;

    const d = RPT.data;
    let html = '';

    // Summary grid for most reports
    html += `<div class="rpt-summary-grid">`;

    switch (report.id) {
      // ── SALES ──────────────────────────────────────────────
      case 'daily_sales':
      case 'weekly_sales':
      case 'monthly_sales':
      case 'yearly_sales':
      case 'customer_sales':
      case 'salesman_sales':
      case 'profit_report':
        html += `
          <div class="rpt-summary-card"><div class="rpt-s-label">Total Sales</div><div class="rpt-s-value" style="color:var(--accent)">${Fmt.currency(d.monthSalesTotal)}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Total Invoices</div><div class="rpt-s-value">${d.salesInvs.length}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Avg Per Invoice</div><div class="rpt-s-value" style="color:var(--info)">${Fmt.currency(d.salesInvs.length > 0 ? d.monthSalesTotal / d.salesInvs.length : 0)}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">This Month</div><div class="rpt-s-value" style="color:var(--success)">${Fmt.currency(d.monthSalesTotal)}</div></div>`;
        break;

      case 'top_products':
        html += `
          <div class="rpt-summary-card"><div class="rpt-s-label">Total Products</div><div class="rpt-s-value">${d.products.length}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Active Products</div><div class="rpt-s-value" style="color:var(--success)">${d.products.filter(p => (p.status||'active') === 'active').length}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Stock Value</div><div class="rpt-s-value" style="color:var(--info)">${Fmt.currency(d.products.reduce((s, p) => s + (parseFloat(p.purchase_price||0) * parseFloat(p.stock||0)), 0))}</div></div>`;
        break;

      // ── PURCHASES ───────────────────────────────────────────
      case 'daily_purchases':
      case 'monthly_purchases':
      case 'supplier_purch':
      case 'product_purch':
      case 'purch_returns':
        html += `
          <div class="rpt-summary-card"><div class="rpt-s-label">Total Purchases</div><div class="rpt-s-value" style="color:var(--accent-2)">${Fmt.currency(d.monthPurchTotal)}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Purchase Invs</div><div class="rpt-s-value">${d.purchInvs.length}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Suppliers</div><div class="rpt-s-value" style="color:var(--warning)">${d.suppliers.length}</div></div>`;
        break;

      case 'pending_payments':
        html += `
          <div class="rpt-summary-card"><div class="rpt-s-label">Total Payables</div><div class="rpt-s-value" style="color:var(--danger)">${Fmt.currency(d.totalPayables)}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Suppliers</div><div class="rpt-s-value">${d.suppliers.length}</div></div>`;
        break;

      // ── INVENTORY ───────────────────────────────────────────
      case 'current_stock':
      case 'inventory_summary':
        html += `
          <div class="rpt-summary-card"><div class="rpt-s-label">Total Products</div><div class="rpt-s-value">${d.products.length}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Stock Value</div><div class="rpt-s-value" style="color:var(--success)">${Fmt.currency(d.products.reduce((s, p) => s + (parseFloat(p.purchase_price||0) * parseFloat(p.stock||0)), 0))}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Low Stock</div><div class="rpt-s-value" style="color:var(--warning)">${d.lowStockCount}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Out of Stock</div><div class="rpt-s-value" style="color:var(--danger)">${d.products.filter(p => parseFloat(p.stock||0) === 0).length}</div></div>`;
        break;

      case 'low_stock':
        html += `
          <div class="rpt-summary-card"><div class="rpt-s-label">Low Stock Items</div><div class="rpt-s-value" style="color:var(--warning)">${d.lowStockCount}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Total Products</div><div class="rpt-s-value">${d.products.length}</div></div>`;
        break;

      case 'out_of_stock':
        const outCount = d.products.filter(p => parseFloat(p.stock||0) === 0).length;
        html += `
          <div class="rpt-summary-card"><div class="rpt-s-label">Out of Stock</div><div class="rpt-s-value" style="color:var(--danger)">${outCount}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Total Products</div><div class="rpt-s-value">${d.products.length}</div></div>`;
        break;

      case 'stock_valuation':
        const totalVal = d.products.reduce((s, p) => s + (parseFloat(p.purchase_price||0) * parseFloat(p.stock||0)), 0);
        const saleVal  = d.products.reduce((s, p) => s + (parseFloat(p.sale_price||0) * parseFloat(p.stock||0)), 0);
        html += `
          <div class="rpt-summary-card"><div class="rpt-s-label">Cost Value</div><div class="rpt-s-value" style="color:var(--danger)">${Fmt.currency(totalVal)}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Sale Value</div><div class="rpt-s-value" style="color:var(--success)">${Fmt.currency(saleVal)}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Potential Profit</div><div class="rpt-s-value" style="color:var(--accent)">${Fmt.currency(saleVal - totalVal)}</div></div>`;
        break;

      // ── CUSTOMERS ───────────────────────────────────────────
      case 'customer_ledger':
      case 'customer_statement':
      case 'customer_history':
        html += `
          <div class="rpt-summary-card"><div class="rpt-s-label">Total Customers</div><div class="rpt-s-value">${d.customers.length}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Receivables</div><div class="rpt-s-value" style="color:var(--warning)">${Fmt.currency(d.totalReceivables)}</div></div>`;
        break;

      case 'receivables':
        html += `
          <div class="rpt-summary-card"><div class="rpt-s-label">Outstanding</div><div class="rpt-s-value" style="color:var(--warning)">${Fmt.currency(d.totalReceivables)}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Customers</div><div class="rpt-s-value">${d.customers.length}</div></div>`;
        break;

      case 'top_customers':
        html += `
          <div class="rpt-summary-card"><div class="rpt-s-label">Total Customers</div><div class="rpt-s-value">${d.customers.length}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Receivables</div><div class="rpt-s-value" style="color:var(--warning)">${Fmt.currency(d.totalReceivables)}</div></div>`;
        break;

      // ── SUPPLIERS ───────────────────────────────────────────
      case 'supplier_ledger':
      case 'supplier_statement':
      case 'supplier_history':
        html += `
          <div class="rpt-summary-card"><div class="rpt-s-label">Total Suppliers</div><div class="rpt-s-value">${d.suppliers.length}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Payables</div><div class="rpt-s-value" style="color:var(--danger)">${Fmt.currency(d.totalPayables)}</div></div>`;
        break;

      case 'payables':
        html += `
          <div class="rpt-summary-card"><div class="rpt-s-label">Total Payables</div><div class="rpt-s-value" style="color:var(--danger)">${Fmt.currency(d.totalPayables)}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Suppliers</div><div class="rpt-s-value">${d.suppliers.length}</div></div>`;
        break;

      // ── FINANCIAL ───────────────────────────────────────────
      case 'cash_book':
      case 'bank_book':
      case 'income_report':
      case 'expense_report':
      case 'profit_loss':
      case 'balance_sheet':
      case 'cash_flow':
        html += `
          <div class="rpt-summary-card"><div class="rpt-s-label">Revenue</div><div class="rpt-s-value" style="color:var(--success)">${Fmt.currency(d.monthSalesTotal)}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Expenses</div><div class="rpt-s-value" style="color:var(--danger)">${Fmt.currency(d.monthExpTotal)}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Net Profit</div><div class="rpt-s-value" style="color:var(--accent)">${Fmt.currency(d.monthNetProfit)}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Purchases</div><div class="rpt-s-value" style="color:var(--warning)">${Fmt.currency(d.monthPurchTotal)}</div></div>`;
        break;

      // ── ANALYTICS ───────────────────────────────────────────
      case 'sales_trends':
      case 'revenue_trends':
      case 'purch_trends':
      case 'product_perf':
      case 'growth_analysis':
        html += `
          <div class="rpt-summary-card"><div class="rpt-s-label">Total Revenue</div><div class="rpt-s-value" style="color:var(--success)">${Fmt.currency(d.monthSalesTotal)}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Total Purchases</div><div class="rpt-s-value" style="color:var(--warning)">${Fmt.currency(d.monthPurchTotal)}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Net Profit</div><div class="rpt-s-value" style="color:var(--accent)">${Fmt.currency(d.monthNetProfit)}</div></div>
          <div class="rpt-summary-card"><div class="rpt-s-label">Expenses</div><div class="rpt-s-value" style="color:var(--danger)">${Fmt.currency(d.monthExpTotal)}</div></div>`;
        break;

      default:
        html += `<div class="rpt-summary-card"><div class="rpt-s-label">Data Loaded</div><div class="rpt-s-value">Ready</div></div>`;
    }

    html += `</div>`;

    // Table preview content
    html += `<div class="table-scroll"><table class="data-table" style="font-size:13px">
      <thead><tr>`;

    switch (report.id) {
      case 'daily_sales':
      case 'monthly_sales':
        html += `<th>Date</th><th>Invoices</th><th>Total Sales</th><th>Status</th>`;
        html += `</tr></thead><tbody>`;
        const salesByDate = {};
        d.salesInvs.forEach(i => {
          const dt = (i.date || i.created_at || '').slice(0,10);
          if (!salesByDate[dt]) salesByDate[dt] = { count: 0, total: 0 };
          salesByDate[dt].count++;
          salesByDate[dt].total += parseFloat(i.total || i.grand_total || 0);
        });
        Object.entries(salesByDate).slice(0, 15).forEach(([dt, info]) => {
          html += `<tr><td>${Fmt.date(dt)}</td><td>${info.count}</td><td style="font-weight:600;color:var(--success)">${Fmt.currency(info.total)}</td><td><span class="badge badge-success">Complete</span></td></tr>`;
        });
        break;

      case 'top_products':
        html += `<th>#</th><th>Product</th><th>Price</th><th>Stock</th><th>Status</th>`;
        html += `</tr></thead><tbody>`;
        const sortedProducts = [...d.products].sort((a, b) => (parseFloat(b.sale_price||0) - parseFloat(a.sale_price||0))).slice(0, 20);
        sortedProducts.forEach((p, i) => {
          const qty = parseFloat(p.stock || p.stock_quantity || 0);
          const stockBadge = qty === 0 ? 'danger' : qty <= parseFloat(p.min_stock||5) ? 'warning' : 'success';
          html += `<tr><td>${i+1}</td><td><div class="cell-name">${esc(p.name)}</div></td><td style="font-weight:600">${Fmt.currency(p.sale_price)}</td><td><span class="badge badge-${stockBadge}">${qty}</span></td><td><span class="badge badge-${(p.status||'active') === 'active' ? 'success' : 'muted'}">${p.status||'active'}</span></td></tr>`;
        });
        break;

      case 'current_stock':
      case 'inventory_summary':
        html += `<th>Product</th><th>SKU</th><th>Stock</th><th>Min Stock</th><th>Price</th><th>Status</th>`;
        html += `</tr></thead><tbody>`;
        d.products.slice(0, 20).forEach(p => {
          const qty = parseFloat(p.stock || p.stock_quantity || 0);
          const min = parseFloat(p.min_stock || 5);
          html += `<tr><td><div class="cell-name">${esc(p.name)}</div></td><td class="muted">${esc(p.sku || '—')}</td><td style="font-weight:600;color:${qty === 0 ? 'var(--danger)' : qty <= min ? 'var(--warning)' : 'var(--success)'}">${qty}</td><td class="muted">${min}</td><td style="font-weight:600">${Fmt.currency(p.purchase_price)}</td><td><span class="badge badge-${(p.status||'active') === 'active' ? 'success' : 'muted'}">${p.status||'active'}</span></td></tr>`;
        });
        break;

      case 'low_stock':
        html += `<th>Product</th><th>Stock</th><th>Min Stock</th><th>Status</th><th>Action</th>`;
        html += `</tr></thead><tbody>`;
        const lowItems = d.products.filter(p => {
          const qty = parseFloat(p.stock || p.stock_quantity || 0);
          return qty > 0 && qty <= parseFloat(p.min_stock || 5);
        }).slice(0, 20);
        lowItems.forEach(p => {
          html += `<tr><td><div class="cell-name">${esc(p.name)}</div></td><td style="font-weight:600;color:var(--warning)">${parseFloat(p.stock||0)}</td><td class="muted">${parseFloat(p.min_stock||5)}</td><td><span class="badge badge-warning">Low Stock</span></td><td><button class="action-btn" onclick="Router.navigate('products')" title="View"><i class="fa-solid fa-eye"></i></button></td></tr>`;
        });
        break;

      case 'out_of_stock':
        html += `<th>Product</th><th>SKU</th><th>Last Updated</th><th>Action</th>`;
        html += `</tr></thead><tbody>`;
        const outItems = d.products.filter(p => parseFloat(p.stock || p.stock_quantity || 0) === 0).slice(0, 20);
        outItems.forEach(p => {
          html += `<tr><td><div class="cell-name">${esc(p.name)}</div></td><td class="muted">${esc(p.sku || '—')}</td><td class="muted">${Fmt.date(p.updated_at || p.created_at)}</td><td><button class="action-btn" onclick="Router.navigate('products')" title="View"><i class="fa-solid fa-eye"></i></button></td></tr>`;
        });
        break;

      case 'customer_ledger':
      case 'customer_statement':
      case 'customer_history':
      case 'top_customers':
        html += `<th>Customer</th><th>Email</th><th>Phone</th><th>Balance</th><th>Status</th>`;
        html += `</tr></thead><tbody>`;
        d.customers.slice(0, 15).forEach(c => {
          const bal = parseFloat(c.balance || c.current_balance || 0);
          html += `<tr><td><div class="cell-name">${esc(c.name || c.company_name || '—')}</div></td><td class="muted">${esc(c.email || '—')}</td><td class="muted">${esc(c.phone || '—')}</td><td style="font-weight:600;color:${bal > 0 ? 'var(--warning)' : 'var(--success)'}">${Fmt.currency(bal)}</td><td><span class="badge badge-${(c.status||'active') === 'active' ? 'success' : 'muted'}">${c.status||'active'}</span></td></tr>`;
        });
        break;

      case 'supplier_ledger':
      case 'supplier_statement':
      case 'supplier_history':
        html += `<th>Supplier</th><th>Contact</th><th>Phone</th><th>Balance</th><th>Status</th>`;
        html += `</tr></thead><tbody>`;
        d.suppliers.slice(0, 15).forEach(s => {
          const bal = parseFloat(s.current_balance || 0);
          html += `<tr><td><div class="cell-name">${esc(s.company_name || '—')}</div></td><td class="muted">${esc(s.contact_person || '—')}</td><td class="muted">${esc(s.phone || '—')}</td><td style="font-weight:600;color:${bal > 0 ? 'var(--warning)' : 'var(--success)'}">${Fmt.currency(bal)}</td><td><span class="badge badge-${(s.status||'active') === 'active' ? 'success' : 'muted'}">${s.status||'active'}</span></td></tr>`;
        });
        break;

      case 'receivables':
        html += `<th>Customer</th><th>Outstanding</th><th>Status</th>`;
        html += `</tr></thead><tbody>`;
        d.customers.filter(c => parseFloat(c.balance || c.current_balance || 0) > 0).slice(0, 15).forEach(c => {
          html += `<tr><td><div class="cell-name">${esc(c.name || c.company_name || '—')}</div></td><td style="font-weight:600;color:var(--warning)">${Fmt.currency(c.balance || c.current_balance)}</td><td><span class="badge badge-${(c.status||'active') === 'active' ? 'success' : 'muted'}">${c.status||'active'}</span></td></tr>`;
        });
        break;

      case 'payables':
      case 'pending_payments':
        html += `<th>Supplier</th><th>Balance</th><th>Status</th>`;
        html += `</tr></thead><tbody>`;
        d.suppliers.filter(s => parseFloat(s.current_balance || 0) > 0).slice(0, 15).forEach(s => {
          html += `<tr><td><div class="cell-name">${esc(s.company_name || '—')}</div></td><td style="font-weight:600;color:var(--danger)">${Fmt.currency(s.current_balance)}</td><td><span class="badge badge-${(s.status||'active') === 'active' ? 'success' : 'muted'}">${s.status||'active'}</span></td></tr>`;
        });
        break;

      case 'stock_valuation':
        html += `<th>Product</th><th>Stock</th><th>Cost Price</th><th>Sale Price</th><th>Total Cost</th><th>Total Sale</th>`;
        html += `</tr></thead><tbody>`;
        d.products.slice(0, 15).forEach(p => {
          const qty = parseFloat(p.stock || 0);
          const cp = parseFloat(p.purchase_price || 0);
          const sp = parseFloat(p.sale_price || 0);
          html += `<tr><td><div class="cell-name">${esc(p.name)}</div></td><td>${qty}</td><td>${Fmt.currency(cp)}</td><td>${Fmt.currency(sp)}</td><td style="font-weight:600">${Fmt.currency(cp * qty)}</td><td style="font-weight:600;color:var(--success)">${Fmt.currency(sp * qty)}</td></tr>`;
        });
        break;

      case 'daily_purchases':
      case 'monthly_purchases':
        html += `<th>Date</th><th>Ref #</th><th>Supplier</th><th>Total</th><th>Status</th>`;
        html += `</tr></thead><tbody>`;
        d.purchInvs.slice(0, 15).forEach(i => {
          html += `<tr><td>${Fmt.date(i.date || i.created_at)}</td><td class="muted">${esc(i.reference || i.invoice_no || '—')}</td><td>${esc(i.supplier_name || '—')}</td><td style="font-weight:600;color:var(--warning)">${Fmt.currency(i.total || i.grand_total)}</td><td><span class="badge badge-${(i.status||'received') === 'paid' ? 'success' : 'warning'}">${i.status||'pending'}</span></td></tr>`;
        });
        break;

      case 'expense_report':
        html += `<th>Date</th><th>Title</th><th>Category</th><th>Amount</th>`;
        html += `</tr></thead><tbody>`;
        d.expenses.slice(0, 20).forEach(e => {
          html += `<tr><td>${Fmt.date(e.date || e.created_at)}</td><td><div class="cell-name">${esc(e.title || e.description || 'Expense')}</div></td><td><span class="badge badge-info">${esc(e.category || 'General')}</span></td><td style="font-weight:600;color:var(--danger)">${Fmt.currency(e.amount)}</td></tr>`;
        });
        break;

      case 'profit_loss':
        html += `<th>Category</th><th>Amount</th>`;
        html += `</tr></thead><tbody>`;
        html += `<tr><td><div class="cell-name">Revenue (Sales)</div></td><td style="font-weight:600;color:var(--success)">${Fmt.currency(d.monthSalesTotal)}</td></tr>`;
        html += `<tr><td><div class="cell-name">Cost of Goods (Purchases)</div></td><td style="font-weight:600;color:var(--warning)">${Fmt.currency(d.monthPurchTotal)}</td></tr>`;
        html += `<tr><td><div class="cell-name">Operating Expenses</div></td><td style="font-weight:600;color:var(--danger)">${Fmt.currency(d.monthExpTotal)}</td></tr>`;
        html += `<tr><td><strong>Net Profit / Loss</strong></td><td style="font-weight:700;color:${d.monthNetProfit >= 0 ? 'var(--success)' : 'var(--danger)'};font-size:15px">${Fmt.currency(d.monthNetProfit)}</td></tr>`;
        break;

      case 'customer_sales':
      case 'product_sales':
        html += `<th>Item</th><th>Count</th><th>Total</th><th>Status</th>`;
        html += `</tr></thead><tbody>`;
        html += `<tr><td colspan="4"><div class="empty-state" style="padding:20px"><p style="font-size:13px">Detailed breakdown available with invoice data</p></div></td></tr>`;
        break;

      default:
        html += `<th>Metric</th><th>Value</th>`;
        html += `</tr></thead><tbody>`;
        html += `<tr><td>Total Revenue</td><td style="font-weight:600;color:var(--success)">${Fmt.currency(d.monthSalesTotal)}</td></tr>`;
        html += `<tr><td>Total Purchases</td><td style="font-weight:600;color:var(--warning)">${Fmt.currency(d.monthPurchTotal)}</td></tr>`;
        html += `<tr><td>Total Expenses</td><td style="font-weight:600;color:var(--danger)">${Fmt.currency(d.monthExpTotal)}</td></tr>`;
        html += `<tr><td>Net Profit</td><td style="font-weight:600;color:${d.monthNetProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">${Fmt.currency(d.monthNetProfit)}</td></tr>`;
        html += `<tr><td>Active Customers</td><td>${d.customers.length}</td></tr>`;
        html += `<tr><td>Active Suppliers</td><td>${d.suppliers.length}</td></tr>`;
        html += `<tr><td>Products</td><td>${d.products.length}</td></tr>`;
    }

    html += `</tbody></table></div>`;

    body.innerHTML = html;

    // Save current data for export
    RPT._currentPreviewHTML = body.innerHTML;
  },

  // ── Refresh Preview ─────────────────────────────────────────
  refreshPreview: function() {
    if (RPT.currentReport) {
      RPT.generatePreview(RPT.currentReport);
      showToast('Report refreshed', 'success');
    }
  },

  // ── Open Quick Report ──────────────────────────────────────
  openQuickReport: function(reportId) {
    const map = {
      'today_sales': 'daily_sales',
      'today_purchases': 'daily_purchases',
      'today_expenses': 'expense_report',
      'today_profit': 'profit_report',
      'pending_receivables': 'receivables',
      'pending_payables': 'payables',
      'low_stock': 'low_stock',
      'month_summary': 'profit_loss',
    };
    const mappedId = map[reportId] || reportId;
    const report = RPT.reports.find(r => r.id === mappedId);
    if (report) {
      RPT.filterCategory(report.cat);
      RPT.openReport(report.id);
    } else {
      showToast('Report not found', 'error');
    }
  },

  // ── View All Reports ───────────────────────────────────────
  viewAllReports: function() {
    RPT.filterCategory('all');
    const searchEl = document.getElementById('rpt-search');
    if (searchEl) searchEl.value = '';
    RPT.renderReportList();
  },

  // ── Populate Filters ──────────────────────────────────────
  populateFilters: function() {
    // Customers
    const custSel = document.getElementById('rpt-filter-customer');
    if (custSel && RPT.data.customers.length) {
      custSel.innerHTML = '<option value="">All Customers</option>' +
        RPT.data.customers.map(c => `<option value="${c.id}">${esc(c.name || c.company_name || 'Unknown')}</option>`).join('');
    }
    // Suppliers
    const suppSel = document.getElementById('rpt-filter-supplier');
    if (suppSel && RPT.data.suppliers.length) {
      suppSel.innerHTML = '<option value="">All Suppliers</option>' +
        RPT.data.suppliers.map(s => `<option value="${s.id}">${esc(s.company_name || s.contact_person || 'Unknown')}</option>`).join('');
    }
  },

  // ── Favorites ──────────────────────────────────────────────
  toggleFavorite: function(id) {
    if (RPT.favorites.has(id)) {
      RPT.favorites.delete(id);
      showToast('Removed from favorites', 'info');
    } else {
      RPT.favorites.add(id);
      showToast('Added to favorites', 'success');
    }
    RPT.renderReportList();
    RPT.loadFavorites();
  },

  loadFavorites: function() {
    const container = document.getElementById('rpt-favorites');
    if (!container) return;

    const favReports = RPT.reports.filter(r => RPT.favorites.has(r.id));
    if (!favReports.length) {
      container.innerHTML = `<div class="empty-state" style="padding:20px">
        <i class="fa-solid fa-star"></i>
        <p style="font-size:13px">Star reports to add favorites</p>
      </div>`;
      return;
    }

    container.innerHTML = `<div class="rpt-fav-list">${
      favReports.map(r => {
        const catInfo = RPT.categories[r.cat];
        return `<div class="rpt-fav-item" onclick="RPT.openReport('${r.id}')">
          <i class="fa-solid fa-star"></i>
          <div class="rpt-fav-name">${esc(r.name)}</div>
          <span class="badge badge-info" style="font-size:9px">${catInfo ? catInfo.label : r.cat}</span>
        </div>`;
      }).join('')
    }</div>`;
  },

  // ── Recent Reports ─────────────────────────────────────────
  addRecent: function(report) {
    RPT.recent = RPT.recent.filter(r => r.id !== report.id);
    RPT.recent.unshift({ id: report.id, name: report.name, time: new Date().toISOString() });
    if (RPT.recent.length > 10) RPT.recent.length = 10;
    RPT.loadRecent();
  },

  loadRecent: function() {
    const container = document.getElementById('rpt-recent');
    if (!container) return;

    if (!RPT.recent.length) {
      container.innerHTML = `<div class="empty-state" style="padding:20px">
        <i class="fa-solid fa-clock-rotate-left"></i>
        <p style="font-size:13px">No recently viewed reports</p>
      </div>`;
      return;
    }

    container.innerHTML = `<div class="rpt-recent-list">${
      RPT.recent.map(r => `<div class="rpt-recent-item" onclick="RPT.openReport('${r.id}')">
        <i class="fa-solid fa-clock-rotate-left" style="color:var(--txt-muted)"></i>
        <div class="rpt-recent-name">${esc(r.name)}</div>
        <div class="rpt-recent-time">${Fmt.ago(r.time)}</div>
      </div>`).join('')
    }</div>`;
  },

  // ── Full Screen ──────────────────────────────────────────────
  toggleFullscreen: function() {
    const fsContainer = document.getElementById('rpt-fullscreen');
    if (!fsContainer || !RPT.currentReport) return;

    const isActive = fsContainer.style.display === 'block';
    if (isActive) {
      fsContainer.style.display = 'none';
      fsContainer.innerHTML = '';
      return;
    }

    const preview = document.getElementById('rpt-preview');
    if (!preview) return;

    fsContainer.style.display = 'block';
    fsContainer.innerHTML = `
      <button class="rpt-fullscreen-close" onclick="RPT.toggleFullscreen()"><i class="fa-solid fa-xmark"></i></button>
      <div style="max-width:1100px;margin:0 auto">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h2 style="font-family:var(--font-head);font-size:22px;font-weight:800">${esc(RPT.currentReport.name)}</h2>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm btn-secondary" onclick="RPT.printReport()"><i class="fa-solid fa-print"></i> Print</button>
            <button class="btn btn-sm btn-primary" onclick="RPT.exportPDF()"><i class="fa-solid fa-file-pdf"></i> PDF</button>
          </div>
        </div>
        ${preview.outerHTML}
      </div>`;
  },

  // ── Export / Print / Copy ─────────────────────────────────
  exportPDF: function() {
    if (!RPT.currentReport) { showToast('Select a report first', 'warning'); return; }
    showToast('PDF export ready — use browser Print → Save as PDF', 'info');
    window.print();
  },

  exportExcel: function() {
    if (!RPT.currentReport) { showToast('Select a report first', 'warning'); return; }
    const body = document.getElementById('rpt-preview-body');
    if (!body) return;
    const table = body.querySelector('table');
    if (!table) { showToast('No table data to export', 'warning'); return; }

    let csv = '\uFEFF';
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('th, td');
      const vals = Array.from(cells).map(c => `"${c.textContent.trim().replace(/"/g, '""')}"`);
      csv += vals.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${RPT.currentReport.id}_${new Date().toISOString().slice(0,10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Excel exported', 'success');
  },

  exportCSV: function() {
    if (!RPT.currentReport) { showToast('Select a report first', 'warning'); return; }
    const body = document.getElementById('rpt-preview-body');
    if (!body) return;
    const table = body.querySelector('table');
    if (!table) { showToast('No table data to export', 'warning'); return; }

    let csv = '\uFEFF';
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('th, td');
      const vals = Array.from(cells).map(c => `"${c.textContent.trim().replace(/"/g, '""')}"`);
      csv += vals.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${RPT.currentReport.id}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV exported', 'success');
  },

  printReport: function() {
    if (!RPT.currentReport) { showToast('Select a report first', 'warning'); return; }
    window.print();
  },

  copyData: function() {
    const body = document.getElementById('rpt-preview-body');
    if (!body) return;
    const table = body.querySelector('table');
    if (!table) { showToast('No data to copy', 'warning'); return; }

    let text = '';
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('th, td');
      text += Array.from(cells).map(c => c.textContent.trim()).join('\t') + '\n';
    });

    navigator.clipboard.writeText(text).then(() => {
      showToast('Data copied to clipboard', 'success');
    }).catch(() => {
      showToast('Failed to copy', 'error');
    });
  },
};

// ── SETTINGS ──────────────────────────────────────────────────
Pages.settings = async function () {
  const user = Auth.getUser();
  if (!user) return;

  // Pre-fill user info
  const nameEl = document.getElementById('s-name');
  const emailEl = document.getElementById('s-email');
  if (nameEl)  nameEl.value  = user.name  || '';
  if (emailEl) emailEl.value = user.email || '';

  // Load cached settings
  const bizName = await DB.getSetting('biz_name', '');
  const currency = await DB.getSetting('currency', 'USD');
  const timezone = await DB.getSetting('timezone', 'UTC');

  const bizEl  = document.getElementById('s-biz-name');
  const curEl  = document.getElementById('s-currency');
  const tzEl   = document.getElementById('s-timezone');
  if (bizEl) bizEl.value = bizName;
  if (curEl) curEl.value = currency;
  if (tzEl)  tzEl.value  = timezone;

  // Pending sync count
  const pending = await Sync.pendingCount();
  const syncEl  = document.getElementById('pending-count');
  if (syncEl) syncEl.textContent = pending;
};

window.saveSettings = async function() {
  const bizName  = document.getElementById('s-biz-name')?.value.trim();
  const currency = document.getElementById('s-currency')?.value;
  const timezone = document.getElementById('s-timezone')?.value;

  await DB.setSetting('biz_name', bizName);
  await DB.setSetting('currency', currency);
  await DB.setSetting('timezone', timezone);

  showToast('Settings saved', 'success');
};

window.forcSync = async function() {
  showToast('Triggering sync…', 'info');
  Sync.trigger();
};

window.clearCache = async function() {
  if (!confirm('Clear all cached data? You will need to re-login.')) return;
  await DB.clear('expenses');
  await DB.clearSession();
  showToast('Cache cleared', 'success');
  setTimeout(() => location.reload(), 1000);
};

// ── Utility ───────────────────────────────────────────────────

/** Escape HTML special chars */
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function statusBadge(s) {
  const map = { active:'success', completed:'info', 'on-hold':'warning', cancelled:'danger' };
  return map[s] || 'muted';
}

function invBadge(s) {
  const map = { paid:'success', sent:'info', pending:'warning', overdue:'danger', draft:'muted', cancelled:'muted' };
  return map[s] || 'muted';
}

// ── NEW ERP MODULES ──────────────────────────────────────────

// ── PRODUCTS ─────────────────────────────────────────────────
// ── Local state ────────────────────────────────────────────────
let _productsAll       = [];
let _productsFiltered  = [];
let _prodPage          = 1;
const _prodPerPage     = 10;
let _prodSelected      = new Set();
let _prodCategories    = [];

Pages.products = async function () {
  _productsAll = [];
  _prodPage    = 1;
  _prodSelected.clear();

  // Load products
  try {
    const res = await API.products.list();
    _productsAll = Array.isArray(res) ? res : (res?.data || []);
  } catch(e) {
    try { _productsAll = await DB.getAll('products'); } catch(_) {}
  }

  // Load categories for filter dropdown
  try {
    const catRes = await API.categories.list();
    _prodCategories = Array.isArray(catRes) ? catRes : (catRes?.data || []);
  } catch(e) {
    try { _prodCategories = await DB.getAll('categories'); } catch(_) {}
  }

  // Populate category filter
  const catFilter = document.getElementById('product-category-filter');
  if (catFilter) {
    const currentVal = catFilter.value;
    catFilter.innerHTML = `<option value="">All Categories</option>` +
      _prodCategories.map(c => `<option value="${esc(c.name||c.id)}">${esc(c.name)}</option>`).join('');
    catFilter.value = currentVal || '';
  }

  // Wire up search, filters, sort
  const searchEl = document.getElementById('product-search');
  const catEl    = document.getElementById('product-category-filter');
  const stockEl  = document.getElementById('product-stock-filter');
  const sortEl   = document.getElementById('product-sort');

  ['input', 'change'].forEach(evt => {
    [searchEl, catEl, stockEl, sortEl].forEach(el => {
      if (el) {
        el.removeEventListener(evt, _onProdFilter);
        el.addEventListener(evt, _onProdFilter);
      }
    });
  });

  _applyProductFilter();
};

function _onProdFilter() {
  _prodPage = 1;
  _prodSelected.clear();
  _applyProductFilter();
}

function _applyProductFilter() {
  const q      = ((document.getElementById('product-search')?.value) || '').toLowerCase();
  const cat    = document.getElementById('product-category-filter')?.value || '';
  const stock  = document.getElementById('product-stock-filter')?.value || '';
  const sort   = document.getElementById('product-sort')?.value || 'name_asc';

  let filtered = _productsAll.filter(p => {
    const matchSearch = (p.name || p.sku || p.barcode || '').toLowerCase().includes(q);
    const matchCat    = !cat || (p.category_name || '') === cat || String(p.category_id) === cat;
    const qty         = parseFloat(p.stock || p.stock_quantity || 0);
    const matchStock  = !stock ||
      (stock === 'instock' && qty > 5) ||
      (stock === 'low' && qty > 0 && qty <= 5) ||
      (stock === 'out' && qty === 0);
    return matchSearch && matchCat && matchStock;
  });

  // Sort
  const sortFns = {
    name_asc:   (a,b) => (a.name||'').localeCompare(b.name||''),
    name_desc:  (a,b) => (b.name||'').localeCompare(a.name||''),
    stock_asc:  (a,b) => parseFloat(a.stock||0) - parseFloat(b.stock||0),
    stock_desc: (a,b) => parseFloat(b.stock||0) - parseFloat(a.stock||0),
    price_asc:  (a,b) => parseFloat(a.purchase_price||0) - parseFloat(b.purchase_price||0),
    price_desc: (a,b) => parseFloat(b.purchase_price||0) - parseFloat(a.purchase_price||0),
  };
  if (sortFns[sort]) filtered.sort(sortFns[sort]);

  _productsFiltered = filtered;

  _renderProductStats();
  _renderProductTable();
  _renderProductPagination();
  _renderLowStockAlerts();
  _renderProductActivity();
  _updateBulkBar();
}

// ── STATS ──────────────────────────────────────────────────────
function _renderProductStats() {
  const total     = _productsAll.length;
  const inStock   = _productsAll.filter(p => parseFloat(p.stock||0) > 5).length;
  const lowStock  = _productsAll.filter(p => { const q = parseFloat(p.stock||0); return q > 0 && q <= 5; }).length;
  const outStock  = _productsAll.filter(p => parseFloat(p.stock||0) === 0).length;
  const stockVal  = _productsAll.reduce((s, p) => s + (parseFloat(p.purchase_price||0) * parseFloat(p.stock||0)), 0);

  const thisMonth = _productsAll.filter(p => {
    if (!p.created_at) return false;
    const d = new Date(p.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const latest = _productsAll.length ? [..._productsAll].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0))[0] : null;

  setEl('prod-total', total);
  setEl('prod-stock-value', Fmt.currency(stockVal));
  setEl('prod-in-stock', inStock);
  setEl('prod-low-stock', lowStock);
  setEl('prod-out-stock', outStock);
  setEl('prod-recent-count', thisMonth.length);
  setEl('prod-latest-name', latest ? esc(latest.name) : '—');
  setEl('prod-count-label', `${_productsFiltered.length} products`);

  // Category breakdown
  const catCounts = {};
  _productsAll.forEach(p => {
    const c = p.category_name || 'Uncategorized';
    catCounts[c] = (catCounts[c] || 0) + 1;
  });
  const breakdownEl = document.getElementById('prod-cat-breakdown');
  if (breakdownEl) {
    const top = Object.entries(catCounts).sort((a,b) => b[1] - a[1]).slice(0, 3);
    breakdownEl.textContent = top.map(([c, n]) => `${c}: ${n}`).join(' · ');
  }
}

// ── TABLE ──────────────────────────────────────────────────────
function _renderProductTable() {
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;

  const start = (_prodPage - 1) * _prodPerPage;
  const end   = start + _prodPerPage;
  const pageItems = _productsFiltered.slice(start, end);

  // Show/hide bulk checkbox column
  const bulkThs = document.querySelectorAll('.bulk-cell');
  const bulkMode = document.getElementById('prod-bulk-select-toggle')?.checked;
  bulkThs.forEach(el => el.style.display = bulkMode ? 'table-cell' : 'none');

  if (!_productsFiltered.length) {
    tbody.innerHTML = `<tr><td colspan="${bulkMode ? 8 : 7}"><div class="empty-state" style="padding:40px"><i class="fa-solid fa-boxes-stacked"></i><h3>No products found</h3><p>Add your first product or adjust filters.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = pageItems.map(p => {
    const qty = parseFloat(p.stock || p.stock_quantity || 0);
    const minStock = parseFloat(p.min_stock || 5);
    const isLow    = qty > 0 && qty <= minStock;
    const isOut    = qty === 0;
    const stockBadge = isOut ? 'danger' : isLow ? 'warning' : 'success';
    const stockLabel = isOut ? 'Out of Stock' : isLow ? 'Low Stock' : qty;

    return `<tr>
      ${bulkMode ? `<td style="width:30px" data-label="Select"><input type="checkbox" class="prod-select" value="${p.id}" ${_prodSelected.has(String(p.id)) ? 'checked' : ''} onchange="toggleProductSelect('${p.id}')" /></td>` : ''}
      <td data-label="Product">
        <div class="cell-avatar">
          <div class="avatar sm" style="background:${Fmt.avatarColor(p.name)}">${Fmt.initials(p.name)}</div>
          <div>
            <div class="cell-name">${esc(p.name)}</div>
            <div class="cell-sub">${esc(p.sku || 'No SKU')}</div>
          </div>
        </div>
      </td>
      <td class="muted" data-label="Category">${esc(p.category_name || '—')}</td>
      <td class="muted" data-label="Purchase Rate">${Fmt.currency(p.purchase_price)}</td>
      <td style="font-weight:600;color:var(--success)" data-label="Sale Rate">${Fmt.currency(p.sale_price)}</td>
      <td data-label="Stock Status"><span class="badge badge-${stockBadge}">${stockLabel}</span></td>
      <td data-label="Status"><span class="badge badge-${(p.status||'active') === 'active' ? 'success' : 'muted'}">${p.status || 'active'}</span></td>
      <td data-label="Actions">
        <div class="table-actions">
          <button class="action-btn" onclick="viewProductDetail('${p.id}')" title="View"><i class="fa-solid fa-arrow-up"></i></button>
          <button class="action-btn view" onclick="viewProductDetail('${p.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
          <button class="action-btn edit" onclick="editProduct('${p.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="action-btn delete" onclick="deleteProduct('${p.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── PAGINATION ─────────────────────────────────────────────────
function _renderProductPagination() {
  const container = document.getElementById('prod-pagination');
  const label     = document.getElementById('prod-showing-label');
  if (!container) return;

  const total   = _productsFiltered.length;
  const pages   = Math.ceil(total / _prodPerPage) || 1;
  const start   = ((_prodPage - 1) * _prodPerPage) + 1;
  const end     = Math.min(_prodPage * _prodPerPage, total);

  if (label) label.textContent = total > 0 ? `Showing ${start}–${end} of ${total}` : 'Showing 0 of 0';

  if (pages <= 1) { container.innerHTML = ''; return; }

  let html = '';
  html += `<button class="page-btn" onclick="_goProdPage(${_prodPage - 1})" ${_prodPage <= 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;
  const range = 2;
  for (let i = Math.max(1, _prodPage - range); i <= Math.min(pages, _prodPage + range); i++) {
    html += `<button class="page-btn ${i === _prodPage ? 'active' : ''}" onclick="_goProdPage(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" onclick="_goProdPage(${_prodPage + 1})" ${_prodPage >= pages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;
  container.innerHTML = html;
}

function _goProdPage(page) {
  _prodPage = page;
  _renderProductTable();
  _renderProductPagination();
  document.getElementById('product-table-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── LOW STOCK ALERTS ──────────────────────────────────────────
function _renderLowStockAlerts() {
  const container = document.getElementById('prod-low-stock-list');
  if (!container) return;

  const lowItems = _productsAll.filter(p => {
    const qty = parseFloat(p.stock || 0);
    const min = parseFloat(p.min_stock || 5);
    return qty > 0 && qty <= min;
  }).sort((a,b) => parseFloat(a.stock||0) - parseFloat(b.stock||0));

  if (!lowItems.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px">
      <i class="fa-solid fa-check-circle" style="color:var(--success);opacity:0.5;font-size:32px"></i>
      <p style="font-size:13px">All products adequately stocked</p>
    </div>`;
    return;
  }

  container.innerHTML = lowItems.slice(0, 6).map(p => {
    const qty = parseFloat(p.stock||0);
    const min = parseFloat(p.min_stock||5);
    const pct = Math.min(100, (qty / min) * 100);
    const barColor = pct < 30 ? 'var(--danger)' : pct < 70 ? 'var(--warning)' : 'var(--success)';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
      <div class="avatar sm" style="background:${Fmt.avatarColor(p.name)};font-size:10px">${Fmt.initials(p.name)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div>
        <div style="height:4px;background:var(--bg-base);border-radius:2px;margin-top:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:2px;transition:width 0.4s ease"></div>
        </div>
      </div>
      <div style="font-size:12px;font-weight:600;color:${barColor}">${qty}/${min}</div>
    </div>`;
  }).join('');

  if (lowItems.length > 6) {
    container.innerHTML += `<div style="text-align:center;padding:8px;font-size:11px;color:var(--txt-muted)">+${lowItems.length - 6} more</div>`;
  }
}

// ── ACTIVITY FEED ──────────────────────────────────────────────
function _renderProductActivity() {
  const feed = document.getElementById('prod-activity-feed');
  if (!feed) return;

  const builtIn = _productsAll.slice(0, 5).map(p => ({
    text: `Product <strong>${esc(p.name)}</strong> ${p.updated_at && p.updated_at !== p.created_at ? 'updated' : 'added'}`,
    time: p.updated_at || p.created_at || new Date().toISOString(),
    icon: 'fa-box',
    color: 'rgba(59,130,246,0.15)',
    iconColor: 'var(--accent)',
  }));

  const allItems = builtIn
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
    .slice(0, 6);

  if (!allItems.length) {
    feed.innerHTML = `<div class="empty-state" style="padding:24px"><i class="fa-solid fa-clock-rotate-left"></i><p style="font-size:13px">No recent activity</p></div>`;
    return;
  }

  feed.innerHTML = allItems.map(a => `
    <div class="activity-item">
      <div class="activity-icon" style="background:${a.color};color:${a.iconColor}">
        <i class="fa-solid ${a.icon}"></i>
      </div>
      <div class="activity-text"><p>${a.text}</p></div>
      <div class="activity-time">${Fmt.ago(a.time)}</div>
    </div>`).join('');
}

// ── BULK SELECT ────────────────────────────────────────────────
window.toggleBulkSelect = function() {
  const checked = document.getElementById('prod-bulk-select-toggle')?.checked;
  const bar     = document.getElementById('prod-bulk-bar');
  const bulkThs = document.querySelectorAll('.bulk-cell');

  bar.style.display = checked ? 'flex' : 'none';
  bulkThs.forEach(el => el.style.display = checked ? 'table-cell' : 'none');

  _prodSelected.clear();
  _updateBulkBar();
  _renderProductTable();
};

window.toggleProductSelect = function(id) {
  const sid = String(id);
  if (_prodSelected.has(sid)) _prodSelected.delete(sid);
  else _prodSelected.add(sid);
  _updateBulkBar();
};

window.toggleSelectAll = function() {
  const checked = document.getElementById('prod-select-all')?.checked;
  const start   = (_prodPage - 1) * _prodPerPage;
  const end     = start + _prodPerPage;
  const pageItems = _productsFiltered.slice(start, end);

  if (checked) {
    pageItems.forEach(p => _prodSelected.add(String(p.id)));
  } else {
    pageItems.forEach(p => _prodSelected.delete(String(p.id)));
  }
  _updateBulkBar();
  // Refresh checkboxes
  document.querySelectorAll('.prod-select').forEach(cb => { cb.checked = _prodSelected.has(cb.value); });
  // Master checkbox state
  const master = document.getElementById('prod-select-all');
  if (master) master.checked = checked;
};

function _updateBulkBar() {
  const countEl = document.getElementById('prod-selected-count');
  if (countEl) countEl.textContent = `${_prodSelected.size} selected`;

  const master = document.getElementById('prod-select-all');
  if (!master) return;
  const start = (_prodPage - 1) * _prodPerPage;
  const end   = start + _prodPerPage;
  const pageItems = _productsFiltered.slice(start, end);
  const allSelected = pageItems.length > 0 && pageItems.every(p => _prodSelected.has(String(p.id)));
  master.checked = allSelected;
  master.indeterminate = _prodSelected.size > 0 && !allSelected;
}

window.bulkDeleteProducts = async function() {
  if (_prodSelected.size === 0) { showToast('No products selected', 'warning'); return; }
  if (!confirm(`Delete ${_prodSelected.size} product(s)? This cannot be undone.`)) return;

  let success = 0, fail = 0;
  for (const id of _prodSelected) {
    try {
      await API.products.delete(id);
      success++;
    } catch(e) { fail++; }
  }
  showToast(`${success} deleted` + (fail ? `, ${fail} failed` : ''), fail ? 'warning' : 'success');
  _prodSelected.clear();
  await Pages.products();
};

window.bulkActivateProducts = async function() {
  if (_prodSelected.size === 0) { showToast('No products selected', 'warning'); return; }
  let success = 0, fail = 0;
  for (const id of _prodSelected) {
    try {
      await API.products.update(id, { status: 'active' });
      success++;
    } catch(e) { fail++; }
  }
  showToast(`${success} activated` + (fail ? `, ${fail} failed` : ''), fail ? 'warning' : 'success');
  _prodSelected.clear();
  await Pages.products();
};

window.bulkDeactivateProducts = async function() {
  if (_prodSelected.size === 0) { showToast('No products selected', 'warning'); return; }
  let success = 0, fail = 0;
  for (const id of _prodSelected) {
    try {
      await API.products.update(id, { status: 'inactive' });
      success++;
    } catch(e) { fail++; }
  }
  showToast(`${success} deactivated` + (fail ? `, ${fail} failed` : ''), fail ? 'warning' : 'success');
  _prodSelected.clear();
  await Pages.products();
};

// ── MODAL: ADD / EDIT PRODUCT ──────────────────────────────────
window.openProductModal = function(product = null) {
  const isEdit = !!product;
  openModal(isEdit ? 'Edit Product' : 'Add Product', `
    <div class="form-row">
      <div class="form-group">
        <label>Product Name *</label>
        <div class="input-wrap"><i class="fa-solid fa-box"></i>
          <input type="text" id="prod-name" value="${esc(product?.name || '')}" placeholder="Product name" />
        </div>
      </div>
      <div class="form-group">
        <label>SKU</label>
        <div class="input-wrap"><i class="fa-solid fa-barcode"></i>
          <input type="text" id="prod-sku" value="${esc(product?.sku || '')}" placeholder="SKU-001" />
        </div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Category</label>
        <select id="prod-category" style="max-width:200px">
          <option value="">Select Category</option>
          ${_prodCategories.map(c => `<option value="${c.id}" ${String(product?.category_id) === String(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Barcode</label>
        <div class="input-wrap"><i class="fa-solid fa-qrcode"></i>
          <input type="text" id="prod-barcode" value="${esc(product?.barcode || '')}" placeholder="Optional barcode" />
        </div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Purchase Price *</label>
        <div class="input-wrap"><i class="fa-solid fa-dollar-sign"></i>
          <input type="number" id="prod-purchase-price" value="${product?.purchase_price || ''}" step="0.01" placeholder="0.00" />
        </div>
      </div>
      <div class="form-group">
        <label>Sale Price *</label>
        <div class="input-wrap"><i class="fa-solid fa-tag"></i>
          <input type="number" id="prod-sale-price" value="${product?.sale_price || ''}" step="0.01" placeholder="0.00" />
        </div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Stock Quantity</label>
        <div class="input-wrap"><i class="fa-solid fa-cubes"></i>
          <input type="number" id="prod-stock" value="${product?.stock || product?.stock_quantity || 0}" step="1" min="0" />
        </div>
      </div>
      <div class="form-group">
        <label>Min Stock Level</label>
        <div class="input-wrap"><i class="fa-solid fa-triangle-exclamation"></i>
          <input type="number" id="prod-min-stock" value="${product?.min_stock || 5}" step="1" min="0" />
        </div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Status</label>
        <select id="prod-status" style="max-width:150px">
          <option value="active" ${product?.status !== 'inactive' ? 'selected' : ''}>Active</option>
          <option value="inactive" ${product?.status === 'inactive' ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
      <div class="form-group">
        <label>Unit</label>
        <div class="input-wrap"><i class="fa-solid fa-ruler"></i>
          <input type="text" id="prod-unit" value="${esc(product?.unit || '')}" placeholder="pcs, kg, box" />
        </div>
      </div>
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="prod-description" placeholder="Product description…">${esc(product?.description || '')}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveProduct(${isEdit ? `'${product.id}'` : 'null'})">
        <i class="fa-solid fa-check"></i> ${isEdit ? 'Save Changes' : 'Add Product'}
      </button>
    </div>`);
};

window.saveProduct = async function(id) {
  const name = document.getElementById('prod-name')?.value.trim();
  const purchasePrice = parseFloat(document.getElementById('prod-purchase-price')?.value || 0);
  const salePrice     = parseFloat(document.getElementById('prod-sale-price')?.value || 0);

  if (!name) { showToast('Product name is required', 'error'); return; }
  if (!purchasePrice && !salePrice) { showToast('At least one price is required', 'error'); return; }

  const data = {
    name,
    sku:             document.getElementById('prod-sku')?.value.trim() || '',
    category_id:     document.getElementById('prod-category')?.value || null,
    barcode:         document.getElementById('prod-barcode')?.value.trim() || '',
    purchase_price:  purchasePrice,
    sale_price:      salePrice,
    stock:           parseInt(document.getElementById('prod-stock')?.value || 0),
    stock_quantity:  parseInt(document.getElementById('prod-stock')?.value || 0),
    min_stock:       parseInt(document.getElementById('prod-min-stock')?.value || 5),
    status:          document.getElementById('prod-status')?.value || 'active',
    unit:            document.getElementById('prod-unit')?.value.trim() || '',
    description:     document.getElementById('prod-description')?.value.trim() || '',
  };

  const btn = document.querySelector('#modal-box .btn-primary');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…'; }

  try {
    if (id) {
      await API.products.update(id, data);
      showToast('Product updated', 'success');
    } else {
      await API.products.create(data);
      showToast('Product created', 'success');
    }
    closeModal();
    await Pages.products();
  } catch (e) {
    // Offline fallback — save to IndexedDB
    // Catch: network errors (status 0), offline flag, 401/Unauthorized (no PHP session), or !navigator.onLine
    if (e.offline || e.status === 0 || e.status === 401 || !navigator.onLine) {

      try {
        const localId = DB.localId();
        const productData = {
          id: localId,
          ...data,
          user_id: Auth.getUser()?.id || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          synced: 0,
        };
        await DB.put('products', productData);
        try { await DB.enqueue('products', id ? 'update' : 'create', data); } catch(_) {}
        showToast('Saved offline — will sync when online', 'warning');

        _productsAll.unshift(productData);
        closeModal();
        _applyProductFilter();
      } catch(dbErr) {
        showToast('Could not save: ' + (dbErr.message || 'Local storage error'), 'error');
      }
    } else {
      showToast(e.message || 'Save failed', 'error');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = id ? '<i class="fa-solid fa-check"></i> Save Changes' : '<i class="fa-solid fa-check"></i> Add Product'; }
  }
};


// ── VIEW PRODUCT DETAIL ──────────────────────────────────────
window.viewProductDetail = async function(id) {
  openModule('product', id);
};

// ── EDIT PRODUCT ──────────────────────────────────────────────
window.editProduct = async function(id) {
  let product = _productsAll.find(p => String(p.id) === String(id));
  if (!product) {
    try {
      const res = await API.products.get(id);
      product = res?.data || res;
    } catch(e) {
      showToast('Could not load product', 'error');
      return;
    }
  }
  if (product) openProductModal(product);
};

// ── DELETE PRODUCT ────────────────────────────────────────────
window.deleteProduct = async function(id) {
  if (!confirm('Are you sure you want to delete this product? This cannot be undone.')) return;
  try {
    await API.products.delete(id);
    showToast('Product deleted', 'success');
    await Pages.products();
  } catch(e) {
    showToast('Failed to delete product', 'error');
  }
};

// ── EXPORT CSV ────────────────────────────────────────────────
window.exportProductData = function() {
  if (!_productsAll.length) {
    showToast('No product data to export', 'warning');
    return;
  }

  const headers = ['Name', 'SKU', 'Barcode', 'Category', 'Purchase Price', 'Sale Price', 'Stock', 'Min Stock', 'Unit', 'Status', 'Description'];
  const rows = _productsAll.map(p => [
    escCsv(p.name || ''),
    escCsv(p.sku || ''),
    escCsv(p.barcode || ''),
    escCsv(p.category_name || ''),
    parseFloat(p.purchase_price || 0).toFixed(2),
    parseFloat(p.sale_price || 0).toFixed(2),
    parseFloat(p.stock || p.stock_quantity || 0),
    parseFloat(p.min_stock || 5),
    escCsv(p.unit || ''),
    p.status || 'active',
    escCsv(p.description || ''),
  ]);

  let csv = '\uFEFF' + headers.join(',') + '\n';
  csv += rows.map(r => r.join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `products_export_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Product data exported', 'success');
};

function escCsv(str) {
  if (!str) return '""';
  const s = String(str).replace(/"/g, '""');
  return `"${s}"`;
}


// ── CATEGORIES ───────────────────────────────────────────────
// ── Local state ────────────────────────────────────────────────
let _categoriesAll      = [];
let _categoriesFiltered = [];
let _catPage            = 1;
const _catPerPage       = 10;
let _catActivity        = [];
let _catSelected        = new Set();
let _catEditingId       = null;

Pages.categories = async function () {
  // Load categories
  _categoriesAll = [];
  _catSelected.clear();
  try {
    const res = await API.categories.list();
    _categoriesAll = Array.isArray(res) ? res : (res?.data || []);
  } catch(e) {
    try { _categoriesAll = await DB.getAll('categories'); } catch(_) {}
  }
  _catPage = 1;

  // Load activity from IndexedDB
  try { _catActivity = await DB.getAll('category_activity') || []; } catch(e) { _catActivity = []; }

  // Wire up search + filter + sort
  const searchEl = document.getElementById('category-search');
  const filterEl = document.getElementById('category-status-filter');
  const sortEl   = document.getElementById('category-sort');
  if (searchEl) {
    searchEl.removeEventListener('input', _onCatFilter);
    searchEl.addEventListener('input', _onCatFilter);
  }
  if (filterEl) {
    filterEl.removeEventListener('change', _onCatFilter);
    filterEl.addEventListener('change', _onCatFilter);
  }
  if (sortEl) {
    sortEl.removeEventListener('change', _onCatFilter);
    sortEl.addEventListener('change', _onCatFilter);
  }

  _applyCategoryFilter();
};

// ── SEARCH / FILTER / SORT ──────────────────────────────────────
function _onCatFilter() {
  _catPage = 1;
  _applyCategoryFilter();
}

function _applyCategoryFilter() {
  const q      = ((document.getElementById('category-search')?.value) || '').toLowerCase();
  const status = document.getElementById('category-status-filter')?.value || '';
  const sort   = document.getElementById('category-sort')?.value || 'name_asc';

  _categoriesFiltered = _categoriesAll.filter(c => {
    const matchSearch = (c.name || c.description || '').toLowerCase().includes(q);
    const matchStatus = !status || (c.status || 'active') === status;
    return matchSearch && matchStatus;
  });

  // Sort
  _categoriesFiltered.sort((a, b) => {
    const prodA = parseInt(a.product_count || 0);
    const prodB = parseInt(b.product_count || 0);
    switch (sort) {
      case 'name_desc':     return (b.name||'').localeCompare(a.name||'');
      case 'products_desc': return prodB - prodA;
      case 'products_asc':  return prodA - prodB;
      case 'newest':        return new Date(b.created_at||0) - new Date(a.created_at||0);
      case 'oldest':        return new Date(a.created_at||0) - new Date(b.created_at||0);
      default:              return (a.name||'').localeCompare(b.name||'');
    }
  });

  _renderCategoryStats();
  _renderCategoryTable();
  _renderCategoryPagination();
  _renderCategoryInsights();
  _renderCategoryActivity();
  _updateCatBulkBar();
}

// ── STATS ──────────────────────────────────────────────────────
function _renderCategoryStats() {
  const total      = _categoriesAll.length;
  const active     = _categoriesAll.filter(c => (c.status||'active') === 'active').length;
  const totalProds = _categoriesAll.reduce((s, c) => s + parseInt(c.product_count || 0), 0);

  const now = new Date();
  const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const thisMonthCats = _categoriesAll.filter(c => {
    if (!c.created_at) return false;
    const d = new Date(c.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonthCats = _categoriesAll.filter(c => {
    if (!c.created_at) return false;
    const d = new Date(c.created_at);
    return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
  });
  const activeCount = thisMonthCats.length;
  const lastActive  = lastMonthCats.length;

  // Top category by product count
  const sortedByProd = [..._categoriesAll].sort((a, b) => parseInt(b.product_count||0) - parseInt(a.product_count||0));
  const topCat = sortedByProd[0];

  setEl('cat-total', total);
  setEl('cat-active-count', active);
  setEl('cat-product-count', totalProds);
  setEl('cat-top-category', topCat ? esc(topCat.name) : '—');
  setEl('cat-count-label', `${_categoriesFiltered.length} categories`);

  // Trend
  const trendEl = document.getElementById('cat-active-trend');
  if (trendEl && lastActive > 0) {
    const pct = ((activeCount - lastActive) / lastActive * 100).toFixed(1);
    trendEl.style.display = 'inline-flex';
    trendEl.className = `stat-change ${parseFloat(pct) >= 0 ? 'up' : 'down'}`;
    trendEl.innerHTML = `<i class="fa-solid fa-arrow-${parseFloat(pct) >= 0 ? 'up' : 'down'}"></i> ${Math.abs(pct)}%`;
  } else if (trendEl) {
    trendEl.style.display = 'inline-flex';
    trendEl.className = 'stat-change up';
    trendEl.innerHTML = `<i class="fa-solid fa-minus"></i> 0%`;
  }
}

// ── TABLE ──────────────────────────────────────────────────────
function _renderCategoryTable() {
  const tbody = document.getElementById('categories-tbody');
  if (!tbody) return;

  const start = (_catPage - 1) * _catPerPage;
  const end   = start + _catPerPage;
  const pageItems = _categoriesFiltered.slice(start, end);

  // Show/hide bulk checkbox column
  const bulkThs = document.querySelectorAll('.bulk-cell');
  const bulkMode = document.getElementById('cat-bulk-toggle')?.checked;
  bulkThs.forEach(el => el.style.display = bulkMode ? 'table-cell' : 'none');

  const colCount = bulkMode ? 7 : 6;

  if (!_categoriesFiltered.length) {
    tbody.innerHTML = `<tr><td colspan="${colCount}"><div class="empty-state" style="padding:40px"><i class="fa-solid fa-tags"></i><h3>No categories found</h3><p>Add your first category or adjust filters.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = pageItems.map(c => {
    const statusClass = (c.status||'active') === 'active' ? 'success' : 'muted';
    const catId = c.id || c._id;
    const prodCount = parseInt(c.product_count || 0);
    return `
    <tr>
      ${bulkMode ? `<td data-label="Select"><input type="checkbox" class="cat-checkbox" value="${catId}" ${_catSelected.has(catId) ? 'checked' : ''} onchange="toggleCatSelect('${catId}')" /></td>` : ''}
      <td data-label="Category">
        <div class="cell-avatar">
          <div class="avatar sm" style="background:${Fmt.avatarColor(c.name) || 'var(--accent)'}">${Fmt.initials(c.name)}</div>
          <div>
            <div class="cell-name">${esc(c.name)}</div>
          </div>
        </div>
      </td>
      <td class="muted" data-label="Description">${esc(c.description || '—')}</td>
      <td class="muted" data-label="Products" style="font-weight:600">${prodCount}</td>
      <td data-label="Status"><span class="badge badge-${statusClass}">${c.status || 'active'}</span></td>
      <td class="muted" data-label="Created">${Fmt.date(c.created_at)}</td>
      <td data-label="Actions">
        <div class="table-actions">
          <button class="action-btn view" onclick="viewCategory('${catId}')" title="View"><i class="fa-solid fa-eye"></i></button>
          <button class="action-btn edit" onclick="editCategory('${catId}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="action-btn delete" onclick="deleteCategory('${catId}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── PAGINATION ─────────────────────────────────────────────────
function _renderCategoryPagination() {
  const container = document.getElementById('cat-pagination');
  const label     = document.getElementById('cat-showing-label');
  if (!container) return;

  const total   = _categoriesFiltered.length;
  const pages   = Math.ceil(total / _catPerPage) || 1;
  const start   = ((_catPage - 1) * _catPerPage) + 1;
  const end     = Math.min(_catPage * _catPerPage, total);

  if (label) label.textContent = total > 0 ? `Showing ${start}–${end} of ${total}` : 'Showing 0 of 0';

  if (pages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  html += `<button class="page-btn" onclick="_goCatPage(${_catPage - 1})" ${_catPage <= 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;
  const range = 2;
  for (let i = Math.max(1, _catPage - range); i <= Math.min(pages, _catPage + range); i++) {
    html += `<button class="page-btn ${i === _catPage ? 'active' : ''}" onclick="_goCatPage(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" onclick="_goCatPage(${_catPage + 1})" ${_catPage >= pages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;

  container.innerHTML = html;
}

function _goCatPage(page) {
  _catPage = page;
  _renderCategoryTable();
  _renderCategoryPagination();
  document.getElementById('category-table-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── INSIGHTS (right panel) ────────────────────────────────────
function _renderCategoryInsights() {
  // Most Used Categories
  const mostUsedEl = document.getElementById('cat-most-used');
  if (mostUsedEl) {
    const sorted = [..._categoriesAll].sort((a, b) => parseInt(b.product_count||0) - parseInt(a.product_count||0)).slice(0, 6);
    if (!sorted.length) {
      mostUsedEl.innerHTML = `<div class="empty-state" style="padding:16px"><p style="font-size:12px">No category data</p></div>`;
    } else {
      mostUsedEl.innerHTML = sorted.map(c => `
        <div class="cat-card-mini">
          <div class="cat-count">${parseInt(c.product_count||0)}</div>
          <div class="cat-label">${esc(c.name)}</div>
        </div>
      `).join('');
    }
  }

  // Empty Categories Alert
  const emptySection = document.getElementById('cat-empty-section');
  const emptyList    = document.getElementById('cat-empty-list');
  if (emptySection && emptyList) {
    const emptyCats = _categoriesAll.filter(c => parseInt(c.product_count||0) === 0);
    if (emptyCats.length > 0) {
      emptySection.style.display = 'block';
      emptyList.innerHTML = emptyCats.map(c => `
        <div class="cat-empty-alert">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>${esc(c.name)}</span>
        </div>
      `).join('');
    } else {
      emptySection.style.display = 'none';
    }
  }
}

// ── ACTIVITY FEED ──────────────────────────────────────────────
function _renderCategoryActivity() {
  const feed = document.getElementById('category-activity-feed');
  if (!feed) return;

  const builtIn = _categoriesAll.slice(0, 5).map(c => ({
    type: 'category_added',
    text: `Category <strong>${esc(c.name)}</strong> added`,
    time: c.created_at || new Date().toISOString(),
    icon: 'fa-tags',
    color: 'rgba(59,130,246,0.15)',
    iconColor: 'var(--accent)',
  }));

  const allActivities = [..._catActivity, ...builtIn]
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
    .slice(0, 8);

  if (!allActivities.length) {
    feed.innerHTML = `<div class="empty-state" style="padding:16px"><i class="fa-solid fa-clock-rotate-left" style="font-size:24px"></i><p style="font-size:12px">No recent activity</p></div>`;
    return;
  }

  feed.innerHTML = allActivities.map(a => `
    <div class="activity-item">
      <div class="activity-icon" style="background:${a.color || 'rgba(59,130,246,0.15)'};color:${a.iconColor || 'var(--accent)'}">
        <i class="fa-solid ${a.icon || 'fa-tags'}"></i>
      </div>
      <div class="activity-text">
        <p>${a.text}</p>
      </div>
      <div class="activity-time">${Fmt.ago(a.time)}</div>
    </div>
  `).join('');
}

// ── ADD ACTIVITY ───────────────────────────────────────────────
async function _addCategoryActivity(type, text, icon = 'fa-tags') {
  const entry = {
    id: DB.localId(),
    type,
    text,
    icon,
    time: new Date().toISOString(),
    color: type === 'category_added' ? 'rgba(16,185,129,0.15)' :
           type === 'category_updated' ? 'rgba(59,130,246,0.15)' :
           type === 'category_deleted' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
    iconColor: type === 'category_added' ? 'var(--success)' :
               type === 'category_updated' ? 'var(--accent)' :
               type === 'category_deleted' ? 'var(--danger)' : 'var(--accent)',
  };
  try {
    await DB.put('category_activity', entry);
    _catActivity.unshift(entry);
  } catch(e) {}
}

// ── BULK SELECT ────────────────────────────────────────────────
window.toggleCatBulkSelect = function() {
  const bulkMode = document.getElementById('cat-bulk-toggle')?.checked;
  const bulkBar  = document.getElementById('cat-bulk-bar');
  const bulkThs  = document.querySelectorAll('.bulk-cell');
  if (bulkBar) bulkBar.style.display = bulkMode ? 'flex' : 'none';
  bulkThs.forEach(el => el.style.display = bulkMode ? 'table-cell' : 'none');
  if (!bulkMode) _catSelected.clear();
  _renderCategoryTable();
  _updateCatBulkBar();
};

window.toggleCatSelectAll = function() {
  const checked = document.getElementById('cat-select-all')?.checked;
  const start = (_catPage - 1) * _catPerPage;
  const end   = start + _catPerPage;
  const pageItems = _categoriesFiltered.slice(start, end);
  pageItems.forEach(c => {
    const id = c.id || c._id;
    if (checked) _catSelected.add(id);
    else _catSelected.delete(id);
  });
  _renderCategoryTable();
  _updateCatBulkBar();
};

window.toggleCatSelect = function(id) {
  if (_catSelected.has(id)) _catSelected.delete(id);
  else _catSelected.add(id);
  _updateCatBulkBar();
};

function _updateCatBulkBar() {
  const countEl = document.getElementById('cat-selected-count');
  if (countEl) countEl.textContent = `${_catSelected.size} selected`;
}

window.bulkActivateCategories = async function() {
  if (!_catSelected.size) { showToast('No categories selected', 'warning'); return; }
  let done = 0;
  for (const id of _catSelected) {
    try { await API.categories.update(id, { status: 'active' }); done++; } catch(e) {}
  }
  showToast(`${done} categories activated`, 'success');
  _catSelected.clear();
  await Pages.categories();
};

window.bulkDeactivateCategories = async function() {
  if (!_catSelected.size) { showToast('No categories selected', 'warning'); return; }
  let done = 0;
  for (const id of _catSelected) {
    try { await API.categories.update(id, { status: 'inactive' }); done++; } catch(e) {}
  }
  _catSelected.clear();
  await Pages.categories();
};

window.bulkDeleteCategories = async function() {
  if (!_catSelected.size) { showToast('No categories selected', 'warning'); return; }
  for (const id of _catSelected) {
    try { await API.categories.delete(id); } catch(e) {}
  }
  _catSelected.clear();
  await Pages.categories();
};

// ── MODAL / CRUD ────────────────────────────────────────────────
window.openCategoryModal = function(data) {
  _catEditingId = data?.id || null;
  const isEdit = !!_catEditingId;
  openModal(isEdit ? 'Edit Category' : 'Add Category',
    `<div class="form-group">
       <label>Category Name <span class="required">*</span></label>
       <div class="input-wrap">
         <i class="fa-solid fa-tag"></i>
         <input type="text" id="cat-name" value="${esc(data?.name || '')}" placeholder="e.g. Electronics" />
       </div>
     </div>
     <div class="form-group">
       <label>Description</label>
       <textarea id="cat-desc" rows="3" placeholder="Brief description...">${esc(data?.description || '')}</textarea>
     </div>
     <div class="form-group">
       <label>Status</label>
       <select id="cat-status">
         <option value="active" ${(data?.status||'active') === 'active' ? 'selected' : ''}>Active</option>
         <option value="inactive" ${data?.status === 'inactive' ? 'selected' : ''}>Inactive</option>
       </select>
     </div>
     <div class="modal-footer">
       <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="saveCategory()">${isEdit ? 'Update' : 'Save'}</button>
     </div>`
  );
};

window.saveCategory = async function() {
  const name  = document.getElementById('cat-name')?.value.trim();
  const desc  = document.getElementById('cat-desc')?.value.trim();
  const status = document.getElementById('cat-status')?.value || 'active';
  if (!name) { showToast('Category name required', 'error'); return; }

  if (_catEditingId) {
    // Update
    try {
      await API.categories.update(_catEditingId, { name, description: desc, status });
      closeModal();
      showToast('Category updated', 'success');
      await _addCategoryActivity('category_updated', `Category <strong>${esc(name)}</strong> updated`);
      await Pages.categories();
    } catch(e) {
      showToast('Failed to update category', 'error');
    }
  } else {
    // Create
    try {
      await API.categories.create({ name, description: desc, status });
      closeModal();
      showToast('Category created', 'success');
      await _addCategoryActivity('category_added', `Category <strong>${esc(name)}</strong> added`);
      await Pages.categories();
    } catch(e) {
      showToast('Failed to create category', 'error');
    }
  }
};

window.viewCategory = async function(id) {
  const cat = _categoriesAll.find(c => (c.id||c._id) == id);
  if (!cat) { showToast('Category not found', 'error'); return; }
  openModal(cat.name,
    `<div style="display:flex;flex-direction:column;gap:12px">
       <div style="display:flex;align-items:center;gap:12px">
         <div class="avatar lg" style="background:${Fmt.avatarColor(cat.name) || 'var(--accent)'}">${Fmt.initials(cat.name)}</div>
         <div>
           <div style="font-size:16px;font-weight:700">${esc(cat.name)}</div>
           <div style="font-size:12px;color:var(--txt-muted)"><span class="badge badge-${(cat.status||'active') === 'active' ? 'success' : 'muted'}">${cat.status||'active'}</span></div>
         </div>
       </div>
       <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
         <div class="inv-section" style="padding:16px;margin:0">
           <div style="font-size:11px;color:var(--txt-muted);text-transform:uppercase;letter-spacing:0.5px">Products</div>
           <div style="font-size:24px;font-weight:800;color:var(--accent);margin-top:4px">${parseInt(cat.product_count||0)}</div>
         </div>
         <div class="inv-section" style="padding:16px;margin:0">
           <div style="font-size:11px;color:var(--txt-muted);text-transform:uppercase;letter-spacing:0.5px">Created</div>
           <div style="font-size:14px;font-weight:500;color:var(--txt-primary);margin-top:4px">${Fmt.date(cat.created_at)}</div>
         </div>
       </div>
       <div class="inv-section" style="padding:16px;margin:0">
         <div style="font-size:11px;color:var(--txt-muted);text-transform:uppercase;letter-spacing:0.5px">Description</div>
         <div style="font-size:14px;color:var(--txt-secondary);margin-top:4px">${esc(cat.description) || 'No description'}</div>
       </div>
     </div>
     <div class="modal-footer">
       <button class="btn btn-secondary" onclick="closeModal()">Close</button>
       <button class="btn btn-primary" onclick="closeModal();editCategory('${id}')"><i class="fa-solid fa-pen"></i> Edit</button>
     </div>`
  );
};

window.editCategory = async function(id) {
  const cat = _categoriesAll.find(c => (c.id||c._id) == id);
  if (cat) openCategoryModal(cat);
  else showToast('Category not found', 'error');
};

window.deleteCategory = async function(id) {
  const cat = _categoriesAll.find(c => (c.id||c._id) == id);
  if (!confirm(`Delete category${cat ? ` "${cat.name}"` : ''}? This cannot be undone.`)) return;
  try {
    await API.categories.delete(id);
    showToast('Category deleted', 'success');
    await _addCategoryActivity('category_deleted', `Category <strong>${esc(cat?.name||'Unknown')}</strong> deleted`);
    await Pages.categories();
  } catch(e) {
    showToast('Failed to delete category', 'error');
  }
};

// ── EXPORT / IMPORT ─────────────────────────────────────────────
window.exportCategoryData = function() {
  if (!_categoriesAll.length) { showToast('No categories to export', 'warning'); return; }
  const rows = [['Name','Description','Status','Products','Created']];
  _categoriesAll.forEach(c => {
    rows.push([c.name||'', c.description||'', c.status||'active', parseInt(c.product_count||0), c.created_at||'']);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `categories_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Categories exported', 'success');
};

window.importCategoryCSV = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { showToast('CSV file is empty', 'error'); return; }
    const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
    const nameIdx   = headers.findIndex(h => h === 'name');
    const descIdx   = headers.findIndex(h => h === 'description');
    const statusIdx = headers.findIndex(h => h === 'status');
    if (nameIdx === -1) { showToast('CSV must have a "Name" column', 'error'); return; }

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.replace(/"/g,'').trim());
      const name = vals[nameIdx];
      if (!name) continue;
      try {
        await API.categories.create({
          name,
          description: descIdx >= 0 ? vals[descIdx] : '',
          status: (statusIdx >= 0 && vals[statusIdx] === 'inactive') ? 'inactive' : 'active',
        });
        imported++;
      } catch(e) {}
    }
    showToast(`${imported} categories imported`, 'success');
    await Pages.categories();
  };
  input.click();
};

// ── SUPPLIERS ─────────────────────────────────────────────────
// ── Local state ─────────────────────────────────────────────────
let _suppliersAll      = [];
let _suppliersFiltered = [];
let _supPage           = 1;
const _supPerPage      = 10;
let _supActivity       = [];

Pages.suppliers = async function () {
  // Load suppliers
  _suppliersAll = [];
  try {
    const res = await API.suppliers.list();
    _suppliersAll = Array.isArray(res) ? res : (res?.data || []);
  } catch(e) {
    // Try offline cache
    try { _suppliersAll = await DB.getAll('suppliers'); } catch(_) {}
  }
  _supPage = 1;

  // Load activity from IndexedDB
  try { _supActivity = await DB.getAll('supplier_activity') || []; } catch(e) { _supActivity = []; }

  // Wire up search + filter
  const searchEl = document.getElementById('supplier-search');
  const filterEl = document.getElementById('supplier-status-filter');
  if (searchEl) {
    searchEl.removeEventListener('input', _onSupFilter);
    searchEl.addEventListener('input', _onSupFilter);
  }
  if (filterEl) {
    filterEl.removeEventListener('change', _onSupFilter);
    filterEl.addEventListener('change', _onSupFilter);
  }

  _applySupplierFilter();
};

function _onSupFilter() {
  _supPage = 1;
  _applySupplierFilter();
}

function _applySupplierFilter() {
  const q      = ((document.getElementById('supplier-search')?.value) || '').toLowerCase();
  const status = document.getElementById('supplier-status-filter')?.value || '';

  _suppliersFiltered = _suppliersAll.filter(s => {
    const matchSearch = (s.company_name || s.contact_person || s.email || s.phone || '').toLowerCase().includes(q);
    const matchStatus = !status || (s.status || 'active') === status;
    return matchSearch && matchStatus;
  });

  _renderSupplierStats();
  _renderSupplierTable();
  _renderSupplierPagination();
  _renderSupplierActivity();
}

// ── STATS ──────────────────────────────────────────────────────
function _renderSupplierStats() {
  const total    = _suppliersAll.length;
  const totalBal = _suppliersAll.reduce((s, su) => s + parseFloat(su.current_balance || 0), 0);
  const thisMonth = _suppliersAll.filter(s => {
    if (!s.created_at) return false;
    const d = new Date(s.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const recentCount = thisMonth.length;
  const latestName  = _suppliersAll.length ? _suppliersAll.sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0))[0]?.company_name || '—' : '—';

  // Total paid vs pending (from purchase invoices estimate)
  let totalInvoices = [];
  try { totalInvoices = JSON.parse(sessionStorage.getItem('_supInvoiceCache') || '[]'); } catch(e) {}
  // Refresh invoice cache
  (async () => {
    try {
      const invs = await API.purchaseInvoices.list();
      const arr = Array.isArray(invs) ? invs : (invs?.data || []);
      sessionStorage.setItem('_supInvoiceCache', JSON.stringify(arr));
      totalInvoices = arr;
    } catch(_) {}
    _updatePaymentBar(totalInvoices, totalBal);
  })();

  setEl('sup-total', total);
  setEl('sup-recent-count', recentCount);
  setEl('sup-latest-name', esc(latestName));
  setEl('sup-balance-total', Fmt.currency(totalBal));
  setEl('sup-count-label', `${_suppliersFiltered.length} suppliers`);

  // Trend (compare to last month)
  const now = new Date();
  const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const lastMonthCount = _suppliersAll.filter(s => {
    if (!s.created_at) return false;
    const d = new Date(s.created_at);
    return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
  }).length;
  const trendEl = document.getElementById('sup-trend');
  if (trendEl && lastMonthCount > 0) {
    const pct = ((recentCount - lastMonthCount) / lastMonthCount * 100).toFixed(1);
    trendEl.style.display = 'inline-flex';
    trendEl.className = `stat-change ${parseFloat(pct) >= 0 ? 'up' : 'down'}`;
    trendEl.innerHTML = `<i class="fa-solid fa-arrow-${parseFloat(pct) >= 0 ? 'up' : 'down'}"></i> ${Math.abs(pct)}%`;
  } else if (trendEl) {
    trendEl.style.display = 'none';
  }

  _updatePaymentBar(totalInvoices, totalBal);
}

function _updatePaymentBar(invoices, totalBal) {
  const bar = document.getElementById('sup-payment-bar');
  if (!bar) return;
  if (!invoices.length && totalBal === 0) {
    bar.style.width = '0%';
    return;
  }
  const totalInv = invoices.reduce((s, i) => s + parseFloat(i.total || 0), 0);
  const paid     = invoices.reduce((s, i) => s + parseFloat(i.paid_amount || 0), 0);
  const ratio    = totalInv > 0 ? (paid / totalInv) : 0;
  bar.style.width = `${Math.min(100, Math.round(ratio * 100))}%`;
}

// ── TABLE ──────────────────────────────────────────────────────
function _renderSupplierTable() {
  const tbody = document.getElementById('suppliers-tbody');
  if (!tbody) return;

  const start = (_supPage - 1) * _supPerPage;
  const end   = start + _supPerPage;
  const pageItems = _suppliersFiltered.slice(start, end);

  if (!_suppliersFiltered.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state" style="padding:40px"><i class="fa-solid fa-truck"></i><h3>No suppliers found</h3><p>Add your first supplier or adjust filters.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = pageItems.map(s => `
    <tr>
      <td data-label="Supplier">
        <div class="cell-avatar">
          <div class="avatar sm">${Fmt.initials(s.company_name || s.contact_person || 'S')}</div>
          <div>
            <div class="cell-name">${esc(s.company_name)}</div>
            <div class="cell-sub">${esc(s.email || '—')}</div>
          </div>
        </div>
      </td>
      <td class="muted" data-label="Phone">${esc(s.phone || '—')}</td>
      <td class="muted" data-label="Contact">${esc(s.contact_person || s.company_name || '—')}</td>
       <td data-label="Balance" style="font-weight:600;color:${(s.opening_balance_type||'').toLowerCase()==='receivable' ? 'var(--success)' : (parseFloat(s.current_balance||0) > 0 ? 'var(--danger)' : 'var(--success)')}">${Fmt.currency(s.current_balance)}</td>
      <td data-label="Status"><span class="badge badge-${(s.status||'active') === 'active' ? 'success' : 'muted'}">${s.status || 'active'}</span></td>
      <td data-label="Actions">
        <div class="table-actions">
          <button class="action-btn" onclick="openModule('supplier','${s.id}')" title="Detail Sheet" style="color:var(--accent)"><i class="fa-solid fa-arrow-up"></i></button>
          <button class="action-btn view" onclick="viewSupplierDetail('${s.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
          <button class="action-btn edit" onclick="editSupplier('${s.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="action-btn delete" onclick="deleteSupplier('${s.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

// ── PAGINATION ─────────────────────────────────────────────────
function _renderSupplierPagination() {
  const container = document.getElementById('sup-pagination');
  const label     = document.getElementById('sup-showing-label');
  if (!container) return;

  const total   = _suppliersFiltered.length;
  const pages   = Math.ceil(total / _supPerPage) || 1;
  const start   = ((_supPage - 1) * _supPerPage) + 1;
  const end     = Math.min(_supPage * _supPerPage, total);

  if (label) label.textContent = total > 0 ? `Showing ${start}–${end} of ${total}` : 'Showing 0 of 0';

  if (pages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  // Prev
  html += `<button class="page-btn" onclick="_goSupPage(${_supPage - 1})" ${_supPage <= 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;
  // Pages
  const range = 2;
  for (let i = Math.max(1, _supPage - range); i <= Math.min(pages, _supPage + range); i++) {
    html += `<button class="page-btn ${i === _supPage ? 'active' : ''}" onclick="_goSupPage(${i})">${i}</button>`;
  }
  // Next
  html += `<button class="page-btn" onclick="_goSupPage(${_supPage + 1})" ${_supPage >= pages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;

  container.innerHTML = html;
}

function _goSupPage(page) {
  _supPage = page;
  _renderSupplierTable();
  _renderSupplierPagination();
  document.getElementById('supplier-table-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── ACTIVITY FEED ──────────────────────────────────────────────
function _renderSupplierActivity() {
  const feed = document.getElementById('supplier-activity-feed');
  if (!feed) return;

  // Merge recent activities from IndexedDB + generate from actual supplier changes
  const builtIn = _suppliersAll.slice(0, 5).map(s => ({
    type: 'supplier_added',
    text: `New supplier <strong>${esc(s.company_name)}</strong> added`,
    time: s.created_at || new Date().toISOString(),
    icon: 'fa-truck',
    color: 'rgba(59,130,246,0.15)',
    iconColor: 'var(--accent)',
  }));

  const allActivities = [..._supActivity, ...builtIn]
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
    .slice(0, 8);

  if (!allActivities.length) {
    feed.innerHTML = `<div class="empty-state" style="padding:24px"><i class="fa-solid fa-clock-rotate-left"></i><p style="font-size:13px">No recent activity</p></div>`;
    return;
  }

  feed.innerHTML = allActivities.map(a => `
    <div class="activity-item">
      <div class="activity-icon" style="background:${a.color || 'rgba(59,130,246,0.15)'};color:${a.iconColor || 'var(--accent)'}">
        <i class="fa-solid ${a.icon || 'fa-truck'}"></i>
      </div>
      <div class="activity-text">
        <p>${a.text}</p>
      </div>
      <div class="activity-time">${Fmt.ago(a.time)}</div>
    </div>
  `).join('');
}

// ── ADD ACTIVITY ───────────────────────────────────────────────
async function _addSupplierActivity(type, text, icon = 'fa-truck') {
  const entry = {
    id: DB.localId(),
    type,
    text,
    icon,
    time: new Date().toISOString(),
    color: type === 'supplier_added' ? 'rgba(16,185,129,0.15)' :
           type === 'payment' ? 'rgba(245,158,11,0.15)' :
           type === 'order' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)',
    iconColor: type === 'supplier_added' ? 'var(--success)' :
               type === 'payment' ? 'var(--warning)' :
               type === 'order' ? 'var(--accent-2)' : 'var(--accent)',
  };
  try {
    await DB.put('supplier_activity', entry);
    _supActivity.unshift(entry);
  } catch(e) {}
}

// ── MODAL: ADD / EDIT SUPPLIER ────────────────────────────────
window.openSupplierModal = function(supplier = null) {
  const isEdit = !!supplier;
  openModal(isEdit ? 'Edit Supplier' : 'Add Supplier', `
    <div class="form-row">
      <div class="form-group">
        <label>Company Name *</label>
        <div class="input-wrap"><i class="fa-solid fa-building"></i>
          <input type="text" id="sup-name" value="${esc(supplier?.company_name || '')}" placeholder="Acme Corp" />
        </div>
      </div>
      <div class="form-group">
        <label>Contact Person</label>
        <div class="input-wrap"><i class="fa-solid fa-user"></i>
          <input type="text" id="sup-contact" value="${esc(supplier?.contact_person || '')}" placeholder="John Doe" />
        </div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Email</label>
        <div class="input-wrap"><i class="fa-solid fa-envelope"></i>
          <input type="email" id="sup-email" value="${esc(supplier?.email || '')}" placeholder="john@acme.com" />
        </div>
      </div>
      <div class="form-group">
        <label>Phone *</label>
        <div class="input-wrap"><i class="fa-solid fa-phone"></i>
          <input type="tel" id="sup-phone" value="${esc(supplier?.phone || '')}" placeholder="+1 234 567 8900" />
        </div>
      </div>
    </div>
    <div class="form-group">
      <label>Address</label>
      <div class="input-wrap"><i class="fa-solid fa-location-dot"></i>
        <input type="text" id="sup-address" value="${esc(supplier?.address || '')}" placeholder="123 Business Ave, Suite 100" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Opening Balance</label>
        <div class="input-wrap"><i class="fa-solid fa-dollar-sign"></i>
          <input type="number" id="sup-balance" value="${isEdit ? (supplier.current_balance || 0) : 0}" step="0.01" />
        </div>
      </div>
      <div class="form-group">
        <label>Balance Type</label>
        <select id="sup-balance-type" style="max-width:150px">
          <option value="payable" ${isEdit && supplier.opening_balance_type === 'payable' ? 'selected' : ''}>Payable</option>
          <option value="receivable" ${isEdit && supplier.opening_balance_type === 'receivable' ? 'selected' : ''}>Receivable</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Credit Limit</label>
        <div class="input-wrap"><i class="fa-solid fa-credit-card"></i>
          <input type="number" id="sup-credit-limit" value="${isEdit ? (supplier.credit_limit || 0) : 0}" step="0.01" placeholder="0.00" />
        </div>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="sup-status" style="max-width:150px">
          <option value="active" ${supplier?.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="inactive" ${supplier?.status === 'inactive' ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Notes</label>
      <textarea id="sup-notes" placeholder="Payment terms, notes…">${esc(supplier?.notes || '')}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveSupplier(${isEdit ? `'${supplier.id}'` : 'null'})">
        <i class="fa-solid fa-check"></i> ${isEdit ? 'Save Changes' : 'Add Supplier'}
      </button>
    </div>`);
};

window.saveSupplier = async function(id) {
  const name    = document.getElementById('sup-name')?.value.trim();
  const phone   = document.getElementById('sup-phone')?.value.trim();
  if (!name)  { showToast('Company name is required', 'error'); return; }
  if (!phone) { showToast('Phone number is required', 'error'); return; }

  const data = {
    company_name:   name,
    contact_person: document.getElementById('sup-contact')?.value.trim() || '',
    email:          document.getElementById('sup-email')?.value.trim() || '',
    phone,
    address:        document.getElementById('sup-address')?.value.trim() || '',
    opening_balance: parseFloat(document.getElementById('sup-balance')?.value || 0),
    opening_balance_type: document.getElementById('sup-balance-type')?.value || 'payable',
    current_balance: parseFloat(document.getElementById('sup-balance')?.value || 0),
    credit_limit:   parseFloat(document.getElementById('sup-credit-limit')?.value || 0),
    status:         document.getElementById('sup-status')?.value || 'active',
    notes:          document.getElementById('sup-notes')?.value.trim() || '',
  };

  const btn = document.querySelector('#modal-box .btn-primary');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…'; }

  let localSave = false;

  try {
    if (id) {
      // Update
      await API.suppliers.update(id, data);
      showToast('Supplier updated', 'success');
    } else {
      // Create
      await API.suppliers.create(data);
      showToast('Supplier created', 'success');
      _addSupplierActivity('supplier_added', `New supplier <strong>${esc(name)}</strong> added`);
    }
    closeModal();
    await Pages.suppliers();
  } catch (e) {
    // Offline fallback — save to IndexedDB
    // Catch: network errors (status 0), offline flag, 401/Unauthorized (no PHP session), or !navigator.onLine
    if (e.offline || e.status === 0 || e.status === 401 || !navigator.onLine) {

      localSave = true;
      try {
        const localId = DB.localId();
        const supplierData = {
          id: localId,
          ...data,
          user_id: Auth.getUser()?.id || 0,
          created_at: new Date().toISOString(),
          synced: 0,
        };
        await DB.put('suppliers', supplierData);
        // Enqueue sync
        try { await DB.enqueue('suppliers', id ? 'update' : 'create', data); } catch(_) {}
        showToast('Saved offline — will sync when online', 'warning');

        // Add to local state
        _suppliersAll.unshift(supplierData);
        _addSupplierActivity('supplier_added', `New supplier <strong>${esc(name)}</strong> added (offline)`);

        closeModal();
        _applySupplierFilter();
      } catch(dbErr) {
        showToast('Could not save: ' + (dbErr.message || 'Local storage error'), 'error');
      }
    } else {
      showToast(e.message || 'Save failed', 'error');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = id ? '<i class="fa-solid fa-check"></i> Save Changes' : '<i class="fa-solid fa-check"></i> Add Supplier'; }
  }
};

// ── VIEW SUPPLIER DETAIL ─────────────────────────────────────
window.viewSupplierDetail = async function(id) {
  openModule('supplier', id);
};

// ── EDIT SUPPLIER ────────────────────────────────────────────
window.editSupplier = async function(id) {
  let supplier = _suppliersAll.find(s => String(s.id) === String(id));
  if (!supplier) {
    try {
      const res = await API.suppliers.get(id);
      supplier = res?.data || res;
    } catch(e) {
      showToast('Could not load supplier', 'error');
      return;
    }
  }
  if (supplier) openSupplierModal(supplier);
};

// ── DELETE SUPPLIER ──────────────────────────────────────────
window.deleteSupplier = async function(id) {
  if (!confirm('Are you sure you want to delete this supplier? This action cannot be undone.')) return;
  try {
    await API.suppliers.delete(id);
    showToast('Supplier deleted', 'success');
    await Pages.suppliers();
  } catch(e) {
    showToast('Failed to delete supplier', 'error');
  }
};

// ── EXPORT CSV ────────────────────────────────────────────────
window.exportSupplierData = function() {
  if (!_suppliersAll.length) {
    showToast('No supplier data to export', 'warning');
    return;
  }

  const headers = ['Company Name', 'Contact Person', 'Email', 'Phone', 'Address', 'Balance', 'Status', 'Notes'];
  const rows = _suppliersAll.map(s => [
    escCsv(s.company_name || ''),
    escCsv(s.contact_person || ''),
    escCsv(s.email || ''),
    escCsv(s.phone || ''),
    escCsv(s.address || ''),
    parseFloat(s.current_balance || 0).toFixed(2),
    s.status || 'active',
    escCsv(s.notes || ''),
  ]);

  let csv = '\uFEFF' + headers.join(',') + '\n';
  csv += rows.map(r => r.join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `suppliers_export_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Supplier data exported', 'success');
};

function escCsv(str) {
  if (!str) return '""';
  const s = String(str).replace(/"/g, '""');
  return `"${s}"`;
}

// ── CUSTOMERS ─────────────────────────────────────────────────
// ── Local state ────────────────────────────────────────────────
let _customersAll       = [];
let _customersFiltered  = [];
let _custPage           = 1;
const _custPerPage      = 10;
let _custActivity       = [];

Pages.customers = async function () {
  _customersAll = [];
  _custPage     = 1;

  // Load customers
  try {
    const res = await API.customers.list();
    _customersAll = Array.isArray(res) ? res : (res?.data || []);
  } catch(e) {
    try { _customersAll = await DB.getAll('customers'); } catch(_) {}
  }

  // Load stored activity
  try { _custActivity = await DB.getAll('customer_activity') || []; } catch(_) {}

  // Get unique areas from addresses
  const areas = [...new Set(_customersAll.map(c => {
    if (!c.address) return '';
    const parts = c.address.split(',').map(s => s.trim());
    return parts.length > 1 ? parts[parts.length - 1] : parts[0];
  }).filter(Boolean))].sort();

  const areaFilter = document.getElementById('customer-area-filter');
  if (areaFilter) {
    const currentVal = areaFilter.value;
    areaFilter.innerHTML = `<option value="">All Areas</option>` +
      areas.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
    areaFilter.value = currentVal || '';
  }

  // Wire up search, filters, sort
  const searchEl = document.getElementById('customer-search');
  const statusEl = document.getElementById('customer-status-filter');
  const areaEl  = document.getElementById('customer-area-filter');
  const sortEl  = document.getElementById('customer-sort');

  ['input', 'change'].forEach(evt => {
    [searchEl, statusEl, areaEl, sortEl].forEach(el => {
      if (el) {
        el.removeEventListener(evt, _onCustFilter);
        el.addEventListener(evt, _onCustFilter);
      }
    });
  });

  _applyCustomerFilter();
};

function _onCustFilter() {
  _custPage = 1;
  _applyCustomerFilter();
}

function _applyCustomerFilter() {
  const q      = ((document.getElementById('customer-search')?.value) || '').toLowerCase();
  const status = document.getElementById('customer-status-filter')?.value || '';
  const area   = document.getElementById('customer-area-filter')?.value || '';
  const sort   = document.getElementById('customer-sort')?.value || 'name_asc';

  let filtered = _customersAll.filter(c => {
    const matchSearch = (c.name || '').toLowerCase().includes(q) ||
                        (c.company_name || '').toLowerCase().includes(q) ||
                        (c.phone || '').toLowerCase().includes(q) ||
                        (c.email || '').toLowerCase().includes(q);
    const matchStatus = !status || (c.status || 'active') === status;
    let custArea = '';
    if (c.address) {
      const parts = c.address.split(',').map(s => s.trim());
      custArea = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    }
    const matchArea = !area || custArea.toLowerCase().includes(area.toLowerCase());
    return matchSearch && matchStatus && matchArea;
  });

  // Sort
  const sortFns = {
    name_asc:     (a,b) => (a.name||'').localeCompare(b.name||''),
    name_desc:    (a,b) => (b.name||'').localeCompare(a.name||''),
    balance_asc:  (a,b) => parseFloat(a.current_balance||0) - parseFloat(b.current_balance||0),
    balance_desc: (a,b) => parseFloat(b.current_balance||0) - parseFloat(a.current_balance||0),
    date_desc:    (a,b) => new Date(b.created_at||0) - new Date(a.created_at||0),
    date_asc:     (a,b) => new Date(a.created_at||0) - new Date(b.created_at||0),
  };
  if (sortFns[sort]) filtered.sort(sortFns[sort]);

  _customersFiltered = filtered;

  _renderCustomerStats();
  _renderCustomerTable();
  _renderCustomerPagination();
  _renderCustomerRecent();
  _renderTopBalance();
  _renderOutstandingDues();
  _renderCustomerActivity();
}

// ── STATS ──────────────────────────────────────────────────────
function _renderCustomerStats() {
  const total      = _customersAll.length;
  const active     = _customersAll.filter(c => (c.status||'active') === 'active').length;
  const inactive   = _customersAll.filter(c => (c.status||'active') === 'inactive').length;
  const receivables = _customersAll.reduce((s, c) => s + Math.max(0, parseFloat(c.current_balance||0)), 0);
  const balCount   = _customersAll.filter(c => parseFloat(c.current_balance||0) > 0).length;

  // Growth trend
  const thisMonth = _customersAll.filter(c => {
    if (!c.created_at) return false;
    const d = new Date(c.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const lastMonth = _customersAll.filter(c => {
    if (!c.created_at) return false;
    const d = new Date(c.created_at);
    const now = new Date();
    const lm = now.getMonth() - 1 < 0 ? 11 : now.getMonth() - 1;
    const ly = now.getMonth() - 1 < 0 ? now.getFullYear() - 1 : now.getFullYear();
    return d.getMonth() === lm && d.getFullYear() === ly;
  }).length;

  setEl('cust-total', total);
  setEl('cust-active', active);
  setEl('cust-active-count', active);
  setEl('cust-inactive-count', inactive);
  setEl('cust-receivables', Fmt.currency(receivables));
  setEl('cust-balance-count', balCount);
  setEl('cust-count-label', `${_customersFiltered.length} customers`);

  const growthEl = document.getElementById('cust-growth-label');
  if (growthEl) {
    if (total > 0 && lastMonth > 0) {
      const pct = ((thisMonth - lastMonth) / lastMonth * 100).toFixed(1);
      growthEl.innerHTML = `<span class="stat-change ${parseFloat(pct) >= 0 ? 'up' : 'down'}"><i class="fa-solid fa-arrow-${parseFloat(pct) >= 0 ? 'up' : 'down'}"></i> ${Math.abs(pct)}% this month</span>`;
    } else if (total > 0) {
      growthEl.innerHTML = `<span class="stat-change up"><i class="fa-solid fa-minus"></i> 0% this month</span>`;
    } else {
      growthEl.textContent = 'No customers yet';
    }
  }
}

// ── TABLE ──────────────────────────────────────────────────────
function _renderCustomerTable() {
  const tbody = document.getElementById('customers-tbody');
  if (!tbody) return;

  const start = (_custPage - 1) * _custPerPage;
  const end   = start + _custPerPage;
  const pageItems = _customersFiltered.slice(start, end);

  if (!_customersFiltered.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state" style="padding:40px"><i class="fa-solid fa-people-group"></i><h3>No customers found</h3><p>Add your first customer or adjust filters.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = pageItems.map(c => {
    const bal   = parseFloat(c.current_balance||0);
    const balClass = bal > 0 ? 'positive' : bal < 0 ? 'negative' : 'zero';
    const statusClass = (c.status||'active') === 'active' ? 'success' : 'muted';
    return `<tr>
      <td data-label="Customer">
        <div class="cell-avatar">
          <div class="avatar sm" style="background:${Fmt.avatarColor(c.name)}">${Fmt.initials(c.name)}</div>
          <div>
            <div class="cell-name">${esc(c.name)}</div>
            <div class="cell-sub">${esc(c.email || '—')}</div>
          </div>
        </div>
      </td>
      <td class="muted" data-label="Company">${esc(c.company_name || '—')}</td>
      <td class="muted" data-label="Phone">${esc(c.phone || '—')}</td>
      <td class="muted" data-label="City">${esc(_extractCity(c.address) || '—')}</td>
      <td data-label="Balance"><span class="customer-balance ${balClass}">${Fmt.currency(bal)}</span></td>
      <td data-label="Status"><span class="badge badge-${statusClass}">${c.status || 'active'}</span></td>
      <td class="muted" data-label="Last Tx">${c.last_transaction_date ? Fmt.date(c.last_transaction_date) : '—'}</td>
      <td data-label="Actions">
        <div class="table-actions">
          <button class="action-btn" onclick="openModule('customer','${c.id}')" title="Detail Sheet" style="color:var(--accent)"><i class="fa-solid fa-arrow-up"></i></button>
          <button class="action-btn view" onclick="viewCustomerDetail('${c.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
          <button class="action-btn edit" onclick="editCustomer('${c.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="action-btn" onclick="customerLedger('${c.id}')" title="Ledger" style="color:var(--info)"><i class="fa-solid fa-book"></i></button>
          <button class="action-btn delete" onclick="deleteCustomer('${c.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function _extractCity(address) {
  if (!address) return '';
  const parts = address.split(',').map(s => s.trim());
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

// ── PAGINATION ─────────────────────────────────────────────────
function _renderCustomerPagination() {
  const container = document.getElementById('cust-pagination');
  const label     = document.getElementById('cust-showing-label');
  if (!container) return;

  const total   = _customersFiltered.length;
  const pages   = Math.ceil(total / _custPerPage) || 1;
  const start   = ((_custPage - 1) * _custPerPage) + 1;
  const end     = Math.min(_custPage * _custPerPage, total);

  if (label) label.textContent = total > 0 ? `Showing ${start}–${end} of ${total}` : 'Showing 0 of 0';

  if (pages <= 1) { container.innerHTML = ''; return; }

  let html = '';
  html += `<button class="page-btn" onclick="_goCustPage(${_custPage - 1})" ${_custPage <= 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;
  const range = 2;
  for (let i = Math.max(1, _custPage - range); i <= Math.min(pages, _custPage + range); i++) {
    html += `<button class="page-btn ${i === _custPage ? 'active' : ''}" onclick="_goCustPage(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" onclick="_goCustPage(${_custPage + 1})" ${_custPage >= pages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;
  container.innerHTML = html;
}

function _goCustPage(page) {
  _custPage = page;
  _renderCustomerTable();
  _renderCustomerPagination();
  document.getElementById('customer-table-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── RIGHT PANEL: Recent Customers ──────────────────────────────
function _renderCustomerRecent() {
  const container = document.getElementById('cust-recent-list');
  if (!container) return;

  const recent = [..._customersAll]
    .sort((a, b) => new Date(b.created_at||0) - new Date(a.created_at||0))
    .slice(0, 5);

  if (!recent.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px"><i class="fa-solid fa-users" style="color:var(--txt-muted);opacity:0.5;font-size:32px"></i><p style="font-size:13px">No customers yet</p></div>`;
    return;
  }

  container.innerHTML = recent.map(c => `
    <div class="cust-card-mini" onclick="viewCustomerDetail('${c.id}')">
      <div class="avatar sm" style="background:${Fmt.avatarColor(c.name)};font-size:10px">${Fmt.initials(c.name)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</div>
        <div style="font-size:11px;color:var(--txt-muted)">${Fmt.ago(c.created_at)}</div>
      </div>
    </div>
  `).join('');
}

// ── RIGHT PANEL: Top by Balance ────────────────────────────────
function _renderTopBalance() {
  const container = document.getElementById('cust-top-balance-list');
  if (!container) return;

  const top = [..._customersAll]
    .sort((a, b) => parseFloat(b.current_balance||0) - parseFloat(a.current_balance||0))
    .filter(c => parseFloat(c.current_balance||0) > 0)
    .slice(0, 5);

  if (!top.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px"><i class="fa-solid fa-chart-simple" style="color:var(--txt-muted);opacity:0.5;font-size:32px"></i><p style="font-size:13px">No data available</p></div>`;
    return;
  }

  container.innerHTML = top.map(c => `
    <div class="cust-card-mini" onclick="viewCustomerDetail('${c.id}')">
      <div class="avatar sm" style="background:${Fmt.avatarColor(c.name)};font-size:10px">${Fmt.initials(c.name)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</div>
        <div style="font-size:11px;color:var(--txt-muted)">${esc(c.company_name || '')}</div>
      </div>
      <div class="cust-bal" style="color:var(--warning)">${Fmt.currency(c.current_balance)}</div>
    </div>
  `).join('');
}

// ── RIGHT PANEL: Outstanding Dues ──────────────────────────────
function _renderOutstandingDues() {
  const container = document.getElementById('cust-outstanding-list');
  if (!container) return;

  const activeBal = _customersAll.filter(c => parseFloat(c.current_balance||0) > 0).length;
  const totalBal  = _customersAll.reduce((s, c) => s + Math.max(0, parseFloat(c.current_balance||0)), 0);

  if (!activeBal) {
    container.innerHTML = `<div class="empty-state" style="padding:16px"><i class="fa-solid fa-circle-check" style="color:var(--success);opacity:0.5;font-size:32px"></i><p style="font-size:13px">All accounts in good standing</p></div>`;
    return;
  }

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:13px">Customers with balance</span>
      <span style="font-weight:700;font-size:16px">${activeBal}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:13px">Total outstanding</span>
      <span style="font-weight:700;font-size:16px;color:var(--warning)">${Fmt.currency(totalBal)}</span>
    </div>
    <div style="padding:8px 0;text-align:center">
      <div style="height:6px;background:var(--bg-glass);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${Math.min(100, (activeBal / Math.max(1, _customersAll.length)) * 100)}%;background:linear-gradient(90deg,var(--warning),var(--danger));border-radius:3px"></div>
      </div>
      <div style="font-size:11px;color:var(--txt-muted);margin-top:4px">${((activeBal / Math.max(1, _customersAll.length)) * 100).toFixed(1)}% of customers</div>
    </div>`;
}

// ── ACTIVITY FEED ──────────────────────────────────────────────
function _renderCustomerActivity() {
  const feed = document.getElementById('cust-activity-feed');
  if (!feed) return;

  const builtIn = _customersAll.slice(0, 5).map(c => ({
    text: `Customer <strong>${esc(c.name)}</strong> ${c.updated_at && c.updated_at !== c.created_at ? 'updated' : 'added'}`,
    time: c.updated_at || c.created_at || new Date().toISOString(),
    icon: 'fa-user',
    color: 'rgba(59,130,246,0.15)',
    iconColor: 'var(--accent)',
  }));

  const allItems = [..._custActivity, ...builtIn]
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
    .slice(0, 6);

  if (!allItems.length) {
    feed.innerHTML = `<div class="empty-state" style="padding:24px"><i class="fa-solid fa-clock-rotate-left"></i><p style="font-size:13px">No recent activity</p></div>`;
    return;
  }

  feed.innerHTML = allItems.map(a => `
    <div class="activity-item">
      <div class="activity-icon" style="background:${a.color};color:${a.iconColor}">
        <i class="fa-solid ${a.icon}"></i>
      </div>
      <div class="activity-text"><p>${a.text}</p></div>
      <div class="activity-time">${Fmt.ago(a.time)}</div>
    </div>`).join('');
}

// ── ADD ACTIVITY ───────────────────────────────────────────────
async function _addCustomerActivity(type, text, icon = 'fa-user') {
  const entry = {
    id: DB.localId(),
    type,
    text,
    icon,
    time: new Date().toISOString(),
    color: type === 'customer_added'   ? 'rgba(16,185,129,0.15)' :
           type === 'customer_updated' ? 'rgba(59,130,246,0.15)' :
           type === 'customer_deleted' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
    iconColor: type === 'customer_added'   ? 'var(--success)' :
               type === 'customer_updated' ? 'var(--accent)' :
               type === 'customer_deleted' ? 'var(--danger)' : 'var(--accent)',
  };
  try {
    await DB.put('customer_activity', entry);
    _custActivity.unshift(entry);
  } catch(e) {}
}

// ── MODAL: ADD / EDIT CUSTOMER ─────────────────────────────────
window.openCustomerModal = function(customer = null) {
  const isEdit = !!customer;
  openModal(isEdit ? 'Edit Customer' : 'Add Customer', `
    <div class="form-row">
      <div class="form-group">
        <label>Customer Name *</label>
        <div class="input-wrap"><i class="fa-solid fa-user"></i>
          <input type="text" id="cust-name" value="${esc(customer?.name || '')}" placeholder="John Doe" />
        </div>
      </div>
      <div class="form-group">
        <label>Company Name</label>
        <div class="input-wrap"><i class="fa-solid fa-building"></i>
          <input type="text" id="cust-company" value="${esc(customer?.company_name || '')}" placeholder="Company Inc." />
        </div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Email</label>
        <div class="input-wrap"><i class="fa-solid fa-envelope"></i>
          <input type="email" id="cust-email" value="${esc(customer?.email || '')}" placeholder="email@example.com" />
        </div>
      </div>
      <div class="form-group">
        <label>Phone *</label>
        <div class="input-wrap"><i class="fa-solid fa-phone"></i>
          <input type="tel" id="cust-phone" value="${esc(customer?.phone || '')}" placeholder="+1 234 567 890" />
        </div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Opening Balance</label>
        <div class="input-wrap"><i class="fa-solid fa-dollar-sign"></i>
          <input type="number" id="cust-balance" value="${isEdit ? customer.opening_balance || (customer.current_balance || 0) : '0'}" step="0.01" placeholder="0.00" ${isEdit ? 'readonly' : ''} />
        </div>
        ${isEdit ? '<div style="font-size:11px;color:var(--txt-muted);margin-top:4px">Opening balance can only be set on creation</div>' : ''}
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="cust-status" style="max-width:150px">
          <option value="active" ${(customer?.status||'active') === 'active' ? 'selected' : ''}>Active</option>
          <option value="inactive" ${customer?.status === 'inactive' ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Address</label>
      <div class="input-wrap"><i class="fa-solid fa-location-dot"></i>
        <input type="text" id="cust-address" value="${esc(customer?.address || '')}" placeholder="Street, City, Country" />
      </div>
    </div>
    <div class="form-group">
      <label>Notes</label>
      <textarea id="cust-notes" placeholder="Additional notes about this customer…">${esc(customer?.notes || '')}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveCustomer(${isEdit ? `'${customer.id}'` : 'null'})">
        <i class="fa-solid fa-check"></i> ${isEdit ? 'Save Changes' : 'Add Customer'}
      </button>
    </div>`);
};

window.saveCustomer = async function(id) {
  const name    = document.getElementById('cust-name')?.value.trim();
  const phone   = document.getElementById('cust-phone')?.value.trim();

  if (!name)  { showToast('Customer name is required', 'error'); return; }
  if (!phone) { showToast('Phone number is required', 'error'); return; }

  const data = {
    name,
    company_name:   document.getElementById('cust-company')?.value.trim() || '',
    email:          document.getElementById('cust-email')?.value.trim() || '',
    phone,
    address:        document.getElementById('cust-address')?.value.trim() || '',
    status:         document.getElementById('cust-status')?.value || 'active',
    notes:          document.getElementById('cust-notes')?.value.trim() || '',
    opening_balance: parseFloat(document.getElementById('cust-balance')?.value || 0),
  };

  const btn = document.querySelector('#modal-box .btn-primary');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…'; }

  try {
    if (id) {
      await API.customers.update(id, data);
      showToast('Customer updated', 'success');
      _addCustomerActivity('customer_updated', `Customer <strong>${esc(data.name)}</strong> updated`);
    } else {
      await API.customers.create(data);
      showToast('Customer created', 'success');
      _addCustomerActivity('customer_added', `Customer <strong>${esc(data.name)}</strong> added`);
    }
    closeModal();
    await Pages.customers();
  } catch (e) {
    // Offline fallback
    if (e.offline || e.status === 0 || e.status === 401 || !navigator.onLine) {
      try {
        const localId = DB.localId();
        const customerData = {
          id: localId,
          ...data,
          current_balance: data.opening_balance,
          user_id: Auth.getUser()?.id || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          synced: 0,
        };
        await DB.put('customers', customerData);
        await DB.enqueue('customers', id ? 'update' : 'create', data);
        showToast('Saved offline — will sync when online', 'warning');

        if (!id) _customersAll.unshift(customerData);
        closeModal();
        _applyCustomerFilter();
      } catch(dbErr) {
        showToast('Could not save: ' + (dbErr.message || 'Local storage error'), 'error');
      }
    } else {
      showToast(e.message || 'Save failed', 'error');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = id ? '<i class="fa-solid fa-check"></i> Save Changes' : '<i class="fa-solid fa-check"></i> Add Customer'; }
  }
};

// ── VIEW CUSTOMER DETAIL ──────────────────────────────────────
window.viewCustomerDetail = async function(id) {
  openModule('customer', id);
};

// ── EDIT CUSTOMER ──────────────────────────────────────────────
window.editCustomer = async function(id) {
  let customer = _customersAll.find(c => String(c.id) === String(id));
  if (!customer) {
    try {
      const res = await API.customers.get(id);
      customer = res?.data || res;
    } catch(e) {
      showToast('Could not load customer', 'error');
      return;
    }
  }
  if (!customer) { showToast('Customer not found', 'error'); return; }
  openCustomerModal(customer);
};

// ── DELETE CUSTOMER ────────────────────────────────────────────
window.deleteCustomer = async function(id) {
  if (!confirm('Delete this customer? This action cannot be undone.')) return;

  const customer = _customersAll.find(c => String(c.id) === String(id));
  const cName = customer?.name || 'Customer';

  try {
    await API.customers.delete(id);
    _addCustomerActivity('customer_deleted', `Customer <strong>${esc(cName)}</strong> deleted`);
    showToast('Customer deleted', 'success');
    await Pages.customers();
  } catch(e) {
    if (e.offline || e.status === 0 || !navigator.onLine) {
      showToast('Delete will sync when online', 'warning');
      await DB.enqueue('customers', 'delete', { id });
      _customersAll = _customersAll.filter(c => String(c.id) !== String(id));
      _applyCustomerFilter();
    } else {
      showToast('Delete failed', 'error');
    }
  }
};

// ── CUSTOMER LEDGER ──────────────────────────────────────────
window.customerLedger = async function(id) {
  let customer = _customersAll.find(c => String(c.id) === String(id));
  if (!customer) {
    try {
      const res = await API.customers.get(id);
      customer = res?.data || res;
    } catch(e) {
      showToast('Could not load customer', 'error');
      return;
    }
  }
  if (!customer) { showToast('Customer not found', 'error'); return; }

  // Build a mock ledger from available data or fetch from API
  let transactions = [];
  try {
    const invRes = await API.salesInvoices.list({ customer_id: id });
    const invoices = Array.isArray(invRes) ? invRes : (invRes?.data || []);
    transactions = invoices.map(inv => ({
      date: inv.date || inv.created_at,
      type: 'Sale',
      ref: inv.invoice_no || `INV-${inv.id}`,
      debit: parseFloat(inv.total||0),
      credit: 0,
      balance: 0,
      description: `Sale invoice`,
    }));
  } catch(e) {}

  // Sort by date
  transactions.sort((a, b) => new Date(a.date||0) - new Date(b.date||0));

  // Calculate running balance starting from opening balance
  let running = parseFloat(customer.opening_balance||0);
  transactions = transactions.map(t => {
    running += t.debit - t.credit;
    return { ...t, balance: running };
  });

  const bal = parseFloat(customer.current_balance||0);
  const openModalContent = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="avatar sm" style="background:${Fmt.avatarColor(customer.name)}">${Fmt.initials(customer.name)}</div>
        <div>
          <div style="font-size:16px;font-weight:700">${esc(customer.name)}</div>
          <div style="font-size:12px;color:var(--txt-muted)">${esc(customer.phone || '')}${customer.company_name ? ' · ' + esc(customer.company_name) : ''}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:var(--txt-muted)">Current Balance</div>
        <div style="font-size:20px;font-weight:800;color:${bal > 0 ? 'var(--warning)' : 'var(--success)'}">${Fmt.currency(bal)}</div>
      </div>
    </div>
    <div style="margin-bottom:16px;font-size:12px;color:var(--txt-muted)">
      Opening Balance: ${Fmt.currency(customer.opening_balance||0)} ·
      ${transactions.length} transaction(s)
    </div>
    <div style="overflow-x:auto">
      <table class="ledger-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Reference</th>
            <th>Description</th>
            <th style="text-align:right">Debit</th>
            <th style="text-align:right">Credit</th>
            <th style="text-align:right">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>—</td>
            <td>Opening</td>
            <td>Opening Balance</td>
            <td></td>
            <td></td>
            <td style="text-align:right;font-weight:600">${Fmt.currency(customer.opening_balance||0)}</td>
          </tr>
          ${transactions.length ? transactions.map(t => `
            <tr>
              <td>${Fmt.date(t.date)}</td>
              <td>${esc(t.ref)}</td>
              <td>${esc(t.description)}</td>
              <td style="text-align:right" class="dr">${t.debit > 0 ? Fmt.currency(t.debit) : ''}</td>
              <td style="text-align:right" class="cr">${t.credit > 0 ? Fmt.currency(t.credit) : ''}</td>
              <td style="text-align:right;font-weight:600">${Fmt.currency(t.balance)}</td>
            </tr>
          `).join('') : `
            <tr>
              <td colspan="6" style="text-align:center;padding:24px;color:var(--txt-muted)">No transactions found</td>
            </tr>
          `}
        </tbody>
      </table>
    </div>
    <div class="modal-footer" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn btn-secondary" style="color:var(--info)" onclick="window.print()"><i class="fa-solid fa-print"></i> Print Statement</button>
    </div>`;

  openModal(`Ledger: ${esc(customer.name)}`, openModalContent, { wide: true });
};

// ── EXPORT & PRINT ──────────────────────────────────────────────
window.exportCustomerData = function() {
  if (!_customersAll.length) { showToast('No customers to export', 'warning'); return; }

  const headers = ['Name', 'Company', 'Email', 'Phone', 'Address', 'Opening Balance', 'Current Balance', 'Status', 'Created'];
  const rows = _customersAll.map(c => [
    c.name || '',
    c.company_name || '',
    c.email || '',
    c.phone || '',
    c.address || '',
    c.opening_balance || 0,
    c.current_balance || 0,
    c.status || 'active',
    c.created_at || '',
  ]);

  const csv = [headers, ...rows].map(row =>
    row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `customers_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Customers exported', 'success');
};

window.printCustomerReport = function() {
  if (!_customersAll.length) { showToast('No customers to print', 'warning'); return; }

  const totalBal = _customersAll.reduce((s, c) => s + parseFloat(c.current_balance||0), 0);
  const printWin = window.open('', '_blank', 'width=800,height=600');
  if (!printWin) { showToast('Please allow pop-ups', 'error'); return; }

  printWin.document.write(`
    <html><head><title>Customer Report</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      .sub { color: #666; font-size: 13px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #f5f5f5; padding: 8px 10px; text-align: left; font-weight: 600; border: 1px solid #ddd; }
      td { padding: 8px 10px; border: 1px solid #ddd; }
      .amt { text-align: right; font-weight: 600; }
      .summary { margin-top: 20px; text-align: right; font-size: 14px; }
      .summary strong { font-size: 16px; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <h1>Customer Report</h1>
    <div class="sub">Generated ${new Date().toLocaleDateString()} · ${_customersAll.length} customers</div>
    <table>
      <thead><tr>
        <th>Name</th><th>Company</th><th>Phone</th><th>City</th><th class="amt">Balance</th><th>Status</th>
      </tr></thead>
      <tbody>
        ${_customersAll.map(c => `
          <tr>
            <td>${esc(c.name)}</td>
            <td>${esc(c.company_name||'')}</td>
            <td>${esc(c.phone||'')}</td>
            <td>${esc(_extractCity(c.address))}</td>
            <td class="amt">${Fmt.currency(c.current_balance)}</td>
            <td>${c.status||'active'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="summary">
      Total Receivables: <strong>${Fmt.currency(totalBal)}</strong>
    </div>
    <script>window.print();window.close();</script>
    </body></html>
  `);
  printWin.document.close();
};

// ── PURCHASE INVOICES ─────────────────────────────────────────
/** Shared state for purchase invoice modal */
const PI = { supplier: null, products: [], editId: null, suppliers: [], prods: [] };
let piOpenProductDropdown = null;
let piEntryProduct = null;
let piEntryEditIndex = null;

function emptyPiProduct() {
  return { product_id: null, product_name: '', sku: '', barcode: '', unit: 'pcs', stock: 0, purchase_price: '', sale_price: '', quantity: 1, discount: 0, discount_type: 'percent', tax: 0, tax_type: 'percent', lineTotal: 0 };
}

function piLocalDateTime(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function validatePiInvoiceNumber(showMessage = true) {
  const input = document.getElementById('pi-invoice-no');
  const status = document.getElementById('pi-invoice-no-status');
  const number = input?.value.trim();
  if (!number) {
    if (status) status.textContent = 'A number will be generated automatically.';
    return true;
  }
  try {
    const result = await API.purchaseInvoices.checkNumber(number, PI.editId);
    const available = result?.data?.available === true;
    if (status) {
      status.textContent = available ? 'Invoice number is available.' : 'Invoice number already exists.';
      status.style.color = available ? 'var(--success)' : 'var(--danger)';
    }
    if (!available && showMessage) showToast('Invoice number already exists', 'error');
    return available;
  } catch (error) {
    if (showMessage) showToast(error.message || 'Could not validate invoice number', 'error');
    return false;
  }
}

Pages.purchaseInvoices = async function () {
  let list = [];
  try {
    const res = await API.purchaseInvoices.list();
    list = Array.isArray(res) ? res : (res?.data || []);
  } catch(e) {}

  const tbody = document.getElementById('purchases-tbody');
  if (!tbody) return;

  // Load suppliers + products for modal (with IndexedDB offline fallback)
  try {
    PI.suppliers = await API.suppliers.list();
    if (PI.suppliers?.data) {
      await DB.putAll('suppliers', PI.suppliers.data.map(s => ({ ...s, synced: 1 })));
      PI.suppliers = PI.suppliers.data;
    }
  } catch(e) {
    // Offline fallback — load from IndexedDB
    try { PI.suppliers = await DB.getAll('suppliers'); } catch(_) { PI.suppliers = []; }
  }
  try {
    PI.prods = await API.products.list();
    if (PI.prods?.data) {
      await DB.putAll('products', PI.prods.data.map(p => ({ ...p, synced: 1 })));
      PI.prods = PI.prods.data;
    }
  } catch(e) {
    try { PI.prods = await DB.getAll('products'); } catch(_) { PI.prods = []; }
  }

  // Stats calculations
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
  const prevMonth = lastMonth === 0 ? 11 : lastMonth - 1;
  const prevMonthYear = lastMonth === 0 ? lastMonthYear - 1 : lastMonthYear;

  const lastMonthInvs = list.filter(i => {
    const d = new Date(i.date);
    return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear && i.status !== 'cancelled';
  });
  const prevMonthInvs = list.filter(i => {
    const d = new Date(i.date);
    return d.getMonth() === prevMonth && d.getFullYear() === prevMonthYear && i.status !== 'cancelled';
  });
  const thisMonthInvs = list.filter(i => {
    const d = new Date(i.date);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear && i.status !== 'cancelled';
  });

  const lastMonthTotal = lastMonthInvs.reduce((s, i) => s + parseFloat(i.total || 0), 0);
  const prevMonthTotal = prevMonthInvs.reduce((s, i) => s + parseFloat(i.total || 0), 0);
  const thisMonthTotal = thisMonthInvs.reduce((s, i) => s + parseFloat(i.total || 0), 0);

  const lmChange = prevMonthTotal ? ((lastMonthTotal - prevMonthTotal) / prevMonthTotal * 100).toFixed(1) : 0;
  const tmChange = lastMonthTotal ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100).toFixed(1) : 0;

  const setStat = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setChange = (id, val, isUp) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<i class="fa-solid fa-arrow-${isUp ? 'up' : 'down'}"></i> ${val}% ${
      id.includes('last') ? 'vs prev month' : 'from last month'
    }`;
    el.className = `stat-change ${isUp ? 'up' : 'down'}`;
  };

  setStat('pi-last-month', Fmt.currency(lastMonthTotal));
  setStat('pi-total-invoices', String(list.length));
  setStat('pi-this-month', Fmt.currency(thisMonthTotal));
  setChange('pi-last-month-change', Math.abs(lmChange), lmChange >= 0);
  setChange('pi-total-change', '—', true);
  setChange('pi-this-month-change', Math.abs(tmChange), tmChange >= 0);

  // Count label
  const countLabel = document.getElementById('pi-count-label');
  if (countLabel) countLabel.textContent = `${list.length} invoices`;

  // Recommendations
  const recs = document.getElementById('purchase-recs');
  if (recs) {
    const unpaidCount = list.filter(i => i.status === 'pending' || i.status === 'partial').length;
    const topSupplier = [...new Set(list.map(i => i.supplier_name).filter(Boolean))].sort((a, b) =>
      list.filter(i => i.supplier_name === b).length - list.filter(i => i.supplier_name === a).length
    )[0];
    const recentCount = thisMonthInvs.length;
    let lowStockCount = 0;
    try {
      const prods = await API.products.list();
      lowStockCount = (prods || []).filter(p => parseFloat(p.stock_quantity || p.stock || 0) <= 5).length;
    } catch(_) {}

    const recItems = [];
    if (unpaidCount > 0) recItems.push({ icon: 'warning', bg: 'warning', msg: `${unpaidCount} invoice(s) still unpaid. Consider reminders.`, action: 'View Invoices', onclick: 'document.getElementById(\'purchases-tbody\')?.scrollIntoView({behavior:\'smooth\'})' });
    if (topSupplier) recItems.push({ icon: 'trophy', bg: 'success', msg: `\u201C${esc(topSupplier)}\u201D is your most active supplier.`, action: 'View Supplier' });
    if (lowStockCount > 0) recItems.push({ icon: 'box', bg: 'info', msg: `${lowStockCount} product(s) low on stock. Consider reordering.`, action: 'View Products', onclick: 'Router.navigate(\'products\')' });
    if (recentCount > 0) recItems.push({ icon: 'chart-simple', bg: 'info', msg: `${recentCount} purchase(s) this month ${tmChange >= 0 ? 'increasing' : 'decreasing'}.`, action: 'View Report', onclick: 'Router.navigate(\'reports\')' });

    recs.innerHTML = recItems.map(r => `
      <div class="rec-card">
        <div class="rec-icon ${r.bg}"><i class="fa-solid fa-${r.icon}"></i></div>
        <div class="rec-body">
          <p>${r.msg}</p>
          <button class="btn btn-sm btn-secondary" onclick="${r.onclick || '()=>{}'}">${r.action} <i class="fa-solid fa-arrow-right"></i></button>
        </div>
      </div>
    `).join('') || '<p style="color:var(--txt-muted);font-size:13px">No insights available</p>';
  }

  // Table
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-cart-shopping"></i><h3>No purchase invoices yet</h3><p>Create your first purchase invoice to get started.</p></div></td></tr>`; return; }
  tbody.innerHTML = list.map(i => {
    const s = i.status || 'pending';
    const bc = s === 'paid' ? 'success' : s === 'partial' ? 'warning' : s === 'received' ? 'info' : 'danger';
    const sl = s.charAt(0).toUpperCase() + s.slice(1);
    return `<tr>
      <td style="font-weight:600" data-label="Invoice #">${esc(i.invoice_no)}</td>
      <td data-label="Supplier"><div class="cell-name">${esc(i.supplier_name || '—')}</div></td>
      <td class="muted" data-label="Date">${Fmt.date(i.date)}</td>
      <td style="font-weight:600" data-label="Total">${Fmt.currency(i.total)}</td>
      <td class="muted" data-label="Paid">${Fmt.currency(i.paid_amount || 0)}</td>
      <td style="font-weight:600;color:${parseFloat(i.balance || i.total) > 0 ? 'var(--warning)' : 'var(--success)'}" data-label="Balance">${Fmt.currency(i.balance || i.total)}</td>
      <td data-label="Status"><span class="badge badge-${bc}">${sl}</span></td>
      <td data-label="Actions"><div class="table-actions">
        <button class="action-btn view" onclick="viewPiInvoice('${i.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
        <button class="action-btn edit" onclick="editPiInvoice('${i.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="action-btn" onclick="printPiExisting('${i.id}')" title="Print"><i class="fa-solid fa-print"></i></button>
        <button class="action-btn delete" onclick="deletePurchase('${i.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('');

  // ── RIGHT SIDEBAR INSIGHTS ──────────────────────────────────
  renderPiInsights(list);
};

// ── INSIGHT PANEL RENDERING ───────────────────────────────────
function renderPiInsights(list) {
  // Payment Summary
  const totalInvoiced = list.reduce((s, i) => s + parseFloat(i.total || 0), 0);
  const totalPaid = list.reduce((s, i) => s + parseFloat(i.paid_amount || 0), 0);
  const outstanding = totalInvoiced - totalPaid;
  setEl('pi-sm-invoiced', Fmt.currency(totalInvoiced));
  setEl('pi-sm-paid', Fmt.currency(totalPaid));
  setEl('pi-sm-credit', Fmt.currency(outstanding));
  const bar = document.getElementById('pi-payment-bar');
  if (bar) {
    const pct = totalInvoiced > 0 ? Math.min(100, (totalPaid / totalInvoiced) * 100) : 0;
    bar.style.width = pct.toFixed(1) + '%';
  }

  // Recent Invoices (top 5)
  const recentList = document.getElementById('pi-recent-list');
  if (recentList) {
    const sorted = [...list].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    if (!sorted.length) {
      recentList.innerHTML = '<div class="empty-state" style="padding:12px"><p style="font-size:12px">No recent invoices</p></div>';
    } else {
      recentList.innerHTML = sorted.map(i => {
        const s = i.status || 'pending';
        const sc = s === 'paid' ? 'var(--success)' : s === 'partial' ? 'var(--warning)' : 'var(--danger)';
        return `<div class="pi-insight-card" style="cursor:pointer" onclick="viewPiInvoice('${i.id}')">
          <div>
            <div class="pi-insight-name">#${esc(i.invoice_no)} · ${esc(i.supplier_name || '—')}</div>
            <div class="pi-insight-sub">${Fmt.date(i.date)}</div>
          </div>
          <div class="pi-insight-amount" style="color:${sc}">${Fmt.currency(parseFloat(i.balance || i.total) > 0 ? parseFloat(i.balance || i.total) : 0)}</div>
        </div>`;
      }).join('');
    }
  }

  // Top Suppliers
  const topSup = document.getElementById('pi-top-suppliers');
  if (topSup) {
    const supMap = {};
    list.forEach(i => {
      const n = i.supplier_name;
      if (!n) return;
      if (!supMap[n]) supMap[n] = { name: n, count: 0, total: 0 };
      supMap[n].count++;
      supMap[n].total += parseFloat(i.total || 0);
    });
    const sorted = Object.values(supMap).sort((a, b) => b.total - a.total).slice(0, 4);
    if (!sorted.length) {
      topSup.innerHTML = '<div class="empty-state" style="padding:12px"><p style="font-size:12px">No supplier data</p></div>';
    } else {
      topSup.innerHTML = sorted.map(s => 
        `<div class="pi-insight-card">
          <div>
            <div class="pi-insight-name">${esc(s.name)}</div>
            <div class="pi-insight-sub">${s.count} invoice${s.count > 1 ? 's' : ''}</div>
          </div>
          <div class="pi-insight-amount" style="color:var(--accent)">${Fmt.currency(s.total)}</div>
        </div>`
      ).join('');
    }
  }
}

// ── EXPORT CSV ────────────────────────────────────────────────
window.exportPiData = async function() {
  let list = [];
  try { list = await API.purchaseInvoices.list(); } catch(e) { showToast('Failed to load data', 'error'); return; }
  if (!list || !list.length) { showToast('No data to export', 'error'); return; }
  const rows = [['Invoice #','Supplier','Date','Total','Paid','Balance','Status']];
  list.forEach(i => {
    const s = i.status || 'pending';
    rows.push([
      i.invoice_no, i.supplier_name || '', i.date, i.total || 0,
      i.paid_amount || 0, i.balance || i.total || 0,
      s.charAt(0).toUpperCase() + s.slice(1)
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `purchase_invoices_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast('Data exported successfully', 'success');
};

// ── MODAL OPEN / CLOSE ───────────────────────────────────────

window.openPurchaseInvoiceModal = function(editData) {
  document.body.classList.add('pi-reference-mode');
  document.querySelector('.page-container')?.classList.add('pi-create-mode');
  PI.editId = editData ? editData.id : null;
  PI.supplier = editData ? { id: editData.supplier_id, name: editData.supplier_name, phone: editData.supplier_phone, address: editData.supplier_address } : null;

  document.getElementById('pi-modal-title').textContent = editData ? 'Edit Purchase Invoice' : 'New Purchase Invoice';
  document.getElementById('pi-invoice-no').value = editData?.invoice_no || '';
  document.getElementById('pi-invoice-date').value = editData?.invoice_datetime
    ? piLocalDateTime(editData.invoice_datetime)
    : piLocalDateTime(editData?.date || new Date());
  document.getElementById('pi-due-date').value = editData?.due_date || '';
  document.getElementById('pi-reference').value = editData?.reference || '';
  document.getElementById('pi-supplier-address-field').value = editData?.supplier_address || '';
  document.getElementById('pi-other-notes').value = editData?.notes || '';
  document.getElementById('pi-invoice-no-status').textContent = '';
  document.getElementById('pi-fullscreen-modal').style.display = 'flex';
  // The invoice workspace is rendered inline inside the page (pi-create-mode), so the
  // page must always be free to scroll vertically. Never lock body scrolling here.
  document.body.style.overflow = '';

  if (editData) {
    // Populate from existing invoice
    document.getElementById('pi-paid-amount').value = editData.paid_amount || 0;
    document.getElementById('pi-notes').value = editData.notes || '';
    if (PI.supplier) showSelectedSupplier(PI.supplier);

    // Load items
    if (editData.items && editData.items.length) {
      PI.products = editData.items.map(it => ({
        product_id: it.product_id,
        product_name: it.product_name,
        sku: it.sku || '', barcode: it.barcode || '', unit: it.unit || 'pcs', stock: it.stock || 0,
        purchase_price: parseFloat(it.purchase_price),
        sale_price: it.sale_price ? parseFloat(it.sale_price) : '',
        quantity: parseFloat(it.quantity),
        discount: parseFloat(it.discount || 0), discount_type: 'fixed', tax: parseFloat(it.tax_amount || 0), tax_type: 'fixed',
        lineTotal: parseFloat(it.total),
      }));
    } else {
      PI.products = [];
    }
  } else {
    // Reset
    PI.products = [];
    document.getElementById('pi-paid-amount').value = 0;
    document.getElementById('pi-notes').value = '';
    document.getElementById('pi-due-date').value = '';
    document.getElementById('pi-reference').value = '';
    document.getElementById('pi-supplier-address-field').value = '';
    document.getElementById('pi-other-notes').value = '';
    PI.supplier = null;
    document.getElementById('pi-supplier-info').style.display = 'none';
    document.getElementById('pi-supplier-search').value = '';
  }

  renderPiProductRows();
  calcPiTotals();

  if (!editData) {
    API.purchaseInvoices.nextNumber().then(result => {
      const input = document.getElementById('pi-invoice-no');
      if (input && !input.value) input.value = result?.data?.invoice_no || '';
      const status = document.getElementById('pi-invoice-no-status');
      if (status && input?.value) status.textContent = 'Generated from your purchase invoice sequence. You can edit it.';
    }).catch(() => {
      const status = document.getElementById('pi-invoice-no-status');
      if (status) status.textContent = 'Number will be generated when you save.';
    });
  }
};

window.closePiModal = function() {
  // Release the camera if the barcode scanner was left open.
  try { window.closePiBarcodeScanner && window.closePiBarcodeScanner(); } catch (_) {}
  document.getElementById('pi-fullscreen-modal').style.display = 'none';
  document.querySelector('.page-container')?.classList.remove('pi-create-mode');
  document.body.classList.remove('pi-reference-mode');
  document.body.style.overflow = '';
  PI.editId = null;
  if (window.location.pathname.endsWith('/purchase-invoices/create')) Router.navigate('purchase_invoices');
};

// ── SUPPLIER HANDLING ────────────────────────────────────────
window.openSupplierDropdown = function() {
  const dd = document.getElementById('pi-supplier-dropdown');
  if (PI.supplier) return; // already selected
  renderSupplierDropdown(PI.suppliers);
  dd.style.display = 'block';
};

window.filterSuppliers = function() {
  const q = document.getElementById('pi-supplier-search').value.toLowerCase();
  const filtered = PI.suppliers.filter(s => `${s.company_name || ''} ${s.contact_person || ''} ${s.phone || ''}`.toLowerCase().includes(q));
  renderSupplierDropdown(filtered);
  document.getElementById('pi-supplier-dropdown').style.display = 'block';
};

function piSupplierLabel(supplier) {
  return supplier.company_name || supplier.contact_person || supplier.name || 'Unnamed supplier';
}

function piEncodedArg(value) {
  return encodeURIComponent(String(value || ''));
}

function piDecodeArg(value) {
  return decodeURIComponent(value || '');
}

function renderSupplierDropdown(list) {
  const dd = document.getElementById('pi-supplier-dropdown');
  if (!list.length) {
    dd.innerHTML = `<div class="ss-no-results">No suppliers found</div>`;
    return;
  }
  dd.innerHTML = list.map(s => {
    const name = piSupplierLabel(s);
    return `
    <div class="ss-dropdown-item ss-option" data-supplier-id="${Number(s.id) || 0}" data-supplier-name="${piEncodedArg(name)}" data-supplier-phone="${piEncodedArg(s.phone || s.email || '')}" data-supplier-address="${piEncodedArg(s.address || '')}" onmousedown="event.preventDefault();event.stopPropagation();piSelectSupplier(${Number(s.id) || 0},piDecodeArg('${piEncodedArg(name)}'),piDecodeArg('${piEncodedArg(s.phone || s.email || '')}'),piDecodeArg('${piEncodedArg(s.address || '')}'))">
      <span>${esc(name)}</span>
      <span class="ss-item-sub">${esc(s.phone||s.email||'')}</span>
    </div>
  `;
  }).join('');
  dd.querySelectorAll('.ss-option').forEach(option => {
    option.addEventListener('click', (event) => {
      event.stopPropagation();
      window.piSelectSupplier(
        Number(option.dataset.supplierId),
        piDecodeArg(option.dataset.supplierName),
        piDecodeArg(option.dataset.supplierPhone),
        piDecodeArg(option.dataset.supplierAddress)
      );
    });
  });
  // Add supplier option
  dd.innerHTML += `<div class="ss-dropdown-item ss-add" onclick="closeSupplierDropdown();openAddSupplierNested()"><i class="fa-solid fa-plus"></i> Add New Supplier</div>`;
}

function closeSupplierDropdown() {
  const dropdown = document.getElementById('pi-supplier-dropdown');
  if (dropdown) dropdown.style.display = 'none';
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('#supplier-ss')) closeSupplierDropdown();
  if (!event.target.closest('.pi-prod-wrap')) document.querySelectorAll('.pi-prod-dropdown').forEach(dd => { dd.style.display = 'none'; });
});

document.addEventListener('mousedown', (event) => {
  const option = event.target.closest('#pi-supplier-dropdown .ss-option');
  if (!option) return;
  event.preventDefault();
  event.stopPropagation();
  window.piSelectSupplier(
    Number(option.dataset.supplierId),
    piDecodeArg(option.dataset.supplierName),
    piDecodeArg(option.dataset.supplierPhone),
    piDecodeArg(option.dataset.supplierAddress)
  );
});

document.addEventListener('click', (event) => {
  const option = event.target.closest('#pi-supplier-dropdown .ss-option');
  if (!option) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  window.piSelectSupplier(
    Number(option.dataset.supplierId),
    piDecodeArg(option.dataset.supplierName),
    piDecodeArg(option.dataset.supplierPhone),
    piDecodeArg(option.dataset.supplierAddress)
  );
}, true);

window.piSelectSupplier = function(id, name, phone, address) {
  PI.supplier = { id, name, phone, address };
  document.getElementById('pi-supplier-search').value = name;
  closeSupplierDropdown();
  showSelectedSupplier(PI.supplier);
};

function showSelectedSupplier(sup) {
  const info = document.getElementById('pi-supplier-info');
  info.style.display = 'flex';
  document.getElementById('pi-supplier-avatar').textContent = (sup.name || 'S')[0];
  document.getElementById('pi-supplier-name').textContent = sup.name;
  document.getElementById('pi-supplier-phone').textContent = sup.phone ? `📞 ${sup.phone}` : '';
  document.getElementById('pi-supplier-address').textContent = sup.address || '';
  const addressField = document.getElementById('pi-supplier-address-field');
  if (addressField) addressField.value = sup.address || '';
}

window.clearSupplier = function() {
  PI.supplier = null;
  document.getElementById('pi-supplier-info').style.display = 'none';
  document.getElementById('pi-supplier-search').value = '';
  document.getElementById('pi-supplier-search').focus();
};

// ── ADD SUPPLIER NESTED ─────────────────────────────────────
window.openAddSupplierNested = function() {
  document.getElementById('pi-add-supplier-overlay').style.display = 'flex';
  ['pi-new-sup-name','pi-new-sup-company','pi-new-sup-phone','pi-new-sup-email','pi-new-sup-address','pi-new-sup-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
};
window.closeAddSupplierNested = function() {
  document.getElementById('pi-add-supplier-overlay').style.display = 'none';
};
window.saveNewPiSupplier = async function() {
  const name = document.getElementById('pi-new-sup-name').value.trim();
  const phone = document.getElementById('pi-new-sup-phone').value.trim();
  const address = document.getElementById('pi-new-sup-address').value.trim();
  const email = document.getElementById('pi-new-sup-email').value.trim();
  const notes = document.getElementById('pi-new-sup-notes').value.trim();
  const company = document.getElementById('pi-new-sup-company').value.trim();

  const supplierName = name || company;
  if (!supplierName) { showToast('Enter a supplier or company name', 'error'); return; }

  const btn = document.querySelector('#pi-add-supplier-overlay .btn-primary');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…'; }

  try {
    let newId;
    let localOnly = false;

    if (navigator.onLine) {
      try {
        // Generate CSRF token locally if missing (demo/offline fallback)
        if (!API.getCsrf()) {
          const fakeToken = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
          API.setCsrf(fakeToken);
        }
        const res = await API.suppliers.create({
          company_name: company || supplierName,
          contact_person: name || supplierName,
          phone,
          email,
          address,
          notes,
        });
        newId = res.data?.id || res.id;
      } catch (apiErr) {
        if (apiErr.offline) {
          // Network error — fall through to offline save
          localOnly = true;
        } else {
          throw apiErr;
        }
      }
    } else {
      localOnly = true;
    }

    if (localOnly) {
      // Offline save: save to IndexedDB + enqueue sync
      newId = DB.localId();
      const supplierData = {
        id: newId,
        company_name: company || supplierName,
        contact_person: name || supplierName,
        phone,
        email,
        address,
        notes,
        status: 'active',
        opening_balance: 0,
        current_balance: 0,
        user_id: Auth.getUser()?.id || 0,
        created_at: new Date().toISOString(),
        synced: 0,
      };
      await DB.put('suppliers', supplierData);
      await DB.enqueue('suppliers', 'create', {
        company_name: name,
        contact_person: name,
        phone,
        email,
        address,
        notes,
      });
      // Add to local suppliers list
      PI.suppliers.push(supplierData);
      showToast('Supplier saved offline — will sync when online', 'warning');
    } else {
      showToast('Supplier created', 'success');
      // Refresh suppliers from server
      try {
        const fresh = await API.suppliers.list();
        if (fresh?.data) {
          await DB.putAll('suppliers', fresh.data.map(s => ({ ...s, synced: 1 })));
          PI.suppliers = fresh.data;
        }
      } catch(_) {}
    }

    closeAddSupplierNested();
    piSelectSupplier(newId, company || supplierName, phone, address);
  } catch(e) {
    console.error('[saveNewPiSupplier]', e);
    showToast('Failed to create supplier: ' + (e.message || 'Unknown error'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Supplier'; }
  }
};

// ── PRODUCT ROWS ─────────────────────────────────────────────
window.addPiProductRow = function() {
  if (PI.products.length === 1 && !PI.products[0].product_name && !PI.products[0].product_id) PI.products = [];
  const draftRow = emptyPiProduct();
  draftRow._draft = true;
  PI.products.push(draftRow);
  renderPiProductRows();
  document.getElementById(`pi-prod-name-${PI.products.length - 1}`)?.focus();
};

function renderPiProductRows() {
  const tbody = document.getElementById('pi-products-tbody');
  if (!tbody) return;
  const hasProducts = PI.products.some(p => p.product_id || p.product_name);
  const hasDraftRow = PI.products.some(p => p._draft);
  const emptyState = document.getElementById('pi-empty-state');
  if (!hasProducts && !hasDraftRow) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.hidden = false;
    updatePiItemsTotals();
    return;
  }
  if (emptyState) emptyState.hidden = true;
  tbody.innerHTML = PI.products.map((p, sourceIndex) => ({ p, sourceIndex })).filter(({ p }) => p.product_id || p.product_name).map(({ p, sourceIndex }, idx) => `
    <tr data-index="${idx}">
      <td class="pi-display-index" data-label="#"><span class="pi-row-no">${idx + 1}</span></td>
      <td class="pi-display-product" data-label="Product">
        <strong>${esc(p.product_name || 'Unnamed product')}</strong>
        <small>SKU: ${esc(p.sku || '—')}<br>Barcode: ${esc(p.barcode || '—')}</small>
      </td>
      <td class="pi-display-value" data-label="Quantity">${esc(p.quantity ?? 0)}</td>
      <td class="pi-display-value" data-label="Unit">${esc(p.unit === 'pcs' || p.unit === 'psc' ? 'Pcs' : (p.unit || 'Pcs'))}</td>
      <td class="pi-display-value" data-label="Purchase Rate">${Fmt.currency(p.purchase_price || 0)}</td>
      <td class="pi-display-value" data-label="Discount">${Fmt.currency(p.discount_amount ?? p.discount ?? 0)}</td>
      <td class="pi-display-value" data-label="Sale Rate">${Fmt.currency(p.sale_price || 0)}</td>
      <td class="pi-display-value" data-label="Sale Disc.">${Fmt.currency(p.sale_discount || 0)}</td>
      <td class="pi-display-value" data-label="Tax %">${Number(p.tax || 0).toFixed(2)}%</td>
      <td class="pi-display-total" data-label="Total">${Fmt.currency(p.lineTotal || 0)}</td>
      <td class="pi-display-actions" data-label="Actions">
        <button class="pi-edit-btn" type="button" onclick="editPiProductRow(${sourceIndex})" title="Edit" aria-label="Edit item"><i class="fa-solid fa-pen"></i> Edit</button>
        <button class="pi-remove-btn" type="button" onclick="removePiProductRow(${sourceIndex})" title="Remove" aria-label="Remove item"><i class="fa-solid fa-trash-can"></i> Remove</button>
      </td>
    </tr>
  `).join('');
  const count = document.getElementById('pi-item-count');
  if (count) count.textContent = `${PI.products.filter(p => p.product_name).length} item${PI.products.filter(p => p.product_name).length === 1 ? '' : 's'}`;
  updatePiItemsTotals();
}

window.piProdSearch = function(idx) {
  const input = document.getElementById(`pi-prod-name-${idx}`);
  if (!input) return;
  const q = input.value.toLowerCase();
  let dd = document.getElementById(`pi-prod-dd-${idx}`);
  if (!dd) {
    dd = document.createElement('div');
    dd.id = `pi-prod-dd-${idx}`;
    dd.className = 'pi-prod-dropdown';
    dd.style.display = 'none';
    document.body.appendChild(dd);
  }
  if (PI.products[idx]) {
    PI.products[idx].product_id = null;
    PI.products[idx].product_name = input.value;
  }
  const filtered = PI.prods.filter(p => `${p.name || ''} ${p.sku || ''} ${p.barcode || ''}`.toLowerCase().includes(q));
  if (dd.parentElement !== document.body) document.body.appendChild(dd);
  dd.classList.add('pi-prod-dropdown-fixed');
  piOpenProductDropdown = idx;
  if (q.length === 0) {
    dd.innerHTML = PI.prods.slice(0, 8).map(p => `
      <div class="pi-prod-dd-item" onmousedown="selectPiProduct(${idx}, ${p.id}, piDecodeArg('${piEncodedArg(p.name)}'), ${p.purchase_price || 0}, ${p.sale_price || 0})">
        <span>${esc(p.name)}</span><span class="pi-prod-dd-sub">SKU: ${esc(p.sku || '')} | Stock: ${p.stock || 0} | Last purchase: ${Fmt.currency(p.last_purchase_price ?? (p.purchase_price || 0))}</span>
      </div>`).join('');
    dd.style.display = PI.prods.length ? 'block' : 'none';
    positionPiProductDropdown(idx);
    return;
  }
  if (filtered.length) {
    dd.innerHTML = filtered.slice(0, 8).map(p => `
      <div class="pi-prod-dd-item" onmousedown="selectPiProduct(${idx}, ${p.id}, piDecodeArg('${piEncodedArg(p.name)}'), ${p.purchase_price || 0}, ${p.sale_price || 0})">
        <span>${esc(p.name)}</span>
        <span class="pi-prod-dd-sub">SKU: ${esc(p.sku||'')} | Barcode: ${esc(p.barcode || '')} | Stock: ${p.stock || 0} | Last: ${Fmt.currency(p.last_purchase_price ?? (p.purchase_price || 0))} | Current: ${Fmt.currency(p.purchase_price || 0)}</span>
      </div>
    `).join('');
    dd.style.display = 'block';
  } else {
    dd.innerHTML = `<div class="pi-prod-dd-item" style="color:var(--txt-muted);cursor:default">No matching product. Create it from Products first.</div>`;
    dd.style.display = 'block';
  }
  positionPiProductDropdown(idx);
};

function positionPiProductDropdown(idx) {
  const input = document.getElementById(`pi-prod-name-${idx}`);
  const dd = document.getElementById(`pi-prod-dd-${idx}`);
  if (!input || !dd || dd.style.display === 'none') return;
  const rect = input.getBoundingClientRect();
  const gap = 4;
  const padding = 8;
  const spaceBelow = window.innerHeight - rect.bottom - gap;
  const openAbove = window.innerWidth <= 768 && spaceBelow < Math.min(230, window.innerHeight * 0.58);
  const maxHeight = Math.max(80, Math.min(230, (openAbove ? rect.top : spaceBelow) - padding));
  dd.style.position = 'fixed';
  dd.style.left = `${Math.max(padding, rect.left)}px`;
  dd.style.width = `${rect.width}px`;
  dd.style.maxHeight = `${maxHeight}px`;
  dd.style.top = openAbove
    ? `${Math.max(padding, rect.top - maxHeight - gap)}px`
    : `${rect.bottom + gap}px`;
}

window.piEntrySearch = function() {
  const input = document.getElementById('pi-entry-product');
  const dropdown = document.getElementById('pi-entry-dropdown');
  if (!input || !dropdown) return;
  const q = input.value.toLowerCase().trim();
  const products = PI.prods.filter(p => `${p.name || ''} ${p.sku || ''} ${p.barcode || ''}`.toLowerCase().includes(q)).slice(0, 8);
  dropdown.innerHTML = products.map(p => `<div class="pi-prod-dd-item" onmousedown="selectPiEntryProduct(${p.id})"><span>${esc(p.name)}</span><span class="pi-prod-dd-sub">SKU: ${esc(p.sku || '')} | Stock: ${p.stock || 0} | Rate: ${Fmt.currency(p.purchase_price || 0)}</span></div>`).join('') || '<div class="pi-prod-dd-item" style="color:var(--txt-muted);cursor:default">No matching product</div>';
  dropdown.style.display = 'block';
};

window.selectPiEntryProduct = function(id) {
  const product = PI.prods.find(p => Number(p.id) === Number(id));
  if (!product) return;
  piEntryProduct = product;
  document.getElementById('pi-entry-product').value = product.name || '';
  document.getElementById('pi-entry-barcode').value = product.barcode || '';
  document.getElementById('pi-entry-unit').value = product.unit || 'pcs';
  document.getElementById('pi-entry-purchase').value = product.purchase_price || 0;
  document.getElementById('pi-entry-sale').value = product.sale_price || 0;
  closePiEntryDropdown();
};

window.closePiEntryDropdown = function() {
  const dropdown = document.getElementById('pi-entry-dropdown');
  if (dropdown) dropdown.style.display = 'none';
};

window.addPiEntryProduct = function() {
  if (!piEntryProduct) { showToast('Select an existing product first', 'error'); return; }
  const quantity = parseFloat(document.getElementById('pi-entry-qty')?.value) || 0;
  if (quantity <= 0) { showToast('Quantity must be greater than zero', 'error'); return; }
  const product = piEntryProduct;
  const row = piEntryEditIndex === null ? emptyPiProduct() : (PI.products[piEntryEditIndex] || emptyPiProduct());
  row.product_id = product.id;
  row.product_name = product.name || '';
  row.sku = product.sku || '';
  row.barcode = document.getElementById('pi-entry-barcode').value.trim();
  row.unit = document.getElementById('pi-entry-unit').value || product.unit || 'pcs';
  row.stock = product.stock || 0;
  row.purchase_price = parseFloat(document.getElementById('pi-entry-purchase').value) || 0;
  row.sale_price = parseFloat(document.getElementById('pi-entry-sale').value) || 0;
  row.quantity = quantity;
  row.discount = parseFloat(document.getElementById('pi-entry-discount').value) || 0;
  row.discount_type = 'fixed';
  row.discount_amount = row.discount;
  row.sale_discount = parseFloat(document.getElementById('pi-entry-sale-discount').value) || 0;
  row.tax = parseFloat(document.getElementById('pi-entry-tax').value) || 0;
  row.tax_type = 'percent';
  const gross = row.quantity * row.purchase_price;
  row.tax_amount = Math.max(0, gross - row.discount_amount) * row.tax / 100;
  row.lineTotal = Math.max(0, gross - row.discount_amount + row.tax_amount);
  if (piEntryEditIndex === null) PI.products.push(row);
  piEntryEditIndex = null;
  renderPiProductRows();
  resetPiEntryForm();
  const submit = document.getElementById('pi-entry-submit');
  if (submit) submit.innerHTML = '<i class="fa-solid fa-plus"></i> Add Product';
  calcPiTotals();
};

function resetPiEntryForm() {
  document.getElementById('pi-entry-product').value = '';
  document.getElementById('pi-entry-barcode').value = '';
  document.getElementById('pi-entry-qty').value = '1';
  document.getElementById('pi-entry-purchase').value = '0';
  document.getElementById('pi-entry-discount').value = '0';
  document.getElementById('pi-entry-sale').value = '0';
  document.getElementById('pi-entry-sale-discount').value = '0';
  document.getElementById('pi-entry-tax').value = '0';
  piEntryProduct = null;
}

window.editPiProductRow = function(idx) {
  const product = PI.products[idx];
  if (!product) return;
  piEntryEditIndex = idx;
  piEntryProduct = PI.prods.find(p => Number(p.id) === Number(product.product_id)) || {
    id: product.product_id,
    name: product.product_name,
    sku: product.sku,
    barcode: product.barcode,
    unit: product.unit,
    purchase_price: product.purchase_price,
    sale_price: product.sale_price,
  };
  document.getElementById('pi-entry-product').value = product.product_name || '';
  document.getElementById('pi-entry-barcode').value = product.barcode || '';
  document.getElementById('pi-entry-qty').value = product.quantity || 1;
  document.getElementById('pi-entry-unit').value = product.unit || 'pcs';
  document.getElementById('pi-entry-purchase').value = product.purchase_price || 0;
  document.getElementById('pi-entry-discount').value = product.discount_amount ?? product.discount ?? 0;
  document.getElementById('pi-entry-sale').value = product.sale_price || 0;
  document.getElementById('pi-entry-sale-discount').value = product.sale_discount || 0;
  document.getElementById('pi-entry-tax').value = product.tax || 0;
  const submit = document.getElementById('pi-entry-submit');
  if (submit) submit.innerHTML = '<i class="fa-solid fa-check"></i> Update Product';
  document.getElementById('pi-product-entry')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.addEventListener('resize', () => {
  if (piOpenProductDropdown !== null) positionPiProductDropdown(piOpenProductDropdown);
});
window.addEventListener('scroll', () => {
  if (piOpenProductDropdown !== null) positionPiProductDropdown(piOpenProductDropdown);
}, true);

window.selectPiProduct = function(idx, id, name, rate, saleRate) {
  const product = PI.prods.find(p => Number(p.id) === Number(id)) || {};
  if (!PI.products[idx] || !document.getElementById(`pi-prod-rate-${idx}`)) {
    piEntryProduct = product;
    document.getElementById('pi-entry-product').value = product.name || name || '';
    document.getElementById('pi-entry-barcode').value = product.barcode || '';
    document.getElementById('pi-entry-unit').value = product.unit || 'pcs';
    document.getElementById('pi-entry-purchase').value = product.purchase_price ?? rate ?? 0;
    document.getElementById('pi-entry-sale').value = product.sale_price ?? saleRate ?? 0;
    closePiEntryDropdown();
    return;
  }
  const duplicate = PI.products.findIndex((p, row) => row !== idx && Number(p.product_id) === Number(id));
  if (duplicate >= 0) {
    PI.products[duplicate].quantity = (parseFloat(PI.products[duplicate].quantity) || 0) + 1;
    PI.products.splice(idx, 1);
    renderPiProductRows();
    piUpdateLine(duplicate > idx ? duplicate - 1 : duplicate);
    return;
  }
  PI.products[idx].product_id = id;
  PI.products[idx].product_name = name;
  PI.products[idx].sku = product.sku || '';
  PI.products[idx].barcode = product.barcode || '';
  PI.products[idx].unit = product.unit || 'pcs';
  PI.products[idx].stock = product.stock || 0;
  PI.products[idx].purchase_price = product.purchase_price ?? rate;
  PI.products[idx].sale_price = saleRate || '';
  document.getElementById(`pi-prod-name-${idx}`).value = name;
  document.getElementById(`pi-prod-rate-${idx}`).value = PI.products[idx].purchase_price;
  document.getElementById(`pi-prod-barcode-${idx}`).value = PI.products[idx].barcode;
  document.getElementById(`pi-prod-unit-${idx}`).value = PI.products[idx].unit;
  closePiProdDropdown(idx);
  piUpdateLine(idx);
};

window.removePiProductRow = function(idx) {
  if (!PI.products[idx]) return;
  if (!confirm('Remove this product from the invoice?')) return;
  PI.products.splice(idx, 1);
  renderPiProductRows();
  calcPiTotals();
};

function closePiProdDropdown(idx) {
  const dd = document.getElementById(`pi-prod-dd-${idx}`);
  if (dd) {
    dd.style.display = 'none';
    if (dd.parentElement === document.body) dd.remove();
  }
  if (piOpenProductDropdown === idx) piOpenProductDropdown = null;
}

window.piUpdateBarcode = function(idx) {
  const barcode = document.getElementById(`pi-prod-barcode-${idx}`)?.value.trim();
  const product = PI.prods.find(p => String(p.barcode || '') === barcode);
  if (product) selectPiProduct(idx, product.id, product.name, product.purchase_price, product.sale_price);
};

window.handlePiBarcodeKey = function(event) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const barcode = event.target.value.trim();
  const product = PI.prods.find(p => String(p.barcode || '') === barcode);
  if (product) {
    if (!PI.products.length || !PI.products.some(p => p.product_id || p.product_name)) {
      PI.products = [emptyPiProduct()];
      renderPiProductRows();
    }
    const existing = PI.products.findIndex(p => Number(p.product_id) === Number(product.id));
    if (existing >= 0) { PI.products[existing].quantity = (parseFloat(PI.products[existing].quantity) || 0) + 1; renderPiProductRows(); piUpdateLine(existing); }
    else {
      const target = Math.max(0, PI.products.length - 1);
      selectPiProduct(target, product.id, product.name, product.purchase_price, product.sale_price);
      PI.products = PI.products.filter(p => p.product_id || p.product_name);
      addPiEntryProduct();
    }
    event.target.value = '';
  } else showToast('No product found for this barcode', 'warning');
};

window.openPiBarcodeScanner = function() {
  const input = document.getElementById('pi-barcode-input');
  const camera = document.getElementById('pi-camera-scanner');
  const supportsCamera = window.BarcodeDetector && navigator.mediaDevices?.getUserMedia;
  if (!supportsCamera) {
    // USB / Bluetooth barcode scanners behave like a keyboard — focus the hidden field.
    input?.focus();
    showToast('No camera barcode scanner in this browser. Use a USB/Bluetooth scanner (scan then press Enter).', 'info');
    return;
  }
  camera.classList.add('open');
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(stream => {
    const video = document.getElementById('pi-camera-video');
    video.srcObject = stream;
    const detector = new BarcodeDetector();
    const scan = async () => {
      if (!camera.classList.contains('open')) return;
      let codes = [];
      try { codes = await detector.detect(video); } catch (_) {}
      if (codes && codes[0]) {
        input.value = codes[0].rawValue;
        handlePiBarcodeKey({ key: 'Enter', preventDefault() {}, target: input });
        closePiBarcodeScanner();
        return;
      }
      requestAnimationFrame(scan);
    };
    scan();
  }).catch(() => {
    camera.classList.remove('open');
    showToast('Camera access unavailable. Use a USB/Bluetooth scanner.', 'warning');
    input?.focus();
  });
};

window.closePiBarcodeScanner = function() {
  const camera = document.getElementById('pi-camera-scanner');
  const video = document.getElementById('pi-camera-video');
  video?.srcObject?.getTracks().forEach(track => track.stop());
  if (camera) camera.classList.remove('open');
};

// Auto-create product on enter
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target?.classList?.contains('pi-prod-input')) {
    e.preventDefault();
    const idx = parseInt(e.target.id.replace('pi-prod-name-', ''));
    if (isNaN(idx)) return;
    const val = e.target.value.trim();
    if (!val) return;
    // If no match found, auto-create
    const exists = PI.prods.find(p => p.name.toLowerCase() === val.toLowerCase());
    if (exists) {
      selectPiProduct(idx, exists.id, exists.name, exists.purchase_price || 0, exists.sale_price || 0);
    } else {
      showToast('Select an existing product. Create it from Products first.', 'warning');
    }
  }
});

// ── CALCULATIONS ────────────────────────────────────────────
window.piUpdateLine = function(idx) {
  const rate = parseFloat(document.getElementById(`pi-prod-rate-${idx}`)?.value) || 0;
  const qty = parseFloat(document.getElementById(`pi-prod-qty-${idx}`)?.value) || 0;
  const discount = parseFloat(document.getElementById(`pi-prod-discount-${idx}`)?.value) || 0;
  const discountType = document.getElementById(`pi-prod-discount-type-${idx}`)?.value || 'percent';
  const tax = parseFloat(document.getElementById(`pi-prod-tax-${idx}`)?.value) || 0;
  const taxType = document.getElementById(`pi-prod-tax-type-${idx}`)?.value || 'percent';
  const subtotal = rate * qty;
  const discountAmount = discountType === 'percent' ? subtotal * Math.min(discount, 100) / 100 : discount;
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxType === 'percent' ? taxable * Math.max(0, tax) / 100 : tax;
  const total = taxable + taxAmount;
  const totalEl = document.getElementById(`pi-prod-total-${idx}`);
  if (totalEl) totalEl.textContent = Fmt.currency(total);
  PI.products[idx].purchase_price = rate;
  PI.products[idx].quantity = qty;
  PI.products[idx].unit = document.getElementById(`pi-prod-unit-${idx}`)?.value || 'pcs';
  PI.products[idx].discount = discount;
  PI.products[idx].discount_type = discountType;
  PI.products[idx].discount_amount = discountAmount;
  PI.products[idx].tax = tax;
  PI.products[idx].tax_type = taxType;
  PI.products[idx].tax_amount = taxAmount;
  PI.products[idx].lineTotal = total;
  calcPiTotals();
};

function getPiTotals() {
  return PI.products.filter(p => p.product_id || p.product_name).reduce((totals, p) => {
    const quantity = Math.max(0, parseFloat(p.quantity) || 0);
    const rate = Math.max(0, parseFloat(p.purchase_price) || 0);
    const subtotal = rate * quantity;
    const discount = Math.min(subtotal, Math.max(0, parseFloat(p.discount_amount) || 0));
    const tax = Math.max(0, parseFloat(p.tax_amount) || 0);
    totals.items += 1;
    totals.quantity += quantity;
    totals.subtotal += subtotal;
    totals.discount += discount;
    totals.tax += tax;
    totals.total += Math.max(0, subtotal - discount + tax);
    return totals;
  }, { items: 0, quantity: 0, subtotal: 0, discount: 0, tax: 0, total: 0 });
}

function updatePiItemsTotals() {
  const totals = getPiTotals();
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('pi-items-total-count', totals.items);
  set('pi-items-total-quantity', Number.isInteger(totals.quantity) ? totals.quantity : totals.quantity.toFixed(2));
  set('pi-items-subtotal', Fmt.currency(totals.subtotal));
  set('pi-items-discount', Fmt.currency(totals.discount));
  set('pi-items-tax', Fmt.currency(totals.tax));
  set('pi-items-grand-total', Fmt.currency(totals.total));
}

window.calcPiTotals = function() {
  const total = getPiTotals().total;
  const paid = parseFloat(document.getElementById('pi-paid-amount')?.value) || 0;
  const credit = Math.max(0, total - paid);

  document.getElementById('pi-summary-total').textContent = Fmt.currency(total);
  document.getElementById('pi-summary-paid').textContent = Fmt.currency(paid);
  document.getElementById('pi-summary-credit').textContent = Fmt.currency(credit);
  document.getElementById('pi-credit-amount').textContent = Fmt.currency(credit);
  updatePiItemsTotals();
};

// ── CONFIRMATION ─────────────────────────────────────────────
window.confirmPiInvoice = async function() {
  if (!PI.supplier) { showToast('Please select a supplier', 'error'); return; }
  if (!PI.products.length || !PI.products.some(p => p.product_name)) { showToast('Add at least one product', 'error'); return; }
  if (PI.products.some(p => !p.product_id)) { showToast('Each line must use an existing product', 'error'); return; }
  if (PI.products.some(p => !(parseFloat(p.quantity) > 0))) { showToast('Quantity must be greater than zero', 'error'); return; }
  if (!document.getElementById('pi-invoice-date')?.value) { showToast('Invoice date is required', 'error'); return; }
  if (!(await validatePiInvoiceNumber())) return;
  PI.saveStatus = null;
  const total = getPiTotals().total;
  const paid = parseFloat(document.getElementById('pi-paid-amount')?.value) || 0;
  const credit = Math.max(0, total - paid);
  const count = PI.products.filter(p => p.product_name).length;

  document.getElementById('pi-confirm-supplier').textContent = PI.supplier.name;
  document.getElementById('pi-confirm-total').textContent = Fmt.currency(total);
  document.getElementById('pi-confirm-paid').textContent = Fmt.currency(paid);
  document.getElementById('pi-confirm-credit').textContent = Fmt.currency(credit);
  document.getElementById('pi-confirm-count').textContent = count;

  document.getElementById('pi-confirm-overlay').style.display = 'flex';
};

window.savePiDraft = async function() {
  if (!PI.supplier) { showToast('Please select a supplier before saving the draft', 'error'); return; }
  if (!PI.products.some(p => p.product_id && parseFloat(p.quantity) > 0)) {
    showToast('Add at least one existing product before saving the draft', 'error');
    return;
  }
  if (!document.getElementById('pi-invoice-date')?.value) { showToast('Invoice date is required', 'error'); return; }
  if (!(await validatePiInvoiceNumber())) return;
  PI.saveStatus = 'draft';
  const total = getPiTotals().total;
  document.getElementById('pi-confirm-supplier').textContent = PI.supplier.name;
  document.getElementById('pi-confirm-total').textContent = Fmt.currency(total);
  document.getElementById('pi-confirm-paid').textContent = Fmt.currency(0);
  document.getElementById('pi-confirm-credit').textContent = Fmt.currency(total);
  document.getElementById('pi-confirm-count').textContent = PI.products.filter(p => p.product_id).length;
  document.getElementById('pi-confirm-overlay').style.display = 'flex';
};

window.closePiConfirm = function() {
  document.getElementById('pi-confirm-overlay').style.display = 'none';
};

// ── SAVE ─────────────────────────────────────────────────────
window.savePiInvoice = async function() {
  const btn = document.getElementById('pi-confirm-save-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';

  const totals = getPiTotals();
  const total = totals.total;
  const paid = parseFloat(document.getElementById('pi-paid-amount')?.value) || 0;
  const credit = Math.max(0, total - paid);
  const notes = document.getElementById('pi-other-notes')?.value || document.getElementById('pi-notes')?.value || '';

  // Build items payload
  const items = PI.products.filter(p => p.product_name).map(p => ({
    product_id: p.product_id || 0,
    product_name: p.product_name,
    quantity: parseFloat(p.quantity || 1),
    purchase_price: parseFloat(p.purchase_price || 0),
    sale_price: p.sale_price ? parseFloat(p.sale_price) : null,
    discount: parseFloat(p.discount_amount || 0),
    tax_amount: parseFloat(p.tax_amount || 0),
    tax_rate: p.tax_type === 'percent' ? parseFloat(p.tax || 0) : 0,
    total: parseFloat(p.lineTotal || 0),
  }));

  const type = paid >= total ? 'cash' : paid > 0 ? 'partial' : 'credit';
  const status = PI.saveStatus === 'draft' ? 'draft' : paid >= total ? 'paid' : 'received';

  const payload = {
    supplier_id: PI.supplier.id,
    invoice_no: document.getElementById('pi-invoice-no')?.value.trim() || '',
    date: document.getElementById('pi-invoice-date')?.value.slice(0, 10),
    invoice_datetime: document.getElementById('pi-invoice-date')?.value,
    due_date: document.getElementById('pi-due-date')?.value || null,
    reference: document.getElementById('pi-reference')?.value.trim() || '',
    type,
    status,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax_amount: totals.tax,
    tax_rate: totals.subtotal > 0 ? (totals.tax / totals.subtotal) * 100 : 0,
    total,
    paid_amount: paid,
    balance: credit,
    notes,
    items,
  };

  try {
    let result;
    if (PI.editId) {
      // Update existing
      result = await API.purchaseInvoices.update(PI.editId, payload);
      showToast('Invoice updated', 'success');
    } else {
      result = await API.purchaseInvoices.create(payload);
      showToast(status === 'draft' ? 'Draft saved' : 'Invoice created', 'success');
    }
    const invNo = result?.data?.invoice_no || result?.invoice_no || PI.editId || '';
    closePiConfirm();
    closePiModal();
    await Pages.purchaseInvoices();

    // Show print dialog
    document.getElementById('pi-print-invno').textContent = `#${invNo}`;
    document.getElementById('pi-print-overlay').style.display = 'flex';
    window._lastPiInvoice = { ...payload, invoice_no: invNo, id: result?.data?.id || result?.id };
  } catch (e) {
    showToast('Failed to save invoice: ' + (e.message || 'Error'), 'error');
  } finally {
    PI.saveStatus = null;
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm & Save';
  }
};

// ── PRINT / PDF ──────────────────────────────────────────────
window.printPiInvoice = function() {
  closePiPrint();
  const inv = window._lastPiInvoice || {};
  const items = PI.products.filter(p => p.product_name);
  const total = getPiTotals().total;
  const paid = parseFloat(inv.paid_amount || 0);
  const credit = Math.max(0, total - paid);

  const w = window.open('', '_blank', 'width=800,height=600');
  w.document.write(`
    <!DOCTYPE html><html><head><title>Purchase Invoice ${esc(inv.invoice_no||'')}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #000; }
      .print-header { text-align: center; margin-bottom: 24px; }
      .print-header h1 { font-size: 24px; margin-bottom: 4px; }
      .print-header p { font-size: 11px; color: #666; }
      .print-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
      .print-table { width: 100%; border-collapse: collapse; }
      .print-table th, .print-table td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; font-size: 12px; }
      .print-table th { background: #f5f5f5; }
      .print-totals { text-align: right; margin-top: 16px; }
      .print-totals p { margin: 4px 0; font-size: 12px; }
      .print-totals .grand { font-size: 16px; font-weight: bold; }
      .print-footer { text-align: center; margin-top: 40px; font-size: 10px; color: #999; }
    </style></head><body>
    <div class="print-header">
      <h1>PURCHASE INVOICE</h1>
      <p>${esc(inv.invoice_no||'')} | ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p>
    </div>
    <div class="print-info">
      <div><strong>Supplier:</strong> ${esc(PI.supplier?.name||'')}<br>${esc(PI.supplier?.phone||'')}${PI.supplier?.address ? '<br>'+esc(PI.supplier.address) : ''}</div>
      <div style="text-align:right"><strong>Status:</strong> ${paid >= total ? 'Paid' : paid > 0 ? 'Partial' : 'Credit'}</div>
    </div>
    <table class="print-table">
      <thead><tr><th>#</th><th>Product</th><th>Rate</th><th>Qty</th><th>Total</th></tr></thead>
      <tbody>
        ${items.map((p, i) => `<tr><td>${i+1}</td><td>${esc(p.product_name)}</td><td>$${parseFloat(p.purchase_price||0).toFixed(2)}</td><td>${p.quantity}</td><td>$${(parseFloat(p.purchase_price||0)*parseFloat(p.quantity||0)).toFixed(2)}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="print-totals">
      <p>Total: <strong>$${total.toFixed(2)}</strong></p>
      <p>Paid: $${paid.toFixed(2)}</p>
      <p class="grand">Credit: $${credit.toFixed(2)}</p>
    </div>
    <div class="print-footer">Generated by BizBrain ERP</div>
    <script>window.print();window.close();</script>
  </body></html>`);
  w.document.close();
};

window.downloadPiPDF = function() {
  showToast('PDF download coming soon. Use Print & select "Save as PDF".', 'info');
};

window.closePiPrint = function() {
  document.getElementById('pi-print-overlay').style.display = 'none';
};

// ── VIEW / EDIT / DELETE / PRINT EXISTING ────────────────────
window.viewPiInvoice = async function(id) {
  try {
    const inv = await API.purchaseInvoices.get(id);
    showToast(`Invoice #${inv?.data?.invoice_no || inv?.invoice_no || id}`, 'info');
  } catch(e) { showToast('Failed to load invoice', 'error'); }
};

window.editPiInvoice = async function(id) {
  try {
    const res = await API.purchaseInvoices.get(id);
    const inv = res?.data || res;
    if (!inv) { showToast('Invoice not found', 'error'); return; }
    openPurchaseInvoiceModal(inv);
  } catch(e) { showToast('Failed to load invoice for editing', 'error'); }
};

window.deletePurchase = async function(id) {
  if (!confirm('Delete this purchase invoice permanently?')) return;
  try {
    await API.purchaseInvoices.delete(id);
    showToast('Deleted successfully', 'success');
    await Pages.purchaseInvoices();
  } catch(e) { showToast('Failed to delete', 'error'); }
};

window.printPiExisting = async function(id) {
  try {
    const res = await API.purchaseInvoices.get(id);
    const inv = res?.data || res;
    if (!inv) { showToast('Invoice not found', 'error'); return; }
    // Set state and print
    PI.supplier = { id: inv.supplier_id, name: inv.supplier_name, phone: '', address: '' };
    PI.products = (inv.items || []).map(it => ({
      product_id: it.product_id,
      product_name: it.product_name,
      purchase_price: parseFloat(it.purchase_price),
      sale_price: it.sale_price ? parseFloat(it.sale_price) : '',
      quantity: parseFloat(it.quantity),
      lineTotal: parseFloat(it.total),
    }));
    window._lastPiInvoice = { invoice_no: inv.invoice_no, paid_amount: inv.paid_amount };
    printPiInvoice();
  } catch(e) { showToast('Failed to load invoice', 'error'); }
};

// ── SALES INVOICES ────────────────────────────────────────────
Pages.salesInvoices = async function () {
  let list = [];
  try { list = await API.salesInvoices.list(); } catch(e) {}
  const tbody = document.getElementById('sales-tbody');
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-file-invoice"></i><h3>No sales</h3></div></td></tr>`; return; }
  tbody.innerHTML = list.map(i => `
    <tr>
      <td style="font-weight:600" data-label="Invoice #">${esc(i.invoice_no)}</td>
      <td class="muted" data-label="Customer">${esc(i.customer_name || '—')}</td>
      <td class="muted" data-label="Date">${Fmt.date(i.date)}</td>
      <td style="font-weight:600" data-label="Total">${Fmt.currency(i.total)}</td>
      <td class="muted" data-label="Paid">${Fmt.currency(i.paid_amount)}</td>
      <td class="muted" data-label="Balance">${Fmt.currency(i.balance)}</td>
      <td data-label="Status"><span class="badge badge-${i.status === 'paid' ? 'success' : i.status === 'sent' ? 'info' : 'warning'}">${i.status}</span></td>
      <td data-label="Actions"><div class="table-actions"><button class="action-btn delete" onclick="deleteSale('${i.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button></div></td>
    </tr>`).join('');
};
window.openSalesInvoiceModal = function() { showToast('Sales form coming soon', 'info'); };
window.deleteSale = async function(id) { if (!confirm('Delete?')) return; try { await API.salesInvoices.delete(id); showToast('Deleted', 'success'); await Pages.salesInvoices(); } catch(e) { showToast('Failed', 'error'); } };

// ── PURCHASE RETURNS ─────────────────────────────────────────
Pages.purchaseReturns = async function () {
  let list = [];
  try { list = await API.purchaseReturns.list(); } catch(e) {}
  const tbody = document.getElementById('preturn-tbody');
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-arrow-left"></i><h3>No purchase returns</h3></div></td></tr>`; return; }
  tbody.innerHTML = list.map(r => `
    <tr>
      <td style="font-weight:600" data-label="Return #">${esc(r.return_no)}</td>
      <td class="muted" data-label="Supplier">${esc(r.supplier_name || '—')}</td>
      <td class="muted col-opt" data-label="Date">${Fmt.date(r.date)}</td>
      <td style="font-weight:600" data-label="Total">${Fmt.currency(r.total)}</td>
      <td class="muted col-opt" data-label="Reason">${esc(r.reason || '—')}</td>
      <td data-label="Status"><span class="badge badge-${r.status === 'completed' ? 'success' : 'warning'}">${r.status}</span></td>
      <td data-label="Actions"><div class="table-actions"><button class="action-btn delete" onclick="deletePR('${r.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button></div></td>
    </tr>`).join('');
};
window.openPurchaseReturnModal = function() { showToast('Purchase return form coming soon', 'info'); };
window.deletePR = async function(id) { if (!confirm('Delete?')) return; try { await API.purchaseReturns.delete(id); showToast('Deleted', 'success'); await Pages.purchaseReturns(); } catch(e) { showToast('Failed', 'error'); } };

// ── SALES RETURNS ─────────────────────────────────────────────
Pages.salesReturns = async function () {
  let list = [];
  try { list = await API.salesReturns.list(); } catch(e) {}
  const tbody = document.getElementById('sreturn-tbody');
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-arrow-right"></i><h3>No sales returns</h3></div></td></tr>`; return; }
  tbody.innerHTML = list.map(r => `
    <tr>
      <td style="font-weight:600" data-label="Return #">${esc(r.return_no)}</td>
      <td class="muted" data-label="Customer">${esc(r.customer_name || '—')}</td>
      <td class="muted col-opt" data-label="Date">${Fmt.date(r.date)}</td>
      <td style="font-weight:600" data-label="Total">${Fmt.currency(r.total)}</td>
      <td class="muted col-opt" data-label="Reason">${esc(r.reason || '—')}</td>
      <td data-label="Status"><span class="badge badge-${r.status === 'completed' ? 'success' : 'warning'}">${r.status}</span></td>
      <td data-label="Actions"><div class="table-actions"><button class="action-btn delete" onclick="deleteSR('${r.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button></div></td>
    </tr>`).join('');
};
window.openSalesReturnModal = function() { showToast('Sales return form coming soon', 'info'); };
window.deleteSR = async function(id) { if (!confirm('Delete?')) return; try { await API.salesReturns.delete(id); showToast('Deleted', 'success'); await Pages.salesReturns(); } catch(e) { showToast('Failed', 'error'); } };


// ── ACCOUNTS ──────────────────────────────────────────────────
Pages.accounts = async function () {
  try {
    const [suppliers, customers] = await Promise.all([API.suppliers.list(), API.customers.list()]);
    const payables = suppliers.reduce((s, su) => s + parseFloat(su.current_balance || 0), 0);
    const receivables = customers.reduce((s, c) => s + parseFloat(c.current_balance || 0), 0);
    setEl('acc-total-receivables', Fmt.currency(receivables));
    setEl('acc-total-payables', Fmt.currency(payables));
    setEl('acc-due-sales', Fmt.currency(receivables));
    setEl('acc-due-purchases', Fmt.currency(payables));

    const sb = document.getElementById('acc-suppliers-body');
    if (sb) sb.innerHTML = suppliers.map(s => `<tr><td data-label="Supplier">${esc(s.company_name)}</td><td data-label="Balance" style="font-weight:600;color:var(--danger)">${Fmt.currency(s.current_balance)}</td></tr>`).join('') || `<tr><td colspan="2"><p style="color:var(--txt-muted);text-align:center">No suppliers</p></td></tr>`;

    const cb = document.getElementById('acc-customers-body');
    if (cb) cb.innerHTML = customers.map(c => `<tr><td data-label="Customer">${esc(c.name)}</td><td data-label="Balance" style="font-weight:600;color:var(--success)">${Fmt.currency(c.current_balance)}</td></tr>`).join('') || `<tr><td colspan="2"><p style="color:var(--txt-muted);text-align:center">No customers</p></td></tr>`;
  } catch(e) { showToast('Failed to load accounts', 'error'); }
};

// ── TEAM ──────────────────────────────────────────────────────
Pages.team = async function () {
  let members = [];
  try { members = await API.team.list(); } catch(e) {}
  const tbody = document.getElementById('team-tbody');
  if (!tbody) return;
  if (!members.length) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-users-gear"></i><h3>No team members</h3></div></td></tr>`; return; }
  tbody.innerHTML = members.map(m => `
    <tr>
      <td data-label="Member"><div class="cell-name">${esc(m.name)}</div></td>
      <td class="muted" data-label="Email">${esc(m.email)}</td>
      <td class="muted col-opt" data-label="Phone">${esc(m.phone || '—')}</td>
      <td class="muted col-secondary" data-label="Role">${esc(m.role_name || '—')}</td>
      <td data-label="Status"><span class="badge badge-${m.status === 'active' ? 'success' : 'muted'}">${m.status}</span></td>
      <td data-label="Actions"><div class="table-actions">
        <button class="action-btn edit" onclick="editTeamMember('${m.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="action-btn delete" onclick="deleteTeamMember('${m.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div></td>
    </tr>`).join('');
};
window.openTeamMemberModal = function() { showToast('Team form coming soon', 'info'); };
window.editTeamMember = async function(id) { showToast('Edit coming soon', 'info'); };
window.deleteTeamMember = async function(id) { if (!confirm('Delete?')) return; try { await API.team.delete(id); showToast('Deleted', 'success'); await Pages.team(); } catch(e) { showToast('Failed', 'error'); } };

// ── Global button openers ─────────────────────────────────────
window.openExpenseModal = openExpenseModal;
