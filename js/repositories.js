/**
 * BizBrain-Pro — repositories.js
 * Centralized Local-First Repository Layer.
 *
 * All UI modules interact EXCLUSIVELY with repositories.
 * Repositories:
 * 1. Read from IndexedDB immediately (instant, zero-latency UI).
 * 2. Write to IndexedDB immediately.
 * 3. Enqueue operation into sync_queue for background sync.
 * 4. Maintain relational consistency locally:
 *    - Invoices update stock & ledger balances.
 *    - Returns adjust stock & ledger balances.
 *    - Payments update ledger balances.
 * 5. Compute reports 100% locally from IndexedDB data without requiring internet!
 */

const Repositories = (() => {

  // ── Helper for generating standard invoice/return numbers ─────
  function _generateNumber(prefix) {
    const d = new Date();
    const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${ymd}-${rand}`;
  }

  // ═════════════════════════════════════════════════════════════
  // 1. PRODUCT REPOSITORY
  // ═════════════════════════════════════════════════════════════
  const Products = {
    async getAll(filters = {}) {
      const all = await DB.getAll('products');
      let list = all.filter(p => !p.deletedAt);

      if (filters.search) {
        const q = filters.search.toLowerCase();
        list = list.filter(p =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q) ||
          (p.barcode || '').toLowerCase().includes(q) ||
          (p.category_name || '').toLowerCase().includes(q)
        );
      }

      if (filters.category) {
        list = list.filter(p =>
          String(p.category_id) === String(filters.category) ||
          p.category_name === filters.category
        );
      }

      if (filters.stockStatus) {
        list = list.filter(p => {
          const qty = parseFloat(p.stock || 0);
          const min = parseFloat(p.min_stock || 5);
          if (filters.stockStatus === 'instock') return qty > min;
          if (filters.stockStatus === 'low') return qty > 0 && qty <= min;
          if (filters.stockStatus === 'out') return qty <= 0;
          return true;
        });
      }

      return list;
    },

    async getById(id) {
      const p = await DB.get('products', id);
      return (p && !p.deletedAt) ? p : null;
    },

    async create(data) {
      const id = data.id || DB.uuid();
      const product = {
        id,
        name: data.name?.trim() || 'Untitled Product',
        category_id: data.category_id || null,
        category_name: data.category_name || '',
        sku: data.sku?.trim() || ('SKU-' + Date.now().toString(36).toUpperCase()),
        barcode: data.barcode?.trim() || '',
        description: data.description?.trim() || '',
        purchase_price: parseFloat(data.purchase_price) || 0,
        sale_price: parseFloat(data.sale_price) || 0,
        stock: parseFloat(data.stock) || 0,
        min_stock: parseFloat(data.min_stock) || 0,
        unit: data.unit || 'pcs',
        status: data.status || 'active',
        supplier_id: data.supplier_id || null,
        synced: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await DB.put('products', product);

      // Record opening stock movement if stock > 0
      if (product.stock > 0) {
        await Inventory.logMovement({
          product_id: product.id,
          product_name: product.name,
          type: 'opening',
          quantity: product.stock,
          stock_before: 0,
          stock_after: product.stock,
          unit_price: product.purchase_price,
          notes: 'Opening stock balance'
        });
      }

      await DB.enqueue('products', 'create', product);
      return product;
    },

    async update(id, updates) {
      const existing = await DB.get('products', id);
      if (!existing) throw new Error('Product not found');

      const oldStock = parseFloat(existing.stock || 0);
      const newStock = updates.stock !== undefined ? parseFloat(updates.stock) : oldStock;

      const updated = {
        ...existing,
        ...updates,
        id,
        synced: 0,
        updatedAt: new Date().toISOString(),
      };

      await DB.put('products', updated);

      // If manual stock adjustment occurred
      if (newStock !== oldStock && updates.logAdjustment) {
        const diff = newStock - oldStock;
        await Inventory.logMovement({
          product_id: id,
          product_name: updated.name,
          type: 'adjustment',
          quantity: Math.abs(diff),
          stock_before: oldStock,
          stock_after: newStock,
          notes: updates.adjustmentReason || 'Manual inventory adjustment'
        });
      }

      await DB.enqueue('products', 'update', updated);
      return updated;
    },

    async delete(id) {
      const existing = await DB.get('products', id);
      if (!existing) return;

      // Soft delete locally
      existing.deletedAt = new Date().toISOString();
      existing.synced = 0;
      await DB.put('products', existing);

      await DB.enqueue('products', 'delete', { id, deletedAt: existing.deletedAt });
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 2. CATEGORY REPOSITORY
  // ═════════════════════════════════════════════════════════════
  const Categories = {
    async getAll() {
      const all = await DB.getAll('categories');
      return all.filter(c => !c.deletedAt);
    },

    async getById(id) {
      const c = await DB.get('categories', id);
      return (c && !c.deletedAt) ? c : null;
    },

    async create(data) {
      const category = {
        id: data.id || DB.uuid(),
        name: data.name?.trim() || 'New Category',
        description: data.description?.trim() || '',
        status: data.status || 'active',
        synced: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await DB.put('categories', category);
      await DB.enqueue('categories', 'create', category);
      return category;
    },

    async update(id, updates) {
      const existing = await DB.get('categories', id);
      if (!existing) throw new Error('Category not found');
      const updated = { ...existing, ...updates, id, synced: 0, updatedAt: new Date().toISOString() };
      await DB.put('categories', updated);
      await DB.enqueue('categories', 'update', updated);
      return updated;
    },

    async delete(id) {
      const existing = await DB.get('categories', id);
      if (!existing) return;
      existing.deletedAt = new Date().toISOString();
      existing.synced = 0;
      await DB.put('categories', existing);
      await DB.enqueue('categories', 'delete', { id, deletedAt: existing.deletedAt });
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 3. SUPPLIER REPOSITORY
  // ═════════════════════════════════════════════════════════════
  const Suppliers = {
    async getAll() {
      const all = await DB.getAll('suppliers');
      return all.filter(s => !s.deletedAt);
    },

    async getById(id) {
      const s = await DB.get('suppliers', id);
      return (s && !s.deletedAt) ? s : null;
    },

    async create(data) {
      const supplier = {
        id: data.id || DB.uuid(),
        company_name: data.company_name?.trim() || data.name?.trim() || 'New Supplier',
        contact_person: data.contact_person?.trim() || '',
        email: data.email?.trim() || '',
        phone: data.phone?.trim() || '',
        address: data.address?.trim() || '',
        opening_balance: parseFloat(data.opening_balance) || 0,
        opening_balance_type: data.opening_balance_type || 'payable',
        current_balance: parseFloat(data.current_balance || data.opening_balance) || 0,
        credit_limit: parseFloat(data.credit_limit) || 0,
        status: data.status || 'active',
        notes: data.notes?.trim() || '',
        synced: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await DB.put('suppliers', supplier);
      await DB.enqueue('suppliers', 'create', supplier);
      return supplier;
    },

    async update(id, updates) {
      const existing = await DB.get('suppliers', id);
      if (!existing) throw new Error('Supplier not found');
      const updated = { ...existing, ...updates, id, synced: 0, updatedAt: new Date().toISOString() };
      await DB.put('suppliers', updated);
      await DB.enqueue('suppliers', 'update', updated);
      return updated;
    },

    async delete(id) {
      const existing = await DB.get('suppliers', id);
      if (!existing) return;
      existing.deletedAt = new Date().toISOString();
      existing.synced = 0;
      await DB.put('suppliers', existing);
      await DB.enqueue('suppliers', 'delete', { id, deletedAt: existing.deletedAt });
    },

    async adjustBalance(supplierId, deltaAmount) {
      const s = await DB.get('suppliers', supplierId);
      if (!s) return;
      s.current_balance = (parseFloat(s.current_balance || 0) + deltaAmount);
      s.updatedAt = new Date().toISOString();
      await DB.put('suppliers', s);
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 4. CUSTOMER REPOSITORY
  // ═════════════════════════════════════════════════════════════
  const Customers = {
    async getAll() {
      const all = await DB.getAll('customers');
      return all.filter(c => !c.deletedAt);
    },

    async getById(id) {
      const c = await DB.get('customers', id);
      return (c && !c.deletedAt) ? c : null;
    },

    async create(data) {
      const customer = {
        id: data.id || DB.uuid(),
        name: data.name?.trim() || 'New Customer',
        company_name: data.company_name?.trim() || '',
        email: data.email?.trim() || '',
        phone: data.phone?.trim() || '',
        address: data.address?.trim() || '',
        opening_balance: parseFloat(data.opening_balance) || 0,
        current_balance: parseFloat(data.current_balance || data.opening_balance) || 0,
        status: data.status || 'active',
        notes: data.notes?.trim() || '',
        synced: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await DB.put('customers', customer);
      await DB.enqueue('customers', 'create', customer);
      return customer;
    },

    async update(id, updates) {
      const existing = await DB.get('customers', id);
      if (!existing) throw new Error('Customer not found');
      const updated = { ...existing, ...updates, id, synced: 0, updatedAt: new Date().toISOString() };
      await DB.put('customers', updated);
      await DB.enqueue('customers', 'update', updated);
      return updated;
    },

    async delete(id) {
      const existing = await DB.get('customers', id);
      if (!existing) return;
      existing.deletedAt = new Date().toISOString();
      existing.synced = 0;
      await DB.put('customers', existing);
      await DB.enqueue('customers', 'delete', { id, deletedAt: existing.deletedAt });
    },

    async adjustBalance(customerId, deltaAmount) {
      const c = await DB.get('customers', customerId);
      if (!c) return;
      c.current_balance = (parseFloat(c.current_balance || 0) + deltaAmount);
      c.updatedAt = new Date().toISOString();
      await DB.put('customers', c);
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 5. PURCHASE INVOICE REPOSITORY
  // ═════════════════════════════════════════════════════════════
  const Purchases = {
    async getAll() {
      const all = await DB.getAll('purchase_invoices');
      return all.filter(p => !p.deletedAt).sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    },

    async getById(id) {
      const pi = await DB.get('purchase_invoices', id);
      return (pi && !pi.deletedAt) ? pi : null;
    },

    async create(data) {
      const id = data.id || DB.uuid();
      const invoiceNo = data.invoice_no || _generateNumber('PI');
      const items = Array.isArray(data.items) ? data.items : [];

      let subtotal = 0;
      const parsedItems = items.map(it => {
        const qty = parseFloat(it.quantity || it.qty || 1);
        const rate = parseFloat(it.purchase_price || it.unit_price || it.rate || 0);
        const disc = parseFloat(it.discount || 0);
        const lineTotal = Math.max(0, (qty * rate) - disc);
        subtotal += lineTotal;
        return {
          id: it.id || DB.uuid(),
          purchase_invoice_id: id,
          product_id: it.product_id,
          product_name: it.product_name || 'Product',
          quantity: qty,
          purchase_price: rate,
          sale_price: parseFloat(it.sale_price) || 0,
          discount: disc,
          total: lineTotal
        };
      });

      const discount = parseFloat(data.discount) || 0;
      const taxRate = parseFloat(data.tax_rate) || 0;
      const taxable = Math.max(0, subtotal - discount);
      const taxAmount = (taxable * taxRate) / 100;
      const total = taxable + taxAmount;
      const paid = parseFloat(data.paid_amount || data.paid || 0);
      const balance = Math.max(0, total - paid);

      const status = balance === 0 ? 'paid' : (paid > 0 ? 'partial' : 'received');

      const invoice = {
        id,
        invoice_no: invoiceNo,
        supplier_id: data.supplier_id,
        supplier_name: data.supplier_name || 'Supplier',
        date: data.date || new Date().toISOString().slice(0, 10),
        due_date: data.due_date || null,
        subtotal,
        discount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        paid_amount: paid,
        balance,
        status,
        notes: data.notes || '',
        items: parsedItems,
        synced: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 1. Save invoice to IndexedDB
      await DB.put('purchase_invoices', invoice);

      // 2. Automatically update inventory (Stock IN) & log movement
      for (const item of parsedItems) {
        if (item.product_id) {
          const prod = await DB.get('products', item.product_id);
          if (prod) {
            const currentStock = parseFloat(prod.stock || 0);
            const newStock = currentStock + item.quantity;
            prod.stock = newStock;
            if (item.sale_price > 0) prod.sale_price = item.sale_price;
            prod.purchase_price = item.purchase_price;
            await DB.put('products', prod);

            await Inventory.logMovement({
              product_id: item.product_id,
              product_name: item.product_name,
              type: 'purchase',
              reference_type: 'purchase_invoice',
              reference_id: invoice.id,
              quantity: item.quantity,
              stock_before: currentStock,
              stock_after: newStock,
              unit_price: item.purchase_price,
              notes: `Purchased via ${invoice.invoice_no}`
            });
          }
        }
      }

      // 3. Update Supplier Balance (We owe them the unpaid balance)
      if (invoice.supplier_id) {
        await Suppliers.adjustBalance(invoice.supplier_id, balance);
      }

      // 4. Log payment transaction if payment occurred
      if (paid > 0) {
        await Finance.recordPayment({
          party_type: 'supplier',
          party_id: invoice.supplier_id,
          invoice_type: 'purchase',
          invoice_id: invoice.id,
          amount: paid,
          method: data.payment_method || 'Cash',
          reference: invoice.invoice_no,
          notes: `Payment for ${invoice.invoice_no}`
        });
      }

      // 5. Enqueue synchronization
      await DB.enqueue('purchase_invoices', 'create', invoice);

      return invoice;
    },

    async delete(id) {
      const existing = await DB.get('purchase_invoices', id);
      if (!existing) return;
      existing.deletedAt = new Date().toISOString();
      existing.synced = 0;
      await DB.put('purchase_invoices', existing);
      await DB.enqueue('purchase_invoices', 'delete', { id, deletedAt: existing.deletedAt });
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 6. SALES INVOICE REPOSITORY
  // ═════════════════════════════════════════════════════════════
  const Sales = {
    async getAll() {
      const all = await DB.getAll('sales_invoices');
      return all.filter(s => !s.deletedAt).sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    },

    async getById(id) {
      const si = await DB.get('sales_invoices', id);
      return (si && !si.deletedAt) ? si : null;
    },

    async create(data) {
      const id = data.id || DB.uuid();
      const invoiceNo = data.invoice_no || _generateNumber('SI');
      const items = Array.isArray(data.items) ? data.items : [];

      let subtotal = 0;
      const parsedItems = items.map(it => {
        const qty = parseFloat(it.quantity || it.qty || 1);
        const rate = parseFloat(it.sale_price || it.unit_price || it.rate || 0);
        const disc = parseFloat(it.discount || 0);
        const lineTotal = Math.max(0, (qty * rate) - disc);
        subtotal += lineTotal;
        return {
          id: it.id || DB.uuid(),
          sales_invoice_id: id,
          product_id: it.product_id,
          product_name: it.product_name || 'Product',
          quantity: qty,
          sale_price: rate,
          discount: disc,
          total: lineTotal
        };
      });

      const discount = parseFloat(data.discount) || 0;
      const taxRate = parseFloat(data.tax_rate) || 0;
      const taxable = Math.max(0, subtotal - discount);
      const taxAmount = (taxable * taxRate) / 100;
      const total = taxable + taxAmount;
      const paid = parseFloat(data.paid_amount || data.paid || 0);
      const balance = Math.max(0, total - paid);

      const status = balance === 0 ? 'paid' : (paid > 0 ? 'partial' : 'sent');

      const invoice = {
        id,
        invoice_no: invoiceNo,
        customer_id: data.customer_id,
        customer_name: data.customer_name || 'Customer',
        date: data.date || new Date().toISOString().slice(0, 10),
        due_date: data.due_date || null,
        subtotal,
        discount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        paid_amount: paid,
        balance,
        status,
        notes: data.notes || '',
        items: parsedItems,
        synced: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 1. Save invoice to IndexedDB
      await DB.put('sales_invoices', invoice);

      // 2. Automatically deduct inventory (Stock OUT) & log movement
      for (const item of parsedItems) {
        if (item.product_id) {
          const prod = await DB.get('products', item.product_id);
          if (prod) {
            const currentStock = parseFloat(prod.stock || 0);
            const newStock = Math.max(0, currentStock - item.quantity);
            prod.stock = newStock;
            await DB.put('products', prod);

            await Inventory.logMovement({
              product_id: item.product_id,
              product_name: item.product_name,
              type: 'sale',
              reference_type: 'sales_invoice',
              reference_id: invoice.id,
              quantity: item.quantity,
              stock_before: currentStock,
              stock_after: newStock,
              unit_price: item.sale_price,
              notes: `Sold via ${invoice.invoice_no}`
            });
          }
        }
      }

      // 3. Update Customer Balance (They owe us the unpaid balance)
      if (invoice.customer_id) {
        await Customers.adjustBalance(invoice.customer_id, balance);
      }

      // 4. Log receipt transaction if payment received
      if (paid > 0) {
        await Finance.recordPayment({
          party_type: 'customer',
          party_id: invoice.customer_id,
          invoice_type: 'sales',
          invoice_id: invoice.id,
          amount: paid,
          method: data.payment_method || 'Cash',
          reference: invoice.invoice_no,
          notes: `Collection for ${invoice.invoice_no}`
        });
      }

      // 5. Enqueue synchronization
      await DB.enqueue('sales_invoices', 'create', invoice);

      return invoice;
    },

    async delete(id) {
      const existing = await DB.get('sales_invoices', id);
      if (!existing) return;
      existing.deletedAt = new Date().toISOString();
      existing.synced = 0;
      await DB.put('sales_invoices', existing);
      await DB.enqueue('sales_invoices', 'delete', { id, deletedAt: existing.deletedAt });
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 7. INVENTORY REPOSITORY & AUDIT TRAIL
  // ═════════════════════════════════════════════════════════════
  const Inventory = {
    async getMovements(productId = null) {
      const all = await DB.getAll('stock_movements');
      if (productId) return all.filter(m => String(m.product_id) === String(productId));
      return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    async logMovement(data) {
      const movement = {
        id: data.id || DB.uuid(),
        product_id: data.product_id,
        product_name: data.product_name || '',
        type: data.type || 'adjustment', // 'purchase' | 'sale' | 'purchase_return' | 'sales_return' | 'adjustment' | 'opening' | 'damage'
        reference_type: data.reference_type || null,
        reference_id: data.reference_id || null,
        quantity: parseFloat(data.quantity) || 0,
        stock_before: parseFloat(data.stock_before) || 0,
        stock_after: parseFloat(data.stock_after) || 0,
        unit_price: parseFloat(data.unit_price) || 0,
        notes: data.notes || '',
        created_at: new Date().toISOString()
      };
      await DB.put('stock_movements', movement);
      return movement;
    },

    async getValuation() {
      const prods = await Products.getAll();
      let totalItems = 0;
      let totalStockValue = 0;
      let totalRetailValue = 0;
      let lowStockCount = 0;

      prods.forEach(p => {
        const stock = parseFloat(p.stock || 0);
        const cost = parseFloat(p.purchase_price || 0);
        const retail = parseFloat(p.sale_price || 0);
        const min = parseFloat(p.min_stock || 5);

        totalItems += stock;
        totalStockValue += (stock * cost);
        totalRetailValue += (stock * retail);
        if (stock <= min) lowStockCount++;
      });

      return {
        totalProducts: prods.length,
        totalItems,
        totalStockValue,
        totalRetailValue,
        projectedProfit: totalRetailValue - totalStockValue,
        lowStockCount
      };
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 8. RETURNS REPOSITORY (PURCHASE & SALES)
  // ═════════════════════════════════════════════════════════════
  const Returns = {
    async getPurchaseReturns() {
      return (await DB.getAll('purchase_returns')).sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    },

    async createPurchaseReturn(data) {
      const id = data.id || DB.uuid();
      const returnNo = data.return_no || _generateNumber('PR');
      const items = Array.isArray(data.items) ? data.items : [];

      let total = 0;
      items.forEach(it => {
        const qty = parseFloat(it.quantity || 1);
        const price = parseFloat(it.purchase_price || 0);
        total += (qty * price);
      });

      const ret = {
        id,
        return_no: returnNo,
        supplier_id: data.supplier_id,
        supplier_name: data.supplier_name || 'Supplier',
        purchase_invoice_id: data.purchase_invoice_id || null,
        date: data.date || new Date().toISOString().slice(0, 10),
        reason: data.reason || '',
        total,
        status: 'completed',
        items,
        synced: 0,
        createdAt: new Date().toISOString()
      };

      await DB.put('purchase_returns', ret);

      // Decrement stock (items returned to supplier)
      for (const it of items) {
        if (it.product_id) {
          const prod = await DB.get('products', it.product_id);
          if (prod) {
            const currentStock = parseFloat(prod.stock || 0);
            const newStock = Math.max(0, currentStock - it.quantity);
            prod.stock = newStock;
            await DB.put('products', prod);

            await Inventory.logMovement({
              product_id: it.product_id,
              product_name: it.product_name,
              type: 'purchase_return',
              reference_type: 'purchase_return',
              reference_id: ret.id,
              quantity: it.quantity,
              stock_before: currentStock,
              stock_after: newStock,
              unit_price: it.purchase_price,
              notes: `Returned to supplier via ${ret.return_no}`
            });
          }
        }
      }

      // Decrement supplier balance (we owe them less)
      if (ret.supplier_id && total > 0) {
        await Suppliers.adjustBalance(ret.supplier_id, -total);
      }

      await DB.enqueue('purchase_returns', 'create', ret);
      return ret;
    },

    async getSalesReturns() {
      return (await DB.getAll('sales_returns')).sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    },

    async createSalesReturn(data) {
      const id = data.id || DB.uuid();
      const returnNo = data.return_no || _generateNumber('SR');
      const items = Array.isArray(data.items) ? data.items : [];

      let total = 0;
      items.forEach(it => {
        const qty = parseFloat(it.quantity || 1);
        const price = parseFloat(it.sale_price || 0);
        total += (qty * price);
      });

      const ret = {
        id,
        return_no: returnNo,
        customer_id: data.customer_id,
        customer_name: data.customer_name || 'Customer',
        sales_invoice_id: data.sales_invoice_id || null,
        date: data.date || new Date().toISOString().slice(0, 10),
        reason: data.reason || '',
        total,
        status: 'completed',
        items,
        synced: 0,
        createdAt: new Date().toISOString()
      };

      await DB.put('sales_returns', ret);

      // Increment stock (items returned by customer back to inventory)
      for (const it of items) {
        if (it.product_id) {
          const prod = await DB.get('products', it.product_id);
          if (prod) {
            const currentStock = parseFloat(prod.stock || 0);
            const newStock = currentStock + it.quantity;
            prod.stock = newStock;
            await DB.put('products', prod);

            await Inventory.logMovement({
              product_id: it.product_id,
              product_name: it.product_name,
              type: 'sales_return',
              reference_type: 'sales_return',
              reference_id: ret.id,
              quantity: it.quantity,
              stock_before: currentStock,
              stock_after: newStock,
              unit_price: it.sale_price,
              notes: `Returned by customer via ${ret.return_no}`
            });
          }
        }
      }

      // Decrement customer balance (they owe us less)
      if (ret.customer_id && total > 0) {
        await Customers.adjustBalance(ret.customer_id, -total);
      }

      await DB.enqueue('sales_returns', 'create', ret);
      return ret;
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 9. EXPENSE REPOSITORY
  // ═════════════════════════════════════════════════════════════
  const Expenses = {
    async getAll() {
      const all = await DB.getAll('expenses');
      return all.filter(e => !e.deletedAt).sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    },

    async create(data) {
      const expense = {
        id: data.id || DB.uuid(),
        title: data.title?.trim() || data.description?.trim() || 'General Expense',
        amount: parseFloat(data.amount) || 0,
        date: data.date || new Date().toISOString().slice(0, 10),
        category: data.category || 'General',
        notes: data.notes?.trim() || '',
        synced: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await DB.put('expenses', expense);
      await DB.enqueue('expenses', 'create', expense);
      return expense;
    },

    async update(id, updates) {
      const existing = await DB.get('expenses', id);
      if (!existing) throw new Error('Expense not found');
      const updated = { ...existing, ...updates, id, synced: 0, updatedAt: new Date().toISOString() };
      await DB.put('expenses', updated);
      await DB.enqueue('expenses', 'update', updated);
      return updated;
    },

    async delete(id) {
      const existing = await DB.get('expenses', id);
      if (!existing) return;
      existing.deletedAt = new Date().toISOString();
      existing.synced = 0;
      await DB.put('expenses', existing);
      await DB.enqueue('expenses', 'delete', { id, deletedAt: existing.deletedAt });
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 10. FINANCE & PAYMENTS REPOSITORY
  // ═════════════════════════════════════════════════════════════
  const Finance = {
    async getPayments() {
      return (await DB.getAll('payments')).sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    },

    async recordPayment(data) {
      const payment = {
        id: data.id || DB.uuid(),
        party_type: data.party_type || 'customer', // 'supplier' | 'customer'
        party_id: data.party_id,
        invoice_type: data.invoice_type || null,
        invoice_id: data.invoice_id || null,
        payment_no: data.payment_no || _generateNumber('PAY'),
        date: data.date || new Date().toISOString().slice(0, 10),
        amount: parseFloat(data.amount) || 0,
        method: data.method || 'Cash',
        reference: data.reference || '',
        notes: data.notes || '',
        synced: 0,
        createdAt: new Date().toISOString()
      };
      await DB.put('payments', payment);
      await DB.enqueue('payments', 'create', payment);
      return payment;
    },

    async getLedgerSummary() {
      const sups = await Suppliers.getAll();
      const custs = await Customers.getAll();

      const totalPayables = sups.reduce((acc, s) => acc + Math.max(0, parseFloat(s.current_balance || 0)), 0);
      const totalReceivables = custs.reduce((acc, c) => acc + Math.max(0, parseFloat(c.current_balance || 0)), 0);

      return {
        totalPayables,
        totalReceivables,
        netBalance: totalReceivables - totalPayables,
        suppliersCount: sups.length,
        customersCount: custs.length
      };
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 11. REPORTS REPOSITORY (100% OFFLINE DATA COMPUTATION)
  // ═════════════════════════════════════════════════════════════
  const Reports = {
    async getSummary() {
      const sales = await Sales.getAll();
      const purchases = await Purchases.getAll();
      const expenses = await Expenses.getAll();
      const products = await Products.getAll();

      const totalSales = sales.reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0);
      const totalPurchases = purchases.reduce((acc, p) => acc + (parseFloat(p.total) || 0), 0);
      const totalExpenses = expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);

      // Estimated cost of goods sold
      let cogs = 0;
      sales.forEach(s => {
        (s.items || []).forEach(it => {
          const prod = products.find(p => p.id === it.product_id);
          const cost = prod ? (parseFloat(prod.purchase_price) || 0) : 0;
          cogs += (cost * (parseFloat(it.quantity) || 1));
        });
      });

      const grossProfit = totalSales - cogs;
      const netProfit = grossProfit - totalExpenses;

      return {
        totalSales,
        totalPurchases,
        totalExpenses,
        cogs,
        grossProfit,
        netProfit,
        salesCount: sales.length,
        purchasesCount: purchases.length,
        expensesCount: expenses.length,
        productsCount: products.length
      };
    }
  };

  return {
    Products,
    Categories,
    Suppliers,
    Customers,
    Purchases,
    Sales,
    Inventory,
    Returns,
    Expenses,
    Finance,
    Reports,
  };
})();
