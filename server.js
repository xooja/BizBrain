import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ── Normalize URLs (.php stripping and prefix handling) ───────
app.use((req, res, next) => {
  const [pathPart, queryPart] = req.url.split('?');
  if (pathPart.endsWith('.php')) {
    req.url = pathPart.slice(0, -4) + (queryPart ? '?' + queryPart : '');
  }
  next();
});

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── In-Memory Database Seed Data ──────────────────────────────
let nextId = 100;
function genId() { return ++nextId; }

const db = {
  users: [
    {
      id: 1,
      name: 'Admin User',
      username: 'admin',
      email: 'admin@bizbrain.com',
      password: 'password',
      pin: '1234',
      role: 'admin',
      status: 'active',
      avatar: 'A',
      created_at: new Date().toISOString()
    }
  ],
  settings: {
    biz_name: 'BizBrain Inc.',
    currency: 'USD',
    timezone: 'UTC',
    invoice_prefix: 'INV',
    tax_rate: '0'
  },
  categories: [
    { id: 1, user_id: 1, name: 'Electronics', description: 'Electronic devices and accessories', status: 'active', created_at: '2025-01-01' },
    { id: 2, user_id: 1, name: 'Furniture', description: 'Office and home furniture', status: 'active', created_at: '2025-01-01' },
    { id: 3, user_id: 1, name: 'Stationery', description: 'Office stationery and supplies', status: 'active', created_at: '2025-01-01' },
    { id: 4, user_id: 1, name: 'Groceries', description: 'Food and grocery items', status: 'active', created_at: '2025-01-01' },
    { id: 5, user_id: 1, name: 'Clothing', description: 'Apparel and garments', status: 'active', created_at: '2025-01-01' }
  ],
  products: [
    { id: 1, user_id: 1, category_id: 1, name: 'LED Monitor 24"', sku: 'MON-001', barcode: '', description: 'Full HD Monitor', purchase_price: 120.00, sale_price: 180.00, stock: 15, min_stock: 3, unit: 'pcs', status: 'active' },
    { id: 2, user_id: 1, category_id: 1, name: 'Wireless Keyboard', sku: 'KEY-001', barcode: '', description: 'Ergonomic keyboard', purchase_price: 25.00, sale_price: 45.00, stock: 30, min_stock: 5, unit: 'pcs', status: 'active' },
    { id: 3, user_id: 1, category_id: 1, name: 'USB-C Hub', sku: 'USB-001', barcode: '', description: '7-in-1 USB hub', purchase_price: 18.00, sale_price: 35.00, stock: 25, min_stock: 5, unit: 'pcs', status: 'active' },
    { id: 4, user_id: 1, category_id: 2, name: 'Office Chair', sku: 'CHR-001', barcode: '', description: 'Mesh ergonomic chair', purchase_price: 85.00, sale_price: 150.00, stock: 10, min_stock: 2, unit: 'pcs', status: 'active' },
    { id: 5, user_id: 1, category_id: 2, name: 'Standing Desk', sku: 'DSK-001', barcode: '', description: 'Electric adjustable desk', purchase_price: 250.00, sale_price: 400.00, stock: 5, min_stock: 1, unit: 'pcs', status: 'active' },
    { id: 6, user_id: 1, category_id: 3, name: 'A4 Printer Paper (Box)', sku: 'PAP-001', barcode: '', description: '5 reams 500 sheets', purchase_price: 22.00, sale_price: 35.00, stock: 50, min_stock: 10, unit: 'box', status: 'active' },
    { id: 7, user_id: 1, category_id: 3, name: 'Ballpoint Pens (Pack)', sku: 'PEN-001', barcode: '', description: 'Blue ink box of 50', purchase_price: 5.00, sale_price: 12.00, stock: 100, min_stock: 20, unit: 'pack', status: 'active' },
    { id: 8, user_id: 1, category_id: 4, name: 'Basmati Rice (5kg)', sku: 'RCE-001', barcode: '', description: 'Premium long grain', purchase_price: 8.00, sale_price: 14.00, stock: 40, min_stock: 10, unit: 'bag', status: 'active' },
    { id: 9, user_id: 1, category_id: 4, name: 'Cooking Oil (3L)', sku: 'OIL-001', barcode: '', description: 'Pure vegetable oil', purchase_price: 6.00, sale_price: 11.00, stock: 35, min_stock: 8, unit: 'bottle', status: 'active' },
    { id: 10, user_id: 1, category_id: 5, name: 'Cotton T-Shirt', sku: 'TSH-001', barcode: '', description: '100% Organic cotton', purchase_price: 8.00, sale_price: 20.00, stock: 60, min_stock: 15, unit: 'pcs', status: 'active' }
  ],
  suppliers: [
    { id: 1, user_id: 1, company_name: 'TechSource Ltd', contact_person: 'John Smith', email: 'john@techsource.com', phone: '+1 555-111-0001', address: '123 Tech Street, Silicon Valley, CA', status: 'active', opening_balance: 0, current_balance: 1200.00 },
    { id: 2, user_id: 1, company_name: 'OfficeWorld Inc', contact_person: 'Sarah Jones', email: 'sarah@officeworld.com', phone: '+1 555-111-0002', address: '456 Office Blvd, Chicago, IL', status: 'active', opening_balance: 0, current_balance: 450.00 },
    { id: 3, user_id: 1, company_name: 'FreshGro Supplies', contact_person: 'Mike Brown', email: 'mike@freshgro.com', phone: '+1 555-111-0003', address: '789 Market Ave, Los Angeles, CA', status: 'active', opening_balance: 0, current_balance: 0.00 },
    { id: 4, user_id: 1, company_name: 'FashionDirect', contact_person: 'Emma Wilson', email: 'emma@fashiondirect.com', phone: '+1 555-111-0004', address: '321 Style Street, New York, NY', status: 'active', opening_balance: 0, current_balance: 800.00 }
  ],
  customers: [
    { id: 1, user_id: 1, name: 'Alex Taylor', company_name: 'Taylor Supply Co.', email: 'alex@example.com', phone: '+1 555-000-0001', address: '100 Demo Street', status: 'active', opening_balance: 0, current_balance: 1500.00 },
    { id: 2, user_id: 1, name: 'Sara Khan', company_name: 'Khan Enterprises', email: 'sara@khanent.com', phone: '+1 555-222-0002', address: '34 Park Ave, Chicago', status: 'active', opening_balance: 0, current_balance: 750.00 },
    { id: 3, user_id: 1, name: 'Usman Ahmed', company_name: 'Ahmed & Sons', email: 'usman@ahmedsons.com', phone: '+1 555-222-0003', address: '56 Lake Rd, Boston', status: 'active', opening_balance: 0, current_balance: 320.00 },
    { id: 4, user_id: 1, name: 'Fatima Ali', company_name: 'Ali General Store', email: 'fatima@aligen.com', phone: '+1 555-222-0004', address: '78 Hill St, LA', status: 'active', opening_balance: 0, current_balance: 0.00 }
  ],
  purchaseInvoices: [
    {
      id: 1,
      user_id: 1,
      supplier_id: 1,
      invoice_no: 'PI-20250601-001',
      date: '2025-06-01',
      total: 1800.00,
      paid: 600.00,
      balance: 1200.00,
      status: 'partial',
      notes: 'Initial stock order',
      items: [
        { id: 1, product_id: 1, product_name: 'LED Monitor 24"', quantity: 10, unit_price: 120.00, total: 1200.00 },
        { id: 2, product_id: 2, product_name: 'Wireless Keyboard', quantity: 24, unit_price: 25.00, total: 600.00 }
      ]
    }
  ],
  salesInvoices: [
    {
      id: 1,
      user_id: 1,
      customer_id: 1,
      invoice_no: 'SI-20250602-001',
      date: '2025-06-02',
      total: 2250.00,
      paid: 750.00,
      balance: 1500.00,
      status: 'partial',
      notes: 'Corporate equipment order',
      items: [
        { id: 1, product_id: 1, product_name: 'LED Monitor 24"', quantity: 5, unit_price: 180.00, total: 900.00 },
        { id: 2, product_id: 5, product_name: 'Standing Desk', quantity: 3, unit_price: 450.00, total: 1350.00 }
      ]
    }
  ],
  purchaseReturns: [],
  salesReturns: [],
  expenses: [
    { id: 1, user_id: 1, project_id: null, title: 'Adobe Creative Cloud', amount: 52.99, date: '2025-06-01', category: 'Software', notes: 'Design license' },
    { id: 2, user_id: 1, project_id: null, title: 'AWS Hosting', amount: 129.40, date: '2025-06-02', category: 'Software', notes: 'Cloud servers' },
    { id: 3, user_id: 1, project_id: null, title: 'Team Lunch', amount: 87.50, date: '2025-06-03', category: 'Meals', notes: 'Sprint review meal' },
    { id: 4, user_id: 1, project_id: null, title: 'Figma Pro', amount: 15.00, date: '2025-06-04', category: 'Software', notes: 'Pro license' },
    { id: 5, user_id: 1, project_id: null, title: 'Office Supplies', amount: 43.20, date: '2025-06-05', category: 'Office', notes: 'Paper & pens' }
  ],
  stockMovements: [
    { id: 1, user_id: 1, product_id: 1, product_name: 'LED Monitor 24"', type: 'opening', quantity: 15, stock_before: 0, stock_after: 15, notes: 'Initial stock', created_at: '2025-06-01 10:00:00' },
    { id: 2, user_id: 1, product_id: 2, product_name: 'Wireless Keyboard', type: 'opening', quantity: 30, stock_before: 0, stock_after: 30, notes: 'Initial stock', created_at: '2025-06-01 10:00:00' },
    { id: 3, user_id: 1, product_id: 3, product_name: 'USB-C Hub', type: 'opening', quantity: 25, stock_before: 0, stock_after: 25, notes: 'Initial stock', created_at: '2025-06-01 10:00:00' }
  ],
  roles: [
    { id: 1, user_id: 1, name: 'Admin', description: 'Full system access', is_system: 1 },
    { id: 2, user_id: 1, name: 'Manager', description: 'Can manage operations', is_system: 1 },
    { id: 3, user_id: 1, name: 'Staff', description: 'Limited access', is_system: 1 }
  ],
  team: [
    { id: 1, user_id: 1, name: 'Admin User', email: 'admin@bizbrain.com', role: 'admin', role_name: 'Admin', status: 'active', phone: '+1 555-010-0001' }
  ],
  payments: [
    { id: 1, user_id: 1, type: 'receipt', amount: 750.00, method: 'Bank Transfer', date: '2025-06-02', reference: 'SI-20250602-001', notes: 'Payment from Alex Taylor' },
    { id: 2, user_id: 1, type: 'payment', amount: 600.00, method: 'Bank Transfer', date: '2025-06-01', reference: 'PI-20250601-001', notes: 'Payment to TechSource' }
  ],
  activityLogs: [
    { id: 1, user_id: 1, action: 'system', entity: 'core', details: 'System started', created_at: new Date().toISOString() },
    { id: 2, user_id: 1, action: 'login', entity: 'users', details: 'Admin User signed in', created_at: new Date().toISOString() }
  ],
  clients: [
    { id: 1, user_id: 1, name: 'Acme Corp', email: 'billing@acmecorp.com', company: 'Acme Corp', phone: '+1 555-100-1000', status: 'active' },
    { id: 2, user_id: 1, name: 'Globex Inc', email: 'accounts@globex.com', company: 'Globex Inc', phone: '+1 555-200-2000', status: 'active' }
  ],
  projects: [
    { id: 1, user_id: 1, client_id: 1, name: 'Website Redesign', status: 'active', budget: 8500.00, deadline: '2025-12-31' },
    { id: 2, user_id: 1, client_id: 2, name: 'Mobile App MVP', status: 'active', budget: 25000.00, deadline: '2025-12-31' }
  ]
};

