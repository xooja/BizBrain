# System Patterns & Architecture

## Architecture
- **Frontend:** HTML/CSS/JS (vanilla) with IIFE modules
- **Backend:** PHP REST API (JSON responses)
- **Database:** MySQL (server) + IndexedDB (client)
- **Sync:** Offline queue, push when online

## Key Patterns
- **Module Pattern:** Each JS file is an IIFE returning a public API
  - `DB` — IndexedDB wrapper
  - `API` — Backend HTTP calls
  - `Auth` — Authentication + session management
  - `Sync` — Offline/online sync engine
  - `Router` — Client-side SPA routing
  - `App` — Main controller
  - `Registration` — Multi-step wizard controller
- **Offline-First:** All reads from IndexedDB first; writes queue locally then sync
- **Service Worker:** Caches static assets + API responses

## Data Flow
1. User action → JS module → IndexedDB (immediate)
2. If online → PHP API → MySQL (sync)
3. If offline → Sync queue → sync when online

## Registration Flow
Step 1: Account & Security (username, email, password, PIN)
Step 2: Business Information (name, type, owner, logo)
Step 3: Location & Settings (address, currency, timezone, tax)
Step 4: Initialization (financials, assets, inventory)
Step 5: Review & Confirm (summary + terms acceptance)