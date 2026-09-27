/**
 * BizBrain — router.js
 * History API (PushState) SPA Router.
 * No hash routing. No page reloads. Shopify-style instant navigation.
 *
 * Uses:
 *   history.pushState()
 *   history.replaceState()
 *   popstate event
 */

const Router = (() => {
  const _cache    = {};    // page HTML cache
  const _handlers = {};    // page init handlers
  const _routes   = [];    // route registry [{ pattern, name, params, handler }]

  let _currentRoute = null;
  let _currentParams = {};
  let _lastResolvedPath = null;

  function _getBasePath() {
    const base = document.querySelector('base')?.getAttribute('href') || '/';
    return new URL(base, window.location.origin).pathname.replace(/\/$/, '');
  }

  // ── Route map (page name → file/title) ─────────────────────
  const ROUTES = {
    dashboard:         { file: 'pages/dashboard.html?v=4',      title: 'Dashboard',       icon: 'fa-gauge-high' },
    expenses:          { file: 'pages/expenses.html',          title: 'Expenses',        icon: 'fa-receipt' },
    reports:           { file: 'pages/reports.html?v=5',        title: 'Reports',         icon: 'fa-chart-line' },
    settings:          { file: 'pages/settings.html',          title: 'Settings',        icon: 'fa-gear' },
    products:          { file: 'pages/products.html',          title: 'Products',        icon: 'fa-boxes-stacked' },
    categories:        { file: 'pages/categories.html',        title: 'Categories',      icon: 'fa-tags' },
    suppliers:         { file: 'pages/suppliers.html',          title: 'Suppliers',       icon: 'fa-truck' },
    customers:         { file: 'pages/customers.html',          title: 'Customers',       icon: 'fa-people-group' },
    purchase_invoices:        { file: 'pages/purchase_invoices.html?v=12', title: 'Purchases',       icon: 'fa-cart-shopping' },
    purchase_invoices_create: { file: 'pages/purchase_invoices.html?v=12', title: 'New Purchase Invoice', icon: 'fa-cart-plus' },
    sales_invoices:    { file: 'pages/sales_invoices.html',     title: 'Sales Invoices',  icon: 'fa-file-invoice' },
    purchase_returns:  { file: 'pages/purchase_returns.html',   title: 'Purchase Returns',icon: 'fa-arrow-left' },
    sales_returns:     { file: 'pages/sales_returns.html',      title: 'Sales Returns',   icon: 'fa-arrow-right' },
    accounts:          { file: 'pages/accounts.html',           title: 'Accounts',        icon: 'fa-chart-pie' },
    team:              { file: 'pages/team.html',               title: 'Team',            icon: 'fa-users-gear' },
  };

  // ── Route registry ─────────────────────────────────────────
  // Order matters: more specific routes first
  const ROUTE_PATTERNS = [
    // Detail routes (with entity ID)
    { pattern: /^\/products\/create$/,                    name: 'products_create' },
    { pattern: /^\/products\/([A-Za-z0-9\-_]+)\/edit$/,  name: 'products_edit',    params: ['id'] },
    { pattern: /^\/products\/([A-Za-z0-9\-_]+)$/,        name: 'products_detail',  params: ['id'] },
    { pattern: /^\/categories\/([A-Za-z0-9\-_]+)$/,      name: 'categories_detail',params: ['id'] },
    { pattern: /^\/customers\/([A-Za-z0-9\-_]+)\/edit$/,  name: 'customers_edit',   params: ['id'] },
    { pattern: /^\/customers\/([A-Za-z0-9\-_]+)$/,        name: 'customers_detail', params: ['id'] },
    { pattern: /^\/suppliers\/([A-Za-z0-9\-_]+)\/edit$/,  name: 'suppliers_edit',   params: ['id'] },
    { pattern: /^\/suppliers\/([A-Za-z0-9\-_]+)$/,        name: 'suppliers_detail', params: ['id'] },
    { pattern: /^\/purchase-invoices\/create$/,            name: 'purchase_invoices_create' },
    { pattern: /^\/purchase-invoices\/([A-Za-z0-9\-_]+)$/,name: 'purchase_invoices_detail', params: ['id'] },
    { pattern: /^\/sales-invoices\/([A-Za-z0-9\-_]+)$/,   name: 'sales_invoices_detail', params: ['id'] },

    // List routes
    { pattern: /^\/products$/,            name: 'products' },
    { pattern: /^\/categories$/,          name: 'categories' },
    { pattern: /^\/customers$/,           name: 'customers' },
    { pattern: /^\/suppliers$/,           name: 'suppliers' },
    { pattern: /^\/purchase-invoices$/,   name: 'purchase_invoices' },
    { pattern: /^\/sales-invoices$/,      name: 'sales_invoices' },
    { pattern: /^\/purchase-returns$/,    name: 'purchase_returns' },
    { pattern: /^\/sales-returns$/,       name: 'sales_returns' },
    { pattern: /^\/accounts$/,            name: 'accounts' },
    { pattern: /^\/expenses$/,            name: 'expenses' },
    { pattern: /^\/reports$/,             name: 'reports' },
    { pattern: /^\/settings$/,            name: 'settings' },
    { pattern: /^\/team$/,                name: 'team' },
    { pattern: /^\/dashboard$/,           name: 'dashboard' },

    // Error / status pages (direct URL access)
    { pattern: /^\/401$/,                 name: 'error_401' },
    { pattern: /^\/403$/,                 name: 'error_403' },
    { pattern: /^\/500$/,                 name: 'error_500' },
    { pattern: /^\/offline$/,             name: 'error_offline' },
    { pattern: /^\/maintenance$/,         name: 'error_maintenance' },
    { pattern: /^\/session-expired$/,     name: 'error_session_expired' },
    { pattern: /^\/no-data$/,             name: 'error_no_data' },

    // Root → dashboard
    { pattern: /^\/$/,                    name: 'dashboard' },
    { pattern: /^\/?$/,                   name: 'dashboard' },
  ];

  // ── Pre-register all route patterns ────────────────────────
  function _registerRoutes() {
    _routes.length = 0;
    for (const r of ROUTE_PATTERNS) {
      _routes.push({
        pattern: r.pattern,
        name: r.name,
        params: r.params || [],
        handler: _handlers[r.name] || null,
      });
    }
  }

  // ── Match URL path to a route ─────────────────────────────
  function _matchRoute(path) {
    // Clean the path: remove base URL prefix if present
    let cleanPath = path;
    // Remove the deployment directory prefix when the app is installed below root.
    const basePath = _getBasePath();
    if (basePath && (cleanPath === basePath || cleanPath.startsWith(basePath + '/'))) {
      cleanPath = cleanPath.slice(basePath.length) || '/';
    }
    // Ensure leading slash
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }

    for (const route of _routes) {
      const match = cleanPath.match(route.pattern);
      if (match) {
        const params = {};
        route.params.forEach((key, i) => {
          params[key] = match[i + 1];
        });
        return { name: route.name, params };
      }
    }
    return null;
  }

  // ── Register page handler ─────────────────────────────────
  function on(page, handler) {
    _handlers[page] = handler;
  }

  // ── Resolve route name to base page name ───────────────────
  function _resolveBasePage(routeName) {
    // Detail/edit routes map to their parent list page
    const map = {
      'products_create':           'products',
      'products_detail':           'products',
      'products_edit':             'products',
      'categories_detail':         'categories',
      'customers_detail':          'customers',
      'customers_edit':            'customers',
      'suppliers_detail':          'suppliers',
      'suppliers_edit':            'suppliers',
      'purchase_invoices_create':  'purchase_invoices',
      'purchase_invoices_detail':  'purchase_invoices',
      'sales_invoices_detail':     'sales_invoices',
    };
    return map[routeName] || routeName;
  }

  // ── Navigate ──────────────────────────────────────────────
  async function navigate(page, params = {}) {
    const route = ROUTES[page];
    if (!route) {
      // If it's a detail/create route, handle via URL
      if (page === 'products_create') {
        return navigateToUrl('/products/create');
      }
      if (page.endsWith('_detail') || page.endsWith('_edit') || page.endsWith('_create')) {
        const basePage = _resolveBasePage(page);
        if (ROUTES[basePage]) {
          return _loadPage(basePage, params, true);
        }
      }
      console.warn(`[Router] Unknown page: ${page}`);
      return;
    }

    await _loadPage(page, params, true);
  }

  // ── Navigate to a URL path ────────────────────────────────
  function navigateToUrl(url, replace = false) {
    // Ensure base path
    const fullUrl = _getBasePath() + (url.startsWith('/') ? url : '/' + url);

    if (replace) {
      history.replaceState(null, '', fullUrl);
    } else {
      history.pushState(null, '', fullUrl);
    }

    // Trigger route resolution
    return _handlePathChange();
  }

  // ── Load page content ──────────────────────────────────────
  async function _loadPage(page, params = {}, updateHistory = true) {
    const route = ROUTES[page];
    if (!route) {
      await _show404();
      return;
    }

    _currentRoute = page;
    _currentParams = params;

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(el => {
      const dataPage = el.dataset.page;
      el.classList.toggle('active', dataPage === page);
    });

    // Update breadcrumb
    const bc = document.getElementById('breadcrumb');
    if (bc) {
      if (params.id) {
        bc.textContent = `${route.title} · ${params.id}`;
      } else {
        bc.textContent = route.title;
      }
    }

    // Update document title
    document.title = `BizBrain — ${route.title}`;

    // Update URL if needed
    if (updateHistory) {
      _updateUrl(page, params);
    }

    // Show loader
    const content = document.getElementById('page-content');
    content.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';

    // Close module if open (silent — router is handling navigation)
    if (typeof closeModule === 'function') {
      closeModule(true);
    }

    // Load HTML (from cache or fetch)
    let html = _cache[page];
    if (!html) {
      try {
        const res = await fetch(route.file);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        html = await res.text();
        _cache[page] = html;
      } catch (err) {
        content.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <h3>Page not available offline</h3>
            <p>Connect to the internet to load this page for the first time.</p>
          </div>`;
        return;
      }
    }

    // Inject HTML
    content.innerHTML = html;

    // Re-trigger CSS animation
    content.style.animation = 'none';
    content.offsetHeight; // reflow
    content.style.animation = '';

    // Call page handler if registered
    if (_handlers[page]) {
      try {
        await _handlers[page](params);
      } catch (err) {
        console.error(`[Router] ${page} init error:`, err);
      }
    }

    // Handle detail pages: open module if needed
    _handleDetailRoute(page, params);

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('open');
    }
  }

  // ── Handle detail page routes (open Shopify-style sheet) ───
  function _handleDetailRoute(page, params) {
    if (!params.id) return;

    let moduleType = null;
    if (page === 'products_detail' || page === 'products_edit') moduleType = 'product';
    else if (page === 'customers_detail' || page === 'customers_edit') moduleType = 'customer';
    else if (page === 'suppliers_detail' || page === 'suppliers_edit') moduleType = 'supplier';
    else if (page === 'purchase_invoices_detail') moduleType = 'purchase_invoice';
    else if (page === 'sales_invoices_detail') moduleType = 'sales_invoice';
    else if (page === 'categories_detail') moduleType = 'category';

    if (moduleType && typeof openModule === 'function') {
      // Small delay to let the page render first
      setTimeout(() => {
        openModule(moduleType, params.id, true); // fromRoute=true — URL already set
      }, 100);
    }
  }

  // ── Update browser URL based on route ──────────────────────
  function _updateUrl(page, params) {
    const urlMap = {
      'dashboard':          '/dashboard',
      'expenses':           '/expenses',
      'reports':            '/reports',
      'settings':           '/settings',
      'products':           '/products',
      'products_create':    '/products/create',
      'products_detail':    `/products/${params.id || ''}`,
      'products_edit':      `/products/${params.id || ''}/edit`,
      'categories':         '/categories',
      'categories_detail':  `/categories/${params.id || ''}`,
      'customers':          '/customers',
      'customers_detail':   `/customers/${params.id || ''}`,
      'customers_edit':     `/customers/${params.id || ''}/edit`,
      'suppliers':          '/suppliers',
      'suppliers_detail':   `/suppliers/${params.id || ''}`,
      'suppliers_edit':     `/suppliers/${params.id || ''}/edit`,
      'purchase_invoices':           '/purchase-invoices',
      'purchase_invoices_create':    '/purchase-invoices/create',
      'purchase_invoices_detail':    `/purchase-invoices/${params.id || ''}`,
      'sales_invoices':              '/sales-invoices',
      'sales_invoices_detail':       `/sales-invoices/${params.id || ''}`,
      'purchase_returns':  '/purchase-returns',
      'sales_returns':     '/sales-returns',
      'accounts':          '/accounts',
      'team':              '/team',
    };

    const path = urlMap[page];
    if (!path) return;

    // Build full URL with base path
    const basePath = _getBasePath();
    const fullUrl = basePath + path;

    // Use replaceState to avoid stacking history entries on initial load
    history.replaceState({ page, params }, '', fullUrl);
  }

  // ── Handle path change (from navigation, popstate, etc.) ───
  async function _handlePathChange() {
    const path = window.location.pathname;
    if (_lastResolvedPath === path) {
      return { name: _currentRoute, params: _currentParams };
    }

    _lastResolvedPath = path;
    const matched = _matchRoute(path);

    if (!matched) {
      await _show404();
      return;
    }

    const { name, params } = matched;
    const basePage = _resolveBasePage(name);

    // Handle error/status page routes directly
    if (name.startsWith('error_')) {
      const errorType = name.replace('error_', '');
      await showError(errorType);
      return { name, params };
    }

    // Load the base page content
    await _loadPage(basePage, params, false);

    // Handle detail/create routes specially
    if (name.endsWith('_detail') || name.endsWith('_edit') || name.endsWith('_create')) {
      _currentRoute = name;
      _currentParams = params;

      if (_handlers[name]) {
        try {
          await _handlers[name](params);
        } catch (err) {
          console.error(`[Router] ${name} handler error:`, err);
        }
      }

      // Update breadcrumb for detail pages
      const bc = document.getElementById('breadcrumb');
      if (bc) {
        const route = ROUTES[name] || ROUTES[basePage];
        bc.textContent = route?.title || 'New Purchase Invoice';
      }
      if (name === 'purchase_invoices_create') document.title = 'BizBrain — New Purchase Invoice';

      // Open the detail module
      _handleDetailRoute(name, params);
    }

    return { name, params };
  }

  // ── Load error page from HTML file ─────────────────────────
  async function _loadErrorPage(type, title, file, entityId) {
    const content = document.getElementById('page-content');
    const bc = document.getElementById('breadcrumb');
    if (bc) bc.textContent = title;
    document.title = `BizBrain — ${title}`;

    // Close module if open (silent — router is handling navigation)
    if (typeof closeModule === 'function') {
      closeModule(true);
    }

    content.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';

    try {
      const res = await fetch('pages/errors/' + file);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let html = await res.text();
      // Inject dynamic path for 404
      if (type === '404') {
        html = html.replace('id="error-path">/unknown', `id="error-path">${esc(window.location.pathname)}`);
      }
      // Inject entity ID for entity-not-found pages
      if (entityId) {
        html = html.replace('id="error-entity-id">—', `id="error-entity-id">${esc(entityId)}`);
      }
      content.innerHTML = html;
    } catch (err) {
      // Fallback inline if file can't be loaded
      content.innerHTML = `
        <div class="page-container error-page">
          <div class="page-header">
            <div><h1>Error</h1><p class="page-subtitle">${title}</p></div>
          </div>
          <div class="empty-state" style="padding:60px 20px">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:64px;color:var(--txt-muted);opacity:0.3"></i>
            <h2 style="margin-top:16px">${title}</h2>
            <p style="color:var(--txt-secondary)">An error occurred while loading this page.</p>
            <div style="margin-top:24px">
              <button class="btn btn-primary" onclick="Router.navigate('dashboard')">Go to Dashboard</button>
            </div>
          </div>
        </div>`;
    }
  }

  // ── Show 404 page ──────────────────────────────────────────
  async function _show404() {
    await _loadErrorPage('404', 'Page Not Found', '404.html');
  }

  // ── Show entity not found page ────────────────────────────
  async function _showEntityNotFound(entityType, id) {
    const title = entityType + ' Not Found';
    const fileMap = {
      'Supplier': 'supplier-not-found.html',
      'Customer': 'customer-not-found.html',
      'Product':  'product-not-found.html',
      'Purchase Invoice': 'invoice-not-found.html',
      'Sales Invoice':    'invoice-not-found.html',
    };
    const file = fileMap[entityType] || '404.html';
    await _loadErrorPage('entity', title, file);
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    // Register all route patterns
    _registerRoutes();

    // Handle sidebar nav clicks — use href attribute directly to support hyphens in URLs
    document.querySelectorAll('a.nav-item[href]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const href = el.getAttribute('href');
        if (href) {
          navigateToUrl(href);
        }
      });
    });

    // Handle browser back/forward and bfcache restores without reload
    window.addEventListener('popstate', () => {
      _handlePathChange();
    });

    window.addEventListener('pageshow', (event) => {
      if (event.persisted || performance.getEntriesByType('navigation')[0]?.type === 'back_forward') {
        _handlePathChange();
      }
    });

    // Handle hash-based links (fallback) — convert to pushState
    document.addEventListener('click', (e) => {
      const anchor = e.target.closest('a[href^="#"]');
      if (anchor) {
        e.preventDefault();
        const hash = anchor.getAttribute('href').slice(1); // remove #
        if (hash && ROUTES[hash]) {
          navigateToUrl('/' + hash);
        }
      }
    });

    // Handle data-nav clicks (for inline Router.navigate calls)
    document.addEventListener('click', (e) => {
      const navBtn = e.target.closest('[data-nav]');
      if (navBtn) {
        e.preventDefault();
        const page = navBtn.dataset.nav;
        if (page && ROUTES[page]) {
          navigateToUrl('/' + page);
        }
      }
    });

    // Initial route: read current path
    _handlePathChange();
  }

  // ── Prefetch all pages ────────────────────────────────────
  async function prefetch() {
    const pages = Object.keys(ROUTES);
    for (const page of pages) {
      if (!_cache[page]) {
        try {
          const res = await fetch(ROUTES[page].file);
          if (res.ok) _cache[page] = await res.text();
        } catch (_) {}
      }
    }
  }

  function getCurrent() { return _currentRoute; }
  function getParams() { return _currentParams; }

  // ── Public error display methods ────────────────────────────
  async function showError(type) {
    const map = {
      '401':    ['Authentication Required', '401.html'],
      '403':    ['Access Denied', '403.html'],
      '404':    ['Page Not Found', '404.html'],
      '500':    ['Something Went Wrong', '500.html'],
      'offline': ['You Are Offline', 'offline.html'],
      'maintenance': ['System Under Maintenance', 'maintenance.html'],
      'session-expired': ['Session Expired', 'session-expired.html'],
    };
    const [title, file] = map[type] || ['Error', '404.html'];
    await _loadErrorPage(type, title, file);
  }

  async function showEntityNotFound(entityType, id) {
    await _showEntityNotFound(entityType, id);
  }

  return { init, on, navigate, navigateToUrl, prefetch, getCurrent, getParams, showError, showEntityNotFound };
})();
