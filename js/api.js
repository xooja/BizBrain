/**
 * BizBrain — api.js
 * Central Fetch API wrapper.
 * All HTTP communication to the PHP backend goes through here.
 */

const API = (() => {
  const BASE = './php/api';

  // ── CSRF token (stored after login) ─────────────────────
  let _csrfToken = '';

  function setCsrf(token) { _csrfToken = token; }
  function getCsrf()      { return _csrfToken; }

  // ── Core request ────────────────────────────────────────
  async function request(method, endpoint, data = null, isFormData = false) {
    const url = `${BASE}/${endpoint}`;
    const headers = {};

    if (_csrfToken) headers['X-CSRF-Token'] = _csrfToken;

    let body = null;
    if (data !== null) {
      if (isFormData) {
        body = data; // FormData - no Content-Type header needed
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(data);
      }
    }

    const opts = { method, headers, credentials: 'include' };
    if (body && method !== 'GET') opts.body = body;

    try {
      const res = await fetch(url, opts);
      const json = await res.json();

      if (!res.ok) {
        throw { status: res.status, message: json.message || 'Server error', data: json };
      }

      return json;
    } catch (err) {
      if (err.status) throw err; // structured error from above
      throw { status: 0, message: 'Network error — working offline', offline: true };
    }
  }

  const get    = (ep, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', qs ? `${ep}?${qs}` : ep);
  };
  const post   = (ep, data, fd)  => request('POST',   ep, data, fd);
  const put    = (ep, data)       => request('PUT',    ep, data);
  const del    = (ep)             => request('DELETE', ep);

  // ── Auth ─────────────────────────────────────────────────
  const auth = {
    login:     (email, password, remember) => post('auth/login.php',   { email, password, remember }),
    logout:    ()                           => post('auth/logout.php',  {}),
    check:     ()                           => get('auth/check.php'),
    verifyPin: (pin)                       => post('auth/verify-pin.php', { pin }),
  };

  // ── Expenses ─────────────────────────────────────────────
  const expenses = {
    list:   (params)   => get('expenses.php',          params),
    get:    (id)       => get(`expenses.php?id=${id}`),
    create: (data)     => post('expenses.php',          data),
    update: (id, data) => put(`expenses.php?id=${id}`,  data),
    delete: (id)       => del(`expenses.php?id=${id}`),
  };

  // ── Reports ─────────────────────────────────────────────
  const reports = {
    summary: (params) => get('reports.php', params),
    revenue: (params) => get('reports.php?type=revenue', params),
  };

  // ── Settings ─────────────────────────────────────────────
  const settings = {
    get:  ()     => get('settings.php'),
    save: (data) => post('settings.php', data),
  };

  // ── Sync ─────────────────────────────────────────────────
  const sync = {
    push: (payload) => post('sync.php', payload),
    pull: (params)  => get('sync.php',  params),
  };

  // ── Dashboard ────────────────────────────────────────────
  const dashboard = {
    stats:    () => get('dashboard.php'),
  };

  // ── Products ─────────────────────────────────────────────
  const products = {
    list:   (params)   => get('products.php',         params),
    get:    (id)       => get(`products.php?id=${id}`),
    create: (data)     => post('products.php',         data),
    update: (id, data) => put(`products.php?id=${id}`, data),
    delete: (id)       => del(`products.php?id=${id}`),
  };

  // ── Categories ─────────────────────────────────────────
  const categories = {
    list:   (params)   => get('categories.php',          params),
    get:    (id)       => get(`categories.php?id=${id}`),
    create: (data)     => post('categories.php',          data),
    update: (id, data) => put(`categories.php?id=${id}`,  data),
    delete: (id)       => del(`categories.php?id=${id}`),
  };

  // ── Suppliers ─────────────────────────────────────────
  const suppliers = {
    list:   (params)   => get('suppliers.php',          params),
    get:    (id)       => get(`suppliers.php?id=${id}`),
    create: (data)     => post('suppliers.php',          data),
    update: (id, data) => put(`suppliers.php?id=${id}`,  data),
    delete: (id)       => del(`suppliers.php?id=${id}`),
  };

  // ── Customers ─────────────────────────────────────────
  const customers = {
    list:   (params)   => get('customers.php',          params),
    get:    (id)       => get(`customers.php?id=${id}`),
    create: (data)     => post('customers.php',          data),
    update: (id, data) => put(`customers.php?id=${id}`,  data),
    delete: (id)       => del(`customers.php?id=${id}`),
  };

  // ── Purchase Invoices ─────────────────────────────────
  const purchaseInvoices = {
    list:   (params)   => get('purchase_invoices.php',          params),
    get:    (id)       => get(`purchase_invoices.php?id=${id}`),
    nextNumber: ()     => get('purchase_invoices.php', { next_invoice_no: 1 }),
    checkNumber: (number, excludeId) => get('purchase_invoices.php', { check_invoice_no: number, exclude_id: excludeId || '' }),
    create: (data)     => post('purchase_invoices.php',          data),
    update: (id, data) => put(`purchase_invoices.php?id=${id}`,  data),
    delete: (id)       => del(`purchase_invoices.php?id=${id}`),
  };

  // ── Sales Invoices ─────────────────────────────────────
  const salesInvoices = {
    list:   (params)   => get('sales_invoices.php',          params),
    get:    (id)       => get(`sales_invoices.php?id=${id}`),
    create: (data)     => post('sales_invoices.php',          data),
    update: (id, data) => put(`sales_invoices.php?id=${id}`,  data),
    delete: (id)       => del(`sales_invoices.php?id=${id}`),
  };

  // ── Purchase Returns ──────────────────────────────────
  const purchaseReturns = {
    list:   (params)   => get('purchase_returns.php',          params),
    get:    (id)       => get(`purchase_returns.php?id=${id}`),
    create: (data)     => post('purchase_returns.php',          data),
    update: (id, data) => put(`purchase_returns.php?id=${id}`,  data),
    delete: (id)       => del(`purchase_returns.php?id=${id}`),
  };

  // ── Sales Returns ─────────────────────────────────────
  const salesReturns = {
    list:   (params)   => get('sales_returns.php',          params),
    get:    (id)       => get(`sales_returns.php?id=${id}`),
    create: (data)     => post('sales_returns.php',          data),
    update: (id, data) => put(`sales_returns.php?id=${id}`,  data),
    delete: (id)       => del(`sales_returns.php?id=${id}`),
  };

  // ── Stock Movements ─────────────────────────────────
  const stock = {
    list: (params) => get('stock.php', params),
  };

  // ── Roles & Team ─────────────────────────────────────
  const roles = {
    list:   (params)   => get('roles.php',              params),
    get:    (id)       => get(`roles.php?id=${id}`),
    create: (data)     => post('roles.php',              data),
    update: (id, data) => put(`roles.php?id=${id}`,      data),
    delete: (id)       => del(`roles.php?id=${id}`),
  };

  const team = {
    list:   (params)   => get('team.php',               params),
    get:    (id)       => get(`team.php?id=${id}`),
    create: (data)     => post('team.php',               data),
    update: (id, data) => put(`team.php?id=${id}`,       data),
    delete: (id)       => del(`team.php?id=${id}`),
  };

  // ── Ledger (computed from invoices + payments) ──────
  const ledger = {
    list: (params) => get('ledger.php', params),
  };

  // ── Activity Logs ────────────────────────────────────
  const activity = {
    list: (params) => get('activity.php', params),
  };

  // ── Payments (filtered) ──────────────────────────────
  const payments = {
    list:   (params)   => get('payments.php',              params),
    get:    (id)       => get(`payments.php?id=${id}`),
    create: (data)     => post('payments.php',              data),
    delete: (id)       => del(`payments.php?id=${id}`),
  };

  // ── Uploads ───────────────────────────────────────────
  const uploads = {
    list:   (params)   => get('uploads.php',      params),
    upload: (formData) => post('uploads.php',      formData, true),
    delete: (id)       => del(`uploads.php?id=${id}`),
  };

  // ── Generic upload helper for FormData ───────────────
  const upload = (formData) => post('uploads.php', formData, true);

  return {
    setCsrf, getCsrf,
    request, get: get, post, put, del,
    auth, expenses, reports, settings, sync, dashboard,
    products, categories, suppliers, customers,
    purchaseInvoices, salesInvoices,
    purchaseReturns, salesReturns,
    stock, roles, team,
    ledger, activity, payments, uploads, upload,
  };
})();
