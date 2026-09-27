# BizBrain ERP — Project Brief

## What it is
BizBrain is an offline-first Business Management ERP (Enterprise Resource Planning) system built
with PHP + vanilla JS (SPA) + IndexedDB. It supports full CRUD for clients, projects, expenses,
invoices, reports, products, customers, suppliers and categories, with IndexedDB offline storage
and MySQL backend sync.

## Core Requirements
- Offline-first architecture with IndexedDB
- Multi-step business registration wizard (4 steps + review)
- Authentication with password + 4-digit PIN
- Online/offline sync via a sync queue
- PWA support with service worker caching
- Responsive SaaS-style UI with dark/light mode

## Tech stack
- Frontend: vanilla JS (no framework), Font Awesome icons, Google Charts.
- Styling: plain CSS in `css/` (app.css, dashboard.css, forms.css, tables.css, modules.css,
  registration.css). CSS custom properties define the theme; `data-theme` toggles dark/light.
- Backend: PHP JSON APIs under `php/api/` (auth, products, suppliers, customers, invoices, etc.).
- Database: MySQL (`database.sql`); migration scripts in `php/migrations/`.

## Design rules (project convention)
- Reuse existing components/CSS/helpers FIRST; extend; only create new code when necessary.
- New UI must match the existing BizBrain ERP look (same cards/buttons/forms).
- Frontend pages call backend via `fetch()` (through `js/api.js`) and render JSON.
- Key global helpers: `esc()`, `Fmt.currency()` / `Fmt.date()`, `showToast()`, `DB.*`,
  `API.*`, `Pages.*`.

## Scope note
Latest session was scoped to the **Purchase Invoice — "Purchase Items / Products" section** only.
Do NOT alter sidebar, dashboard, supplier info, invoice details, invoice summary, accounts,
database, routing, or authentication.