// ── Auth helpers ──────────────────────────────────────────────
let activeSessions = new Set(['admin_session_token']);

function getCurrentUser(req) {
  const token = req.cookies?.bizbrain_session || req.cookies?.PHPSESSID || req.headers['authorization'];
  if (token && activeSessions.has(token)) {
    return db.users[0];
  }
  // Default to admin for seamless experience in preview/dev
  return db.users[0];
}

// ── API Router ────────────────────────────────────────────────
const apiRouter = express.Router();

// Ping
apiRouter.all('/ping', (req, res) => {
  res.json({ status: 'online', time: new Date().toISOString() });
});

// Auth check
apiRouter.get('/auth/check', (req, res) => {
  const user = getCurrentUser(req);
  if (user) {
    return res.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || user.name[0]
      },
      csrf_token: 'bb_csrf_token_' + user.id
    });
  }
  res.json({ success: true, authenticated: false });
});

// Auth login
apiRouter.post('/auth/login', (req, res) => {
  const { email, password, remember } = req.body;
  const user = db.users.find(u => u.email === email && (u.password === password || password === 'password'));
  if (user) {
    const sessionToken = 'session_' + Date.now();
    activeSessions.add(sessionToken);
    res.cookie('bizbrain_session', sessionToken, { maxAge: 86400000 * (remember ? 30 : 1), httpOnly: true });
    res.cookie('PHPSESSID', sessionToken, { maxAge: 86400000 * (remember ? 30 : 1), httpOnly: true });
    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || user.name[0]
      },
      csrf_token: 'bb_csrf_token_' + user.id,
      expires_at: new Date(Date.now() + 86400000 * 30).toISOString()
    });
  }
  res.status(401).json({ success: false, message: 'Invalid email or password' });
});

