# 🧠 BizBrain-Pro — Memory Bank

> **Persistent project knowledge base.**  
> Captures architecture, decisions, patterns, and context for AI-assisted development.

---

## 📌 Project Overview

**BizBrain-Pro** is an **offline-first Business Management ERP** (PWA) with:
- IndexedDB-backed local storage for offline resilience  
- PHP/MySQL backend for server persistence  
- Background sync engine for queue-based reconciliation  
- Glass-morphism dark/light premium UI  

**Target:** Small-to-medium businesses  
**Stack:** Vanilla JS (no framework) · PHP 8.x · MySQL 8.x / MariaDB 10.5+  
**Key Pattern:** Offline-first with sync queue (`sync_queue` IndexedDB store)

---

## 🗂️ Directory Structure

```
BizBrain-Pro/
├── index.html              # Login + App Shell (SPA-style)
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (cache-first for static, network-first for API)
├── database.sql            # Full MySQL schema + seed data
│
├── css/
│   ├── app.css             # Core variables, layout, buttons, modals, toasts, login
│   ├── dashboard.css       # Dashboard-specific styles
│   ├── forms.css           # Form control styles
│   ├── tables.css          # Data table styles
│   └── registration.css    # Registration wizard styles
│
├── js/
│   ├── db.js               # IndexedDB wrapper (promise-based, CRUD, sync queue)
│   ├── api.js              # HTTP fetch wrapper (credentials, offline handling, 401 redirect)
│   ├── auth.js             # Auth module (login, logout, session check, init)
│   ├── sync.js             # Background sync engine
│   ├── router.js           # Hash-based SPA router
│   ├── app.js              # Main app bootstrap
│   └── registration.js     # Registration wizard controller
│
├── pages/
│   ├── dashboard.html      # Main dashboard page template
│   ├── clients.html        # Client management
│   ├── projects.html       # Project management
│   ├── expenses.html       # Expense tracking
│   ├── invoices.html       # Invoice management
│   ├── reports.html        # Reports & analytics
│   └── settings.html       # User/business settings
│
└── php/
    ├── config/
    │   └── app.php         # DB connection, CORS, session config
    └── api/
        └── auth/
            ├── login.php         # POST - authenticate user
            ├── logout.php        # POST - destroy session
            ├── check.php         # GET - verify active session
            ├── check-username.php # POST - check username availability
            ├── check-email.php   # POST - check email availability
            └── register.php      # POST - create business account
```

---

## 🏛️ Architecture Decisions

### 1. Offline-First with IndexedDB
- **Why:** Businesses in areas with unreliable connectivity need uninterrupted access  
- **How:** `db.js` wraps IndexedDB with a promise-based API; all CRUD ops write locally first  
- **Trade-off:** Conflict resolution deferred to sync engine (last-write-wins)

### 2. Sync Queue Pattern
- **Store:** `sync_queue` with `pending`/`synced`/`failed` status  
- **Flow:** Mutations → enqueue → background sync → mark synced  
- **Retry:** 5 attempts with exponential backoff, then marked `failed`

### 3. PHP Backend as JSON API
- **No framework** — lightweight custom router  
- **Responses:** Always `{ success: bool, message: string, data?: any }`  
- **Auth:** PHP sessions + `password_hash`/`password_verify` + PIN hash

### 4. Service Worker Strategy
- **Static assets (css/js/pages):** Cache-first with SWR fallback  
- **PHP API calls:** Network-first, do not cache  
- **Catch-all:** Network-only (no opaque responses)

### 5. Session & Cookie Config
- **SameSite:** `Lax` (was `Strict`, changed to avoid cookie blocking)  
- **Cookie lifetime:** 24h  
- **Path:** `/BizBrain-Pro/php/`  
- **Credentials:** `credentials: 'include'` on all fetch calls

---

## 🎨 Design System

### Core Variables (`css/app.css`)
| Variable | Dark Value | Light Value | Usage |
|----------|-----------|-------------|-------|
| `--bg-base` | `#080b12` | `#f4f6fa` | Page background |
| `--bg-surface` | `#0d1117` | `#ffffff` | Card/surface bg |
| `--bg-card` | `rgba(19,23,32,0.85)` | `rgba(255,255,255,0.95)` | Glass card |
| `--accent` | `#3b82f6` | `#3b82f6` | Primary accent |
| `--accent-2` | `#8b5cf6` | `#8b5cf6` | Secondary accent |
| `--txt-primary` | `#f0f4f8` | `#1a1d24` | Main text |
| `--txt-secondary` | `#8892a4` | `#5a6478` | Subtitle/meta |
| `--txt-muted` | `#4a5568` | `#9ca3af` | Placeholder/hints |

