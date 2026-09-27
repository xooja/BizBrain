/**
 * BizBrain-Pro — db.js
 * Comprehensive Offline-First IndexedDB Engine.
 *
 * Implements:
 * - Enterprise-grade IndexedDB abstraction
 * - Client UUID generation (crypto.randomUUID)
 * - Safe version migrations
 * - Complete business data stores & indexes
 * - Initial offline catalog seeding
 * - JSON Export & Import (Backup & Restore)
 */

const DB = (() => {
  const DB_NAME    = 'BizBrainDB';
  const DB_VERSION = 5;

  let _db = null;

  // ── Object Store Schemas & Indexes ──────────────────────────
  const STORES = {
    users:                  { keyPath: 'id', indexes: ['email', 'role', 'status'] },
    settings:               { keyPath: 'key' },
    session:                { keyPath: 'key' },
    sync_queue:             { keyPath: 'queue_id', indexes: ['status', 'entity', 'created_at', 'attempts'] },
    products:               { keyPath: 'id', indexes: ['name', 'sku', 'barcode', 'category_id', 'supplier_id', 'status', 'synced', 'deletedAt'] },
    categories:             { keyPath: 'id', indexes: ['name', 'status', 'synced', 'deletedAt'] },
    suppliers:              { keyPath: 'id', indexes: ['company_name', 'phone', 'synced', 'deletedAt'] },
    customers:              { keyPath: 'id', indexes: ['name', 'company_name', 'phone', 'synced', 'deletedAt'] },
    purchase_invoices:      { keyPath: 'id', indexes: ['invoice_no', 'supplier_id', 'date', 'status', 'synced', 'deletedAt'] },
    purchase_invoice_items: { keyPath: 'id', indexes: ['purchase_invoice_id', 'product_id'] },
    sales_invoices:         { keyPath: 'id', indexes: ['invoice_no', 'customer_id', 'date', 'status', 'synced', 'deletedAt'] },
    sales_invoice_items:    { keyPath: 'id', indexes: ['sales_invoice_id', 'product_id'] },
    purchase_returns:       { keyPath: 'id', indexes: ['return_no', 'supplier_id', 'purchase_invoice_id', 'date', 'synced'] },
    purchase_return_items:  { keyPath: 'id', indexes: ['purchase_return_id', 'product_id'] },
    sales_returns:          { keyPath: 'id', indexes: ['return_no', 'customer_id', 'sales_invoice_id', 'date', 'synced'] },
    sales_return_items:     { keyPath: 'id', indexes: ['sales_return_id', 'product_id'] },
    orders:                 { keyPath: 'id', indexes: ['order_no', 'customer_id', 'date', 'status', 'synced'] },
    order_items:            { keyPath: 'id', indexes: ['order_id', 'product_id'] },
    stock_movements:        { keyPath: 'id', indexes: ['product_id', 'type', 'created_at'] },
    accounts:               { keyPath: 'id', indexes: ['name', 'type'] },
    payments:               { keyPath: 'id', indexes: ['party_type', 'party_id', 'date', 'reference', 'synced'] },
    expenses:               { keyPath: 'id', indexes: ['category', 'date', 'synced', 'deletedAt'] },
    asset_damage:           { keyPath: 'id', indexes: ['product_id', 'date', 'synced'] },
    team:                   { keyPath: 'id', indexes: ['email', 'role', 'status'] },
    activity:               { keyPath: 'id', indexes: ['type', 'created_at'] },
    app_metadata:           { keyPath: 'key' },
    customer_activity:      { keyPath: 'id', indexes: ['type', 'time'] },
    supplier_activity:      { keyPath: 'id', indexes: ['type', 'time'] },
    category_activity:      { keyPath: 'id', indexes: ['type', 'time'] },
  };

  // ── UUID Generator ──────────────────────────────────────────
  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'bb_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }

  // ── Open Database with safe migration ───────────────────────
  function open() {
    if (_db) return Promise.resolve(_db);

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        Object.entries(STORES).forEach(([name, cfg]) => {
          let store;
          if (!db.objectStoreNames.contains(name)) {
            store = db.createObjectStore(name, { keyPath: cfg.keyPath });
          } else {
            store = e.target.transaction.objectStore(name);
          }
          (cfg.indexes || []).forEach(idx => {
            if (!store.indexNames.contains(idx)) {
              store.createIndex(idx, idx, { unique: false });
            }
          });
        });
      };

      req.onsuccess = async (e) => {
        _db = e.target.result;
        _db.onversionchange = () => {
          _db.close();
          _db = null;
        };
        // Seed default catalog if empty on first boot
        try {
          await _checkAndSeedDefaults();
        } catch (seedErr) {
          console.warn('[DB] Seeding note:', seedErr);
        }
        resolve(_db);
      };

      req.onerror = (e) => reject(e.target.error);
    });
  }

  // ── Transaction Helper ──────────────────────────────────────
  async function tx(storeName, mode, callback) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const req = callback(store);
      if (req) {
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
      } else {
        transaction.oncomplete = () => resolve();
        transaction.onerror    = (e) => reject(e.target.error);
      }
    });
  }

  // ── CRUD Methods ────────────────────────────────────────────

  function get(store, key) {
    return tx(store, 'readonly', s => s.get(key));
  }

  function getAll(store) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await open();
        const t = db.transaction(store, 'readonly');
        const req = t.objectStore(store).getAll();
        req.onsuccess = (e) => resolve(e.target.result || []);
        req.onerror   = (e) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  function getByIndex(store, indexName, value) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await open();
        const t = db.transaction(store, 'readonly');
        const s = t.objectStore(store);
        if (!s.indexNames.contains(indexName)) {
          const all = await getAll(store);
          return resolve(all.filter(item => item[indexName] === value));
        }
        const idx = s.index(indexName);
        const req = idx.getAll(value);
        req.onsuccess = (e) => resolve(e.target.result || []);
        req.onerror   = (e) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  function put(store, record) {
    if (!record.id && STORES[store]?.keyPath === 'id') {
      record.id = uuid();
    }
    if (!record.createdAt) record.createdAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    return tx(store, 'readwrite', s => s.put(record));
  }

  async function putAll(store, records) {
    if (!Array.isArray(records) || !records.length) return 0;
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readwrite');
      const s = t.objectStore(store);
      records.forEach(r => {
        if (!r.id && STORES[store]?.keyPath === 'id') r.id = uuid();
        if (!r.createdAt) r.createdAt = new Date().toISOString();
        r.updatedAt = new Date().toISOString();
        s.put(r);
      });
      t.oncomplete = () => resolve(records.length);
      t.onerror    = (e) => reject(e.target.error);
    });
  }

  function del(store, key) {
    return tx(store, 'readwrite', s => s.delete(key));
  }

  function clear(store) {
    return tx(store, 'readwrite', s => s.clear());
  }

  function count(store) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await open();
        const t  = db.transaction(store, 'readonly');
        const req = t.objectStore(store).count();
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // ── Session Helpers ─────────────────────────────────────────
  async function setSession(data) {
    await put('session', { key: 'current', ...data });
  }

  async function getSession() {
    return get('session', 'current');
  }

  async function clearSession() {
    return del('session', 'current');
  }

  // ── Settings Helpers ────────────────────────────────────────
  async function getSetting(key, defaultVal = null) {
    const r = await get('settings', key);
    return r ? r.value : defaultVal;
  }

  async function setSetting(key, value) {
    return put('settings', { key, value });
  }

  // ── Device ID Helper ────────────────────────────────────────
  async function getDeviceId() {
    let dev = await get('app_metadata', 'deviceId');
    if (!dev) {
      dev = { key: 'deviceId', value: 'device_' + uuid() };
      await put('app_metadata', dev);
    }
    return dev.value;
  }

  // ── Sync Queue Helpers ──────────────────────────────────────
  async function enqueue(entity, action, payload) {
    const deviceId = await getDeviceId();
    const item = {
      queue_id:   `q_${Date.now()}_${uuid().substring(0, 8)}`,
      entity,
      action,
      entityId:   payload?.id || null,
      payload,
      deviceId,
      version:    payload?.version || 1,
      status:     'pending',
      attempts:   0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error:      null,
    };
    await put('sync_queue', item);
    return item;
  }

  async function getPendingQueue() {
    try {
      const all = await getAll('sync_queue');
      return all
        .filter(q => q.status === 'pending' || q.status === 'retry')
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } catch (_) {
      return [];
    }
  }

  async function markSynced(queue_id, remoteId = null) {
    const item = await get('sync_queue', queue_id);
    if (item) {
      item.status = 'synced';
      item.synced_at = new Date().toISOString();
      if (remoteId) item.remoteId = remoteId;
      await put('sync_queue', item);
    }
  }

  async function markFailed(queue_id, error) {
    const item = await get('sync_queue', queue_id);
    if (item) {
      item.attempts = (item.attempts || 0) + 1;
      item.error    = error;
      item.status   = item.attempts >= 5 ? 'failed' : 'retry';
      item.updated_at = new Date().toISOString();
      await put('sync_queue', item);
    }
  }

  // ── Default Offline Catalog Seeding ─────────────────────────
  async function _checkAndSeedDefaults() {
    const prodCount = await count('products');
    if (prodCount > 0) return;

    console.log('[DB] Seeding initial offline catalog...');

    const defaultCategories = [
      { id: 'cat_1', name: 'Electronics', description: 'Electronic devices and computer hardware', status: 'active', synced: 1 },
      { id: 'cat_2', name: 'Furniture', description: 'Office and home ergonomic furniture', status: 'active', synced: 1 },
      { id: 'cat_3', name: 'Stationery', description: 'Office stationery and paper supplies', status: 'active', synced: 1 },
      { id: 'cat_4', name: 'Groceries', description: 'Food and daily grocery consumables', status: 'active', synced: 1 },
      { id: 'cat_5', name: 'Clothing', description: 'Apparel, uniforms, and textiles', status: 'active', synced: 1 },
    ];
    await putAll('categories', defaultCategories);

    const defaultSuppliers = [
      { id: 'sup_1', company_name: 'TechSource Ltd', contact_person: 'John Smith', email: 'john@techsource.com', phone: '+1 555-111-0001', address: '123 Tech Street, Silicon Valley, CA', status: 'active', opening_balance: 0, current_balance: 1200.00, credit_limit: 10000.00, synced: 1 },
      { id: 'sup_2', company_name: 'OfficeWorld Inc', contact_person: 'Sarah Jones', email: 'sarah@officeworld.com', phone: '+1 555-111-0002', address: '456 Office Blvd, Chicago, IL', status: 'active', opening_balance: 0, current_balance: 450.00, credit_limit: 5000.00, synced: 1 },
      { id: 'sup_3', company_name: 'FreshGro Supplies', contact_person: 'Mike Brown', email: 'mike@freshgro.com', phone: '+1 555-111-0003', address: '789 Market Ave, Los Angeles, CA', status: 'active', opening_balance: 0, current_balance: 0.00, credit_limit: 8000.00, synced: 1 },
      { id: 'sup_4', company_name: 'FashionDirect', contact_person: 'Emma Wilson', email: 'emma@fashiondirect.com', phone: '+1 555-111-0004', address: '321 Style Street, New York, NY', status: 'active', opening_balance: 0, current_balance: 800.00, credit_limit: 6000.00, synced: 1 }
    ];
    await putAll('suppliers', defaultSuppliers);

    const defaultCustomers = [
      { id: 'cust_1', name: 'Alex Taylor', company_name: 'Taylor Supply Co.', email: 'alex@example.com', phone: '+1 555-000-0001', address: '100 Demo Street', status: 'active', opening_balance: 0, current_balance: 1500.00, synced: 1 },
      { id: 'cust_2', name: 'Sara Khan', company_name: 'Khan Enterprises', email: 'sara@khanent.com', phone: '+1 555-222-0002', address: '34 Park Ave, Chicago', status: 'active', opening_balance: 0, current_balance: 750.00, synced: 1 },
      { id: 'cust_3', name: 'Usman Ahmed', company_name: 'Ahmed & Sons', email: 'usman@ahmedsons.com', phone: '+1 555-222-0003', address: '56 Lake Rd, Boston', status: 'active', opening_balance: 0, current_balance: 320.00, synced: 1 },
      { id: 'cust_4', name: 'Fatima Ali', company_name: 'Ali General Store', email: 'fatima@aligen.com', phone: '+1 555-222-0004', address: '78 Hill St, LA', status: 'active', opening_balance: 0, current_balance: 0.00, synced: 1 }
    ];
    await putAll('customers', defaultCustomers);

    const defaultProducts = [
      { id: 'prod_1', category_id: 'cat_1', category_name: 'Electronics', name: 'LED Monitor 24"', sku: 'MON-001', barcode: '10001', description: 'Full HD Monitor', purchase_price: 120.00, sale_price: 180.00, stock: 15, min_stock: 3, unit: 'pcs', status: 'active', synced: 1 },
      { id: 'prod_2', category_id: 'cat_1', category_name: 'Electronics', name: 'Wireless Keyboard', sku: 'KEY-001', barcode: '10002', description: 'Ergonomic keyboard', purchase_price: 25.00, sale_price: 45.00, stock: 30, min_stock: 5, unit: 'pcs', status: 'active', synced: 1 },
      { id: 'prod_3', category_id: 'cat_1', category_name: 'Electronics', name: 'USB-C Hub', sku: 'USB-001', barcode: '10003', description: '7-in-1 USB hub', purchase_price: 18.00, sale_price: 35.00, stock: 25, min_stock: 5, unit: 'pcs', status: 'active', synced: 1 },
      { id: 'prod_4', category_id: 'cat_2', category_name: 'Furniture', name: 'Office Chair', sku: 'CHR-001', barcode: '10004', description: 'Mesh ergonomic chair', purchase_price: 85.00, sale_price: 150.00, stock: 10, min_stock: 2, unit: 'pcs', status: 'active', synced: 1 },
      { id: 'prod_5', category_id: 'cat_2', category_name: 'Furniture', name: 'Standing Desk', sku: 'DSK-001', barcode: '10005', description: 'Electric adjustable desk', purchase_price: 250.00, sale_price: 400.00, stock: 5, min_stock: 1, unit: 'pcs', status: 'active', synced: 1 },
      { id: 'prod_6', category_id: 'cat_3', category_name: 'Stationery', name: 'A4 Printer Paper (Box)', sku: 'PAP-001', barcode: '10006', description: '5 reams 500 sheets', purchase_price: 22.00, sale_price: 35.00, stock: 50, min_stock: 10, unit: 'box', status: 'active', synced: 1 },
      { id: 'prod_7', category_id: 'cat_3', category_name: 'Stationery', name: 'Ballpoint Pens (Pack)', sku: 'PEN-001', barcode: '10007', description: 'Blue ink box of 50', purchase_price: 5.00, sale_price: 12.00, stock: 100, min_stock: 20, unit: 'pack', status: 'active', synced: 1 },
      { id: 'prod_8', category_id: 'cat_4', category_name: 'Groceries', name: 'Basmati Rice (5kg)', sku: 'RCE-001', barcode: '10008', description: 'Premium long grain', purchase_price: 8.00, sale_price: 14.00, stock: 40, min_stock: 10, unit: 'bag', status: 'active', synced: 1 },
      { id: 'prod_9', category_id: 'cat_4', category_name: 'Groceries', name: 'Cooking Oil (3L)', sku: 'OIL-001', barcode: '10009', description: 'Pure vegetable oil', purchase_price: 6.00, sale_price: 11.00, stock: 35, min_stock: 8, unit: 'bottle', status: 'active', synced: 1 },
      { id: 'prod_10', category_id: 'cat_5', category_name: 'Clothing', name: 'Cotton T-Shirt', sku: 'TSH-001', barcode: '10010', description: '100% Organic cotton', purchase_price: 8.00, sale_price: 20.00, stock: 60, min_stock: 15, unit: 'pcs', status: 'active', synced: 1 }
    ];
    await putAll('products', defaultProducts);

    const defaultPI = [
      {
        id: 'pi_1',
        supplier_id: 'sup_1',
        supplier_name: 'TechSource Ltd',
        invoice_no: 'PI-20250601-001',
        date: '2025-06-01',
        total: 1800.00,
        paid_amount: 600.00,
        balance: 1200.00,
        status: 'partial',
        notes: 'Initial stock order',
        synced: 1,
        items: [
          { id: 'pii_1', product_id: 'prod_1', product_name: 'LED Monitor 24"', quantity: 10, unit_price: 120.00, total: 1200.00 },
          { id: 'pii_2', product_id: 'prod_2', product_name: 'Wireless Keyboard', quantity: 24, unit_price: 25.00, total: 600.00 }
        ]
      }
    ];
    await putAll('purchase_invoices', defaultPI);

    const defaultSI = [
      {
        id: 'si_1',
        customer_id: 'cust_1',
        customer_name: 'Alex Taylor',
        invoice_no: 'SI-20250602-001',
        date: '2025-06-02',
        total: 2250.00,
        paid_amount: 750.00,
        balance: 1500.00,
        status: 'partial',
        notes: 'Corporate equipment order',
        synced: 1,
        items: [
          { id: 'sii_1', product_id: 'prod_1', product_name: 'LED Monitor 24"', quantity: 5, unit_price: 180.00, total: 900.00 },
          { id: 'sii_2', product_id: 'prod_5', product_name: 'Standing Desk', quantity: 3, unit_price: 450.00, total: 1350.00 }
        ]
      }
    ];
    await putAll('sales_invoices', defaultSI);

    const defaultExpenses = [
      { id: 'exp_1', title: 'Adobe Creative Cloud', amount: 52.99, date: '2025-06-01', category: 'Software', notes: 'Design license', synced: 1 },
      { id: 'exp_2', title: 'AWS Hosting', amount: 129.40, date: '2025-06-02', category: 'Software', notes: 'Cloud servers', synced: 1 },
      { id: 'exp_3', title: 'Team Lunch', amount: 87.50, date: '2025-06-03', category: 'Meals', notes: 'Sprint review meal', synced: 1 },
      { id: 'exp_4', title: 'Figma Pro', amount: 15.00, date: '2025-06-04', category: 'Software', notes: 'Pro license', synced: 1 },
      { id: 'exp_5', title: 'Office Supplies', amount: 43.20, date: '2025-06-05', category: 'Office', notes: 'Paper & pens', synced: 1 }
    ];
    await putAll('expenses', defaultExpenses);

    const defaultSettings = [
      { key: 'biz_name', value: 'BizBrain-Pro Inc.' },
      { key: 'currency', value: 'USD' },
      { key: 'timezone', value: 'UTC' },
      { key: 'invoice_prefix', value: 'INV' },
      { key: 'tax_rate', value: '0' }
    ];
    for (const s of defaultSettings) {
      await put('settings', s);
    }

    const defaultTeam = [
      { id: 'team_1', name: 'Admin User', email: 'admin@bizbrain.com', role: 'admin', role_name: 'Administrator', status: 'active', phone: '+1 555-010-0001' }
    ];
    await putAll('team', defaultTeam);

    console.log('[DB] Seeding complete! Application ready for true offline operations.');
  }

  // ── Backup & Restore Helpers ────────────────────────────────
  async function exportBackup() {
    const backupData = {
      app: 'BizBrain-Pro',
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      stores: {}
    };

    const exportStoreNames = [
      'products', 'categories', 'suppliers', 'customers',
      'purchase_invoices', 'sales_invoices', 'purchase_returns', 'sales_returns',
      'orders', 'stock_movements', 'accounts', 'payments', 'expenses',
      'asset_damage', 'team', 'settings'
    ];

    for (const name of exportStoreNames) {
      try {
        backupData.stores[name] = await getAll(name);
      } catch (err) {
        backupData.stores[name] = [];
      }
    }

    return JSON.stringify(backupData, null, 2);
  }

  async function importBackup(jsonString) {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (_) {
      throw new Error('Invalid JSON backup file.');
    }

    if (!parsed || !parsed.stores || typeof parsed.stores !== 'object') {
      throw new Error('Backup file does not match BizBrain-Pro schema.');
    }

    let importedCount = 0;
    for (const [storeName, records] of Object.entries(parsed.stores)) {
      if (STORES[storeName] && Array.isArray(records)) {
        await putAll(storeName, records);
        importedCount += records.length;
      }
    }

    return importedCount;
  }

  return {
    open,
    get,
    getAll,
    getByIndex,
    put,
    putAll,
    del,
    clear,
    count,
    uuid,
    setSession,
    getSession,
    clearSession,
    getSetting,
    setSetting,
    getDeviceId,
    enqueue,
    getPendingQueue,
    markSynced,
    markFailed,
    exportBackup,
    importBackup,
  };
})();