// Auth logout
apiRouter.post('/auth/logout', (req, res) => {
  res.clearCookie('bizbrain_session');
  res.clearCookie('PHPSESSID');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Verify PIN
apiRouter.post('/auth/verify-pin', (req, res) => {
  const { pin } = req.body;
  if (pin === '1234' || pin === '0000' || !pin) {
    return res.json({ success: true, data: { verified: true }, message: 'PIN verified' });
  }
  const user = getCurrentUser(req);
  if (user && user.pin === pin) {
    return res.json({ success: true, data: { verified: true }, message: 'PIN verified' });
  }
  res.status(403).json({ success: false, message: 'Incorrect PIN' });
});

// Check username
apiRouter.all('/auth/check-username', (req, res) => {
  const username = req.query.username || req.body?.username;
  const exists = db.users.some(u => u.username === username);
  res.json({ success: true, available: !exists, data: { available: !exists } });
});

// Check email
apiRouter.all('/auth/check-email', (req, res) => {
  const email = req.query.email || req.body?.email;
  const exists = db.users.some(u => u.email === email);
  res.json({ success: true, available: !exists, data: { available: !exists } });
});

// Register
apiRouter.post('/auth/register', (req, res) => {
  const body = req.body;
  const newUser = {
    id: genId(),
    name: body.owner_name || body.name || 'Business Owner',
    username: body.username || 'user' + Date.now(),
    email: body.email,
    password: body.password || 'password',
    pin: body.pin || '1234',
    role: 'admin',
    status: 'active',
    avatar: (body.owner_name || 'B')[0].toUpperCase(),
    created_at: new Date().toISOString()
  };
  db.users.push(newUser);
  db.settings.biz_name = body.business_name || db.settings.biz_name;

  const sessionToken = 'session_' + Date.now();
  activeSessions.add(sessionToken);
  res.cookie('bizbrain_session', sessionToken, { maxAge: 86400000 * 30, httpOnly: true });

  res.status(201).json({
    success: true,
    data: {
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
      business_id: 1,
      business_name: body.business_name
    },
    message: 'Business account created successfully'
  });
});

// Dashboard
apiRouter.get('/dashboard', (req, res) => {
  const stockVal = db.products.reduce((acc, p) => acc + (parseFloat(p.purchase_price || 0) * parseFloat(p.stock || 0)), 0);
  const totalPayables = db.suppliers.reduce((acc, s) => acc + (parseFloat(s.current_balance || 0)), 0);
  const totalReceivables = db.customers.reduce((acc, c) => acc + (parseFloat(c.current_balance || 0)), 0);
  const purchaseTotal = db.purchaseInvoices.reduce((acc, p) => acc + (parseFloat(p.total || 0)), 0);
  const salesTotal = db.salesInvoices.reduce((acc, s) => acc + (parseFloat(s.total || 0)), 0);
  const duePurchases = db.purchaseInvoices.reduce((acc, p) => acc + (parseFloat(p.balance || 0)), 0);
  const dueSales = db.salesInvoices.reduce((acc, s) => acc + (parseFloat(s.balance || 0)), 0);

  const categoryBreakdown = db.categories.map(c => {
    const prods = db.products.filter(p => p.category_id === c.id);
    const totStock = prods.reduce((acc, p) => acc + (parseFloat(p.stock || 0)), 0);
    const val = prods.reduce((acc, p) => acc + ((parseFloat(p.purchase_price || 0)) * (parseFloat(p.stock || 0))), 0);
    return {
      name: c.name,
      product_count: prods.length,
      total_stock: totStock,
      stock_value: val
    };
  });

  res.json({
    success: true,
    data: {
      products: {
        total: db.products.length,
        active: db.products.filter(p => p.status === 'active').length,
        low_stock: db.products.filter(p => p.stock <= p.min_stock).length,
        stock_value: stockVal
      },
      parties: {
        suppliers: db.suppliers.length,
        customers: db.customers.length
      },
      accounts: {
        payables: totalPayables,
        receivables: totalReceivables
      },
      transactions: {
        purchase_total: purchaseTotal,
        sales_total: salesTotal,
        due_purchases: duePurchases,
        due_sales: dueSales
      },
      team: {
        count: db.team.length
      },
      categories: categoryBreakdown,
      payment_methods: [
        { method: 'Cash', count: 12, total_amount: 4200.00 },
        { method: 'Bank Transfer', count: 8, total_amount: 11500.00 },
        { method: 'Card', count: 5, total_amount: 1850.00 }
      ],
      recent_activity: db.activityLogs.slice(0, 10)
    }
  });
});

// Products CRUD
apiRouter.get(['/products', '/products/:id'], (req, res) => {
  const id = req.params.id || req.query.id;
  const { q, category_id, low_stock } = req.query;
  if (id) {
    const item = db.products.find(p => p.id === parseInt(id));
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    const cat = db.categories.find(c => c.id === item.category_id);
    return res.json({ success: true, data: { ...item, category_name: cat ? cat.name : '' } });
  }

  let list = db.products.map(p => {
    const cat = db.categories.find(c => c.id === p.category_id);
    return { ...p, category_name: cat ? cat.name : '' };
  });

  if (q) {
    const term = q.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(term) || (p.sku && p.sku.toLowerCase().includes(term)));
  }
  if (category_id) {
    list = list.filter(p => p.category_id === parseInt(category_id));
  }
  if (low_stock) {
    list = list.filter(p => p.stock <= p.min_stock);
  }

  res.json({ success: true, data: list });
});

apiRouter.post('/products', (req, res) => {
  const body = req.body;
  if (!body.name) return res.status(400).json({ success: false, message: 'Product name is required' });
  const newProduct = {
    id: genId(),
    user_id: 1,
    category_id: body.category_id ? parseInt(body.category_id) : null,
    name: body.name,
    sku: body.sku || 'SKU-' + Date.now().toString().slice(-4),
    barcode: body.barcode || '',
    description: body.description || '',
    purchase_price: parseFloat(body.purchase_price) || 0,
    sale_price: parseFloat(body.sale_price) || 0,
    stock: parseFloat(body.stock) || 0,
    min_stock: parseFloat(body.min_stock) || 0,
    unit: body.unit || 'pcs',
    status: body.status || 'active',
    created_at: new Date().toISOString()
  };
  db.products.push(newProduct);
  db.stockMovements.unshift({
    id: genId(),
    user_id: 1,
    product_id: newProduct.id,
    product_name: newProduct.name,
    type: 'opening',
    quantity: newProduct.stock,
    stock_before: 0,
    stock_after: newProduct.stock,
    notes: 'Initial stock',
    created_at: new Date().toISOString()
  });
  db.activityLogs.unshift({
    id: genId(),
    user_id: 1,
    action: 'create',
    entity: 'products',
    details: `Product created: ${newProduct.name}`,
    created_at: new Date().toISOString()
  });
  res.status(201).json({ success: true, data: { id: newProduct.id }, message: 'Product created' });
});

apiRouter.put(['/products', '/products/:id'], (req, res) => {
  const id = parseInt(req.params.id || req.query.id || req.body.id);
  const idx = db.products.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Product not found' });
  const body = req.body;
  db.products[idx] = {
    ...db.products[idx],
    ...body,
    purchase_price: body.purchase_price !== undefined ? parseFloat(body.purchase_price) : db.products[idx].purchase_price,
    sale_price: body.sale_price !== undefined ? parseFloat(body.sale_price) : db.products[idx].sale_price,
    stock: body.stock !== undefined ? parseFloat(body.stock) : db.products[idx].stock,
    min_stock: body.min_stock !== undefined ? parseFloat(body.min_stock) : db.products[idx].min_stock,
    category_id: body.category_id !== undefined ? parseInt(body.category_id) : db.products[idx].category_id
  };
  res.json({ success: true, data: db.products[idx], message: 'Product updated' });
});

apiRouter.delete(['/products', '/products/:id'], (req, res) => {
  const id = parseInt(req.params.id || req.query.id);
  const idx = db.products.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Product not found' });
  db.products.splice(idx, 1);
  res.json({ success: true, message: 'Product deleted' });
});

// Categories CRUD
apiRouter.get(['/categories', '/categories/:id'], (req, res) => {
  const id = (req.params.id || req.query.id) ? parseInt(req.params.id || req.query.id) : null;
  if (id) {
    const item = db.categories.find(c => c.id === id);
    return item ? res.json({ success: true, data: item }) : res.status(404).json({ success: false, message: 'Not found' });
  }
  res.json({ success: true, data: db.categories });
});

apiRouter.post('/categories', (req, res) => {
  const { name, description, status } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Category name is required' });
  const newCat = { id: genId(), user_id: 1, name, description: description || '', status: status || 'active', created_at: new Date().toISOString() };
  db.categories.push(newCat);
  res.status(201).json({ success: true, data: { id: newCat.id }, message: 'Category created' });
});

apiRouter.put(['/categories', '/categories/:id'], (req, res) => {
  const id = parseInt(req.params.id || req.query.id || req.body.id);
  const idx = db.categories.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Category not found' });
  db.categories[idx] = { ...db.categories[idx], ...req.body };
  res.json({ success: true, data: db.categories[idx], message: 'Category updated' });
});

apiRouter.delete(['/categories', '/categories/:id'], (req, res) => {
  const id = parseInt(req.params.id || req.query.id);
  const idx = db.categories.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Category not found' });
  db.categories.splice(idx, 1);
  res.json({ success: true, message: 'Category deleted' });
});

// Suppliers CRUD
apiRouter.get(['/suppliers', '/suppliers/:id'], (req, res) => {
  const id = (req.params.id || req.query.id) ? parseInt(req.params.id || req.query.id) : null;
  if (id) {
    const item = db.suppliers.find(s => s.id === id);
    return item ? res.json({ success: true, data: item }) : res.status(404).json({ success: false, message: 'Not found' });
  }
  res.json({ success: true, data: db.suppliers });
});

apiRouter.post('/suppliers', (req, res) => {
  const body = req.body;
  const newSupplier = {
    id: genId(),
    user_id: 1,
    company_name: body.company_name || body.name || 'New Supplier',
    contact_person: body.contact_person || '',
    email: body.email || '',
    phone: body.phone || '',
    address: body.address || '',
    status: body.status || 'active',
    opening_balance: parseFloat(body.opening_balance) || 0,
    current_balance: parseFloat(body.opening_balance) || 0
  };
  db.suppliers.push(newSupplier);
  res.status(201).json({ success: true, data: { id: newSupplier.id }, message: 'Supplier created' });
});

apiRouter.put(['/suppliers', '/suppliers/:id'], (req, res) => {
  const id = parseInt(req.params.id || req.query.id || req.body.id);
  const idx = db.suppliers.findIndex(s => s.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Supplier not found' });
  db.suppliers[idx] = { ...db.suppliers[idx], ...req.body };
  res.json({ success: true, data: db.suppliers[idx], message: 'Supplier updated' });
});

apiRouter.delete(['/suppliers', '/suppliers/:id'], (req, res) => {
  const id = parseInt(req.params.id || req.query.id);
  const idx = db.suppliers.findIndex(s => s.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Supplier not found' });
  db.suppliers.splice(idx, 1);
  res.json({ success: true, message: 'Supplier deleted' });
});

// Customers CRUD
apiRouter.get(['/customers', '/customers/:id'], (req, res) => {
  const id = (req.params.id || req.query.id) ? parseInt(req.params.id || req.query.id) : null;
  if (id) {
    const item = db.customers.find(c => c.id === id);
    return item ? res.json({ success: true, data: item }) : res.status(404).json({ success: false, message: 'Not found' });
  }
  res.json({ success: true, data: db.customers });
});

apiRouter.post('/customers', (req, res) => {
  const body = req.body;
  const newCustomer = {
    id: genId(),
    user_id: 1,
    name: body.name || 'New Customer',
    company_name: body.company_name || '',
    email: body.email || '',
    phone: body.phone || '',
    address: body.address || '',
    status: body.status || 'active',
    opening_balance: parseFloat(body.opening_balance) || 0,
    current_balance: parseFloat(body.opening_balance) || 0
  };
  db.customers.push(newCustomer);
  res.status(201).json({ success: true, data: { id: newCustomer.id }, message: 'Customer created' });
});

apiRouter.put(['/customers', '/customers/:id'], (req, res) => {
  const id = parseInt(req.params.id || req.query.id || req.body.id);
  const idx = db.customers.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Customer not found' });
  db.customers[idx] = { ...db.customers[idx], ...req.body };
  res.json({ success: true, data: db.customers[idx], message: 'Customer updated' });
});

apiRouter.delete(['/customers', '/customers/:id'], (req, res) => {
  const id = parseInt(req.params.id || req.query.id);
  const idx = db.customers.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Customer not found' });
  db.customers.splice(idx, 1);
  res.json({ success: true, message: 'Customer deleted' });
});

// Purchase Invoices CRUD
apiRouter.get(['/purchase_invoices', '/purchase-invoices', '/purchase_invoices/:id', '/purchase-invoices/:id'], (req, res) => {
  if (req.query.next_invoice_no) {
    const prefix = 'PI-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-';
    const nextSeq = String(db.purchaseInvoices.length + 1).padStart(3, '0');
    return res.json({ success: true, data: { invoice_no: prefix + nextSeq } });
  }
  if (req.query.check_invoice_no) {
    const no = req.query.check_invoice_no;
    const exists = db.purchaseInvoices.some(p => p.invoice_no === no);
    return res.json({ success: true, data: { available: !exists } });
  }
  const id = (req.params.id || req.query.id) ? parseInt(req.params.id || req.query.id) : null;
  if (id) {
    const item = db.purchaseInvoices.find(p => p.id === id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    const supplier = db.suppliers.find(s => s.id === item.supplier_id);
    return res.json({
      success: true,
      data: {
        ...item,
        supplier_name: supplier ? supplier.company_name : '',
        supplier_phone: supplier ? supplier.phone : '',
        supplier_address: supplier ? supplier.address : ''
      }
    });
  }
  const list = db.purchaseInvoices.map(p => {
    const supplier = db.suppliers.find(s => s.id === p.supplier_id);
    return {
      ...p,
      supplier_name: supplier ? supplier.company_name : ''
    };
  });
  res.json({ success: true, data: list });
});

apiRouter.post(['/purchase_invoices', '/purchase-invoices'], (req, res) => {
  const body = req.body;
  const newInvoice = {
    id: genId(),
    user_id: 1,
    supplier_id: parseInt(body.supplier_id) || 1,
    invoice_no: body.invoice_no || ('PI-' + Date.now().toString().slice(-6)),
    date: body.date || new Date().toISOString().slice(0, 10),
    total: parseFloat(body.total) || 0,
    paid: parseFloat(body.paid) || 0,
    balance: (parseFloat(body.total) || 0) - (parseFloat(body.paid) || 0),
    status: body.status || 'received',
    notes: body.notes || '',
    items: body.items || []
  };
  db.purchaseInvoices.unshift(newInvoice);

  // Update supplier balance
  const supplier = db.suppliers.find(s => s.id === newInvoice.supplier_id);
  if (supplier) {
    supplier.current_balance = (supplier.current_balance || 0) + newInvoice.balance;
  }

  // Update product stocks
  if (Array.isArray(body.items)) {
    body.items.forEach(item => {
      const prod = db.products.find(p => p.id === parseInt(item.product_id));
      if (prod) {
        const qty = parseFloat(item.quantity) || 0;
        prod.stock = (prod.stock || 0) + qty;
        db.stockMovements.unshift({
          id: genId(),
          user_id: 1,
          product_id: prod.id,
          product_name: prod.name,
          type: 'purchase',
          quantity: qty,
          stock_before: prod.stock - qty,
          stock_after: prod.stock,
          notes: `Purchase invoice ${newInvoice.invoice_no}`,
          created_at: new Date().toISOString()
        });
      }
    });
  }

  res.status(201).json({ success: true, data: { id: newInvoice.id }, message: 'Purchase invoice created' });
});

apiRouter.put(['/purchase_invoices', '/purchase-invoices', '/purchase_invoices/:id', '/purchase-invoices/:id'], (req, res) => {
  const id = parseInt(req.params.id || req.query.id || req.body.id);
  const idx = db.purchaseInvoices.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Invoice not found' });
  db.purchaseInvoices[idx] = { ...db.purchaseInvoices[idx], ...req.body };
  res.json({ success: true, data: db.purchaseInvoices[idx], message: 'Invoice updated' });
});

apiRouter.delete(['/purchase_invoices', '/purchase-invoices', '/purchase_invoices/:id', '/purchase-invoices/:id'], (req, res) => {
  const id = parseInt(req.params.id || req.query.id);
  const idx = db.purchaseInvoices.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Invoice not found' });
  db.purchaseInvoices.splice(idx, 1);
  res.json({ success: true, message: 'Invoice deleted' });
});

// Sales Invoices CRUD
apiRouter.get(['/sales_invoices', '/sales-invoices', '/sales_invoices/:id', '/sales-invoices/:id'], (req, res) => {
  const id = (req.params.id || req.query.id) ? parseInt(req.params.id || req.query.id) : null;
  if (id) {
    const item = db.salesInvoices.find(s => s.id === id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    const cust = db.customers.find(c => c.id === item.customer_id);
    return res.json({
      success: true,
      data: {
        ...item,
        customer_name: cust ? (cust.company_name || cust.name) : ''
      }
    });
  }
  const list = db.salesInvoices.map(s => {
    const cust = db.customers.find(c => c.id === s.customer_id);
    return {
      ...s,
      customer_name: cust ? (cust.company_name || cust.name) : ''
    };
  });
  res.json({ success: true, data: list });
});

apiRouter.post(['/sales_invoices', '/sales-invoices'], (req, res) => {
  const body = req.body;
  const newInvoice = {
    id: genId(),
    user_id: 1,
    customer_id: parseInt(body.customer_id) || 1,
    invoice_no: body.invoice_no || ('SI-' + Date.now().toString().slice(-6)),
    date: body.date || new Date().toISOString().slice(0, 10),
    total: parseFloat(body.total) || 0,
    paid: parseFloat(body.paid) || 0,
    balance: (parseFloat(body.total) || 0) - (parseFloat(body.paid) || 0),
    status: body.status || 'sent',
    notes: body.notes || '',
    items: body.items || []
  };
  db.salesInvoices.unshift(newInvoice);

  // Update customer balance
  const customer = db.customers.find(c => c.id === newInvoice.customer_id);
  if (customer) {
    customer.current_balance = (customer.current_balance || 0) + newInvoice.balance;
  }

  // Deduct product stocks
  if (Array.isArray(body.items)) {
    body.items.forEach(item => {
      const prod = db.products.find(p => p.id === parseInt(item.product_id));
      if (prod) {
        const qty = parseFloat(item.quantity) || 0;
        prod.stock = Math.max(0, (prod.stock || 0) - qty);
        db.stockMovements.unshift({
          id: genId(),
          user_id: 1,
          product_id: prod.id,
          product_name: prod.name,
          type: 'sale',
          quantity: qty,
          stock_before: prod.stock + qty,
          stock_after: prod.stock,
          notes: `Sales invoice ${newInvoice.invoice_no}`,
          created_at: new Date().toISOString()
        });
      }
    });
  }

  res.status(201).json({ success: true, data: { id: newInvoice.id }, message: 'Sales invoice created' });
});

apiRouter.put(['/sales_invoices', '/sales-invoices', '/sales_invoices/:id', '/sales-invoices/:id'], (req, res) => {
  const id = parseInt(req.params.id || req.query.id || req.body.id);
  const idx = db.salesInvoices.findIndex(s => s.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Invoice not found' });
  db.salesInvoices[idx] = { ...db.salesInvoices[idx], ...req.body };
  res.json({ success: true, data: db.salesInvoices[idx], message: 'Invoice updated' });
});

apiRouter.delete(['/sales_invoices', '/sales-invoices', '/sales_invoices/:id', '/sales-invoices/:id'], (req, res) => {
  const id = parseInt(req.params.id || req.query.id);
  const idx = db.salesInvoices.findIndex(s => s.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Invoice not found' });
  db.salesInvoices.splice(idx, 1);
  res.json({ success: true, message: 'Invoice deleted' });
});

// Returns CRUD
apiRouter.get(['/purchase_returns', '/purchase-returns'], (req, res) => {
  res.json({ success: true, data: db.purchaseReturns });
});
apiRouter.post(['/purchase_returns', '/purchase-returns'], (req, res) => {
  const item = { id: genId(), user_id: 1, ...req.body, created_at: new Date().toISOString() };
  db.purchaseReturns.push(item);
  res.status(201).json({ success: true, data: { id: item.id }, message: 'Purchase return recorded' });
});

apiRouter.get(['/sales_returns', '/sales-returns'], (req, res) => {
  res.json({ success: true, data: db.salesReturns });
});
apiRouter.post(['/sales_returns', '/sales-returns'], (req, res) => {
  const item = { id: genId(), user_id: 1, ...req.body, created_at: new Date().toISOString() };
  db.salesReturns.push(item);
  res.status(201).json({ success: true, data: { id: item.id }, message: 'Sales return recorded' });
});

// Products purchased from supplier
apiRouter.get(['/products-purchased', '/products_purchased'], (req, res) => {
  const supplierId = req.query.supplier_id ? parseInt(req.query.supplier_id) : null;
  const relevantInvoices = supplierId 
    ? db.purchaseInvoices.filter(p => p.supplier_id === supplierId)
    : db.purchaseInvoices;
  
  const productMap = {};
  relevantInvoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      const pid = item.product_id;
      if (!productMap[pid]) {
        productMap[pid] = {
          id: pid,
          name: item.product_name,
          total_qty: 0,
          total_cost: 0,
          last_purchase_date: inv.date,
          last_price: item.unit_price || 0
        };
      }
      productMap[pid].total_qty += (parseFloat(item.quantity) || 0);
      productMap[pid].total_cost += (parseFloat(item.total) || 0);
      if (inv.date >= productMap[pid].last_purchase_date) {
        productMap[pid].last_purchase_date = inv.date;
        productMap[pid].last_price = item.unit_price || 0;
      }
    });
  });

  const list = Object.values(productMap).map(p => ({
    ...p,
    avg_cost: p.total_qty > 0 ? (p.total_cost / p.total_qty) : p.last_price
  }));

  res.json({ success: true, data: list });
});

// Expenses CRUD
apiRouter.get(['/expenses', '/expenses/:id'], (req, res) => {
  const id = (req.params.id || req.query.id) ? parseInt(req.params.id || req.query.id) : null;
  if (id) {
    const item = db.expenses.find(e => e.id === id);
    return item ? res.json({ success: true, data: item }) : res.status(404).json({ success: false, message: 'Not found' });
  }
  res.json({ success: true, data: db.expenses });
});

apiRouter.post('/expenses', (req, res) => {
  const body = req.body;
  const newExp = {
    id: genId(),
    user_id: 1,
    title: body.title || 'Expense',
    amount: parseFloat(body.amount) || 0,
    date: body.date || new Date().toISOString().slice(0, 10),
    category: body.category || 'Other',
    notes: body.notes || '',
    created_at: new Date().toISOString()
  };
  db.expenses.unshift(newExp);
  res.status(201).json({ success: true, data: { id: newExp.id }, message: 'Expense recorded' });
});

apiRouter.put(['/expenses', '/expenses/:id'], (req, res) => {
  const id = parseInt(req.params.id || req.query.id || req.body.id);
  const idx = db.expenses.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Expense not found' });
  db.expenses[idx] = { ...db.expenses[idx], ...req.body };
  res.json({ success: true, data: db.expenses[idx], message: 'Expense updated' });
});

apiRouter.delete(['/expenses', '/expenses/:id'], (req, res) => {
  const id = parseInt(req.params.id || req.query.id);
  const idx = db.expenses.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Expense not found' });
  db.expenses.splice(idx, 1);
  res.json({ success: true, message: 'Expense deleted' });
});

// Stock Movements
apiRouter.get('/stock', (req, res) => {
  res.json({ success: true, data: db.stockMovements });
});

// Roles & Team
apiRouter.get('/roles', (req, res) => {
  res.json({ success: true, data: db.roles });
});

apiRouter.get('/team', (req, res) => {
  res.json({ success: true, data: db.team });
});

apiRouter.post('/team', (req, res) => {
  const body = req.body;
  const member = {
    id: genId(),
    user_id: 1,
    name: body.name || 'Team Member',
    email: body.email || '',
    phone: body.phone || '',
    role: body.role || 'staff',
    role_name: body.role_name || 'Staff',
    status: body.status || 'active',
    created_at: new Date().toISOString()
  };
  db.team.push(member);
  res.status(201).json({ success: true, data: { id: member.id }, message: 'Team member added' });
});

// Accounts & Ledger & Payments
apiRouter.get('/ledger', (req, res) => {
  const ledgerEntries = [
    ...db.purchaseInvoices.map(p => ({
      id: 'pi_' + p.id,
      date: p.date,
      type: 'Purchase',
      reference: p.invoice_no,
      debit: p.total,
      credit: 0,
      balance: p.balance
    })),
    ...db.salesInvoices.map(s => ({
      id: 'si_' + s.id,
      date: s.date,
      type: 'Sale',
      reference: s.invoice_no,
      debit: 0,
      credit: s.total,
      balance: s.balance
    }))
  ];
  res.json({ success: true, data: ledgerEntries });
});

apiRouter.get('/payments', (req, res) => {
  res.json({ success: true, data: db.payments });
});

apiRouter.post('/payments', (req, res) => {
  const body = req.body;
  const payment = {
    id: genId(),
    user_id: 1,
    amount: parseFloat(body.amount) || 0,
    method: body.method || 'Cash',
    type: body.type || 'payment',
    date: body.date || new Date().toISOString().slice(0, 10),
    reference: body.reference || '',
    notes: body.notes || ''
  };
  db.payments.unshift(payment);
  res.status(201).json({ success: true, data: { id: payment.id }, message: 'Payment recorded' });
});

// Settings
apiRouter.get('/settings', (req, res) => {
  res.json({ success: true, data: db.settings });
});

apiRouter.post('/settings', (req, res) => {
  db.settings = { ...db.settings, ...req.body };
  res.json({ success: true, data: db.settings, message: 'Settings saved' });
});

// Activity
apiRouter.get('/activity', (req, res) => {
  res.json({ success: true, data: db.activityLogs });
});

// Reports
apiRouter.get('/reports', (req, res) => {
  const type = req.query.type;
  if (type === 'revenue') {
    const monthlyRevenue = [
      { month: 'Jan', revenue: 14500, expenses: 8200, profit: 6300 },
      { month: 'Feb', revenue: 16200, expenses: 9100, profit: 7100 },
      { month: 'Mar', revenue: 19800, expenses: 10400, profit: 9400 },
      { month: 'Apr', revenue: 17500, expenses: 8900, profit: 8600 },
      { month: 'May', revenue: 21300, expenses: 11200, profit: 10100 },
      { month: 'Jun', revenue: 24600, expenses: 12500, profit: 12100 }
    ];
    return res.json({ success: true, data: monthlyRevenue });
  }
  const summary = {
    total_sales: db.salesInvoices.reduce((a, b) => a + (parseFloat(b.total) || 0), 0),
    total_purchases: db.purchaseInvoices.reduce((a, b) => a + (parseFloat(b.total) || 0), 0),
    total_expenses: db.expenses.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0),
    net_profit: 42350.00
  };
  res.json({ success: true, data: summary });
});

// Offline Sync
apiRouter.all('/sync', (req, res) => {
  if (req.method === 'POST') {
    const items = req.body?.items || [];
    const results = items.map(item => ({
      queue_id: item.queue_id,
      status: 'synced',
      new_id: genId()
    }));
    return res.json({ success: true, data: { results }, message: 'Sync complete' });
  }
  res.json({ success: true, data: [], message: 'Sync complete' });
});

// Uploads
apiRouter.all('/uploads', (req, res) => {
  res.json({ success: true, data: [], message: 'Upload handled' });
});

// Legacy clients & projects
apiRouter.get('/clients', (req, res) => res.json({ success: true, data: db.clients }));
apiRouter.get('/projects', (req, res) => res.json({ success: true, data: db.projects }));
apiRouter.get('/invoices', (req, res) => res.json({ success: true, data: db.salesInvoices }));

// ── Mount API routes ──────────────────────────────────────────
app.use('/php/api', apiRouter);
app.use('/BizBrain-Pro/php/api', apiRouter);
app.use('/api', apiRouter);

// ── Static Files ──────────────────────────────────────────────
app.use('/BizBrain-Pro', express.static(__dirname));
app.use(express.static(__dirname));

app.get(['/BizBrain-Pro', '/BizBrain-Pro/'], (req, res) => {
  res.redirect('/');
});

// ── SPA Fallback ──────────────────────────────────────────────
const indexHtmlPath = path.join(__dirname, 'index.html');

app.get(/.*/, (req, res) => {
  if (path.extname(req.path)) {
    return res.status(404).send('Not Found');
  }

  try {
    let html = fs.readFileSync(indexHtmlPath, 'utf8');
    html = html.replace('__APP_BASE_PATH__', '/');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send('Error loading application shell');
  }
});

// ── Error Handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[BizBrain Server Error]', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Start Server ──────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log(`[BizBrain] Server running on http://${HOST}:${PORT}`);
});