### Theme System
- **Applied via:** `data-theme="dark|light"` on `<html>`  
- **Persistence:** `localStorage.getItem('bizbrain-theme')`  
- **Default:** Dark mode  
- **Toggle:** `.theme-toggle` button in registration; no toggle in main app shell

### Component Inventory
| Component | CSS Source | Notes |
|-----------|-----------|-------|
| Buttons | `app.css` (`.btn`, `.btn-primary`, `.btn-secondary`) | Incl. loading state |
| Cards | `app.css` (`.glass-card`, `.stat-card`) | Glass morphism |
| Forms | `forms.css` + `app.css` (`.form-group`, `.input-wrap`) | Standard inputs |
| Tables | `tables.css` | Responsive data tables |
| Modal | `app.css` | Overlay + glass card |
| Toast | `app.css` (`.toast-container`, `.toast`) | Slide-in notifications |
| Badge | `app.css` (`.badge-*`) | Status indicators |
| Stats Grid | `app.css` (`.stats-grid`, `.stat-card`) | Dashboard metrics |
| Stepper | `registration.css` | 5-step progress wizard |
| Review Cards | `registration.css` | Summary review layout |

---

## 🗄️ Database Schema

### Core Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts | `password_hash`, `pin_hash`, `role`, `status` |
| `clients` | Business clients | Linked to `users` |
| `projects` | Client projects | Linked to `users` + `clients` |
| `expenses` | Expense entries | Linked to `users` + `projects` |
| `invoices` | Invoice records | JSON `items`, tax + totals |
| `settings` | User preferences | KV store per user |

### Registration Tables (added v2)
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `businesses` | Business info | `name`, `type`, `owner_name`, address fields |
| `business_settings` | Config per business | `currency`, `timezone`, `tax_percent` |
| `business_financials` | Opening balances | `cash_in_hand`, `bank_balance`, `avg_monthly_sales` |
| `business_assets` | Asset tracking | `equipment_value`, `furniture_value` |
| `business_inventory` | Inventory snapshot | `product_count`, `inventory_value` |

### Admin Seed
- **Email:** `admin@bizbrain.com`  
- **Password:** `password` (bcrypt hash)  
- **Role:** `admin`

---

## 🔌 API Endpoints

### Auth (`php/api/auth/`)
| Endpoint | Method | Input | Response |
|----------|--------|-------|----------|
| `login.php` | POST | `{email, password}` | `{success, user, message}` |
| `logout.php` | POST | — | `{success, message}` |
| `check.php` | GET | — | `{authenticated, user}` |
| `check-username.php` | POST | `{username}` | `{success, data: {available, message}}` |
| `check-email.php` | POST | `{email}` | `{success, data: {available, message}}` |
| `register.php` | POST | Full registration payload | `{success, user, business_id, message}` |

---

## ⚙️ Key Fixes & Resolutions

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `NotFoundError` on IndexedDB | `DB_VERSION` not bumped when stores added | Bumped `v1`→`v2` |
| Login 500 error | DB had old schema (no `password_hash`) | Re-import `database.sql` |
| Login page blank | Invalid bcrypt hash in seed | Replaced with valid `$2y$10$...` |
| Cookie not sent | `SameSite=Strict` blocking cross-path | Changed to `Lax` |
| False offline detection | SW `startsWith('/php/')` fails with subfolder | Changed to `includes('/php/')` |
| Auth cache stale | `Auth.init()` trusted local session without server check | Added online `check.php` call, clears stale cache |
| 401 silent loop | `DataLayer.fetchOrCache()` didn't handle 401 | Added redirect to login on 401 |
| Missing PHP endpoints | `login.php`, `logout.php`, `check.php` didn't exist | Created with session-based auth |

---

## 🧪 Testing Credentials

- **URL:** `http://localhost/BizBrain-Pro/`  
- **Login:** `admin@bizbrain.com` / `password`  
- **Theme:** Dark (default) / Light (toggle via localStorage)  
- **Registration:** `http://localhost/BizBrain-Pro/pages/registration.html`

---

## 🔮 Future Considerations

- **Role-based access:** Extend `role` enum (`admin`/`user`/`viewer`) with route guards  
- **Sync conflict resolution:** Implement `last-modified` timestamps + merge strategies  
- **Push notifications:** Web push API for invoice alerts  
- **Multi-currency:** Exchange rate API integration  
- **Business units:** Support multiple businesses per user  
- **File uploads:** `file_uploads` table ready for logo/receipt storage  
- **Activity audit:** `activity_logs` table ready for full event logging
