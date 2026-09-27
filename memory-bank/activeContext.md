# Active Context

## Current Focus — Purchase Invoice "Items" Section (just completed)
The Purchase Invoice → New/Edit modal → **Purchase Items** section was reviewed and enhanced.
Scope was LIMITED to that section; no other page/module was touched.

### Where the code lives
- Markup: `pages/purchase_invoices.html` — `div.inv-section.pi-items-section` (table
  `#pi-products-table`, empty state `#pi-empty-state`, totals `#pi-items-totals`, hidden barcode
  input `#pi-barcode-input`, camera scanner `#pi-camera-scanner`).
- Logic: `js/app.js` — `PI` state + `emptyPiProduct()`, `addPiProductRow()`,
  `renderPiProductRows()`, `piProdSearch()`, `selectPiProduct()`, `piUpdateBarcode()`,
  `handlePiBarcodeKey()`, `openPiBarcodeScanner()`/`closePiBarcodeScanner()`,
  `removePiProductRow()`, `piUpdateLine()`, `getPiTotals()`, `updatePiItemsTotals()`,
  `calcPiTotals()`, `openPurchaseInvoiceModal()`/`closePiModal()`.
- Styles: `css/dashboard.css` — `.pi-items-*` rules. This file has overlapping responsive blocks;
  desktop/tablet "table" wins via cascade from ~line 865, mobile "cards" from ~line 791. A
  consolidated polish block was APPENDED at EOF.

### Responsive behaviour (intended, now enforced)
- Desktop (>768px): full ERP table, vertical scroll inside the modal.
- Tablet (769–1100px): compact table + controlled horizontal scroll.
- Mobile (<=768px): touch-friendly product CARDS (44px delete), totals collapse to 2 columns,
  barcode scanner becomes a full-screen overlay.

### Changes made this session
1. `renderPiProductRows()`: added `aria-label`s to every input/select/button in the row template.
2. `openPiBarcodeScanner()`/`closePiBarcodeScanner()`: use an `.open` class (not inline
   `style.display`), more robust detector loop, clearer fallback toast.
3. `closePiModal()`: releases the camera stream if the scanner was left open.
4. `pages/purchase_invoices.html`: scanner div got `role="dialog" aria-modal="true"
   aria-label="Barcode scanner"`; Cancel button wrapped in `.pi-camera-actions`.
5. `css/dashboard.css` (appended at EOF): scoped `.pi-items-section` polish — input min-height,
   taller product dropdown, `scrollbar-gutter`, tablet wrap height, mobile touch targets,
   mobile full-screen centred scanner.

### Notes / constraints
- Currency uses the global `Fmt.currency` (USD `$`). Keep consistent; do NOT introduce a local
  PKR/Rs formatter (would diverge from the invoice summary + rest of the app).
- Camera barcode scanning uses the native `BarcodeDetector` API (Chrome/Edge, Android). iOS Safari
  / Firefox fall back to the USB/Bluetooth (keyboard) path with a toast. No third-party barcode
  library is used (keeps the offline-first / no-CDN-js dependency philosophy).
- `css/dashboard.css` has a few pre-existing stray braces (messy file). Browsers ignore stray `}`;
  appended rules still apply. Do NOT attempt a broad cleanup (risk to other pages).

---

## Latest — New Purchase Invoice LAYOUT & RESPONSIVE REPAIR (completed after breakage)
The routed New-Purchase-Invoice page (`#pi-fullscreen-modal` + `pi-create-mode` / `pi-reference-mode`)
had a broken layout after several rounds of conflicting CSS. Repaired WITHOUT adding features or touching
routing/db/auth/other pages. Changes:
1. `js/app.js openPurchaseInvoiceModal`: always `document.body.style.overflow = ''` — the invoice is
   rendered inline (`pi-create-mode`), so the page must always scroll vertically. (Previously it locked
   `overflow:hidden` unless the URL ended in `/create`, which broke scroll when opened from the list page.)
2. `css/dashboard.css` (appended, scoped to `#pi-fullscreen-modal` so Sales Invoice is untouched):
   - natural scroll: `.fs-modal` max-height:none; `.fs-modal-body` overflow:visible; overlay scrolls.
   - meta cards: replaced fixed `height:340px` (which clipped Supplier/Other cards) with
     `height:auto; min-height:340px` + `align-items:stretch` (equal-height cards, Supplier info
     + address now visible).
   - empty state: `.pi-empty-state[hidden]{display:none!important}` so it hides when a row exists
     (`.pi-empty-state{display:flex}` was overriding the `hidden` attribute).
   - product table: `min-width:1040px; table-layout:fixed`, practical column widths
     (#34/Product220/Barcode130/Qty70/Unit90/Price120/Disc110/Tax110/Amount120/Action56), 38px inputs,
     8px cell padding, `overflow-x:auto` (no more squeezed fields; horizontal scroll fallback).
   - workspace grid: items left, summary right (grid-column:2, row 2/span2); payment below items.
   - responsive: desktop 1200+ (2-col), tablet 769–1199 (meta 2-col, lower stacks, table scrolls),
     mobile <=768 (everything stacks, product table->cards, summary below items, 44px touch targets).
   - widened create-mode page to 1440px so the item table fits on large desktops.

## Previous Focus — Supplier Profile Module Enhancement (completed earlier)
- `pages/supplier-profile.html`: complete redesign with premium SaaS supplier profile view.
- `css/modules.css`: premium supplier profile styles.
- `js/modules.js`: full supplier profile functionality with proper URL handling.
- URL fix: `openModule(type, id, fromRoute)` — `fromRoute=true` skips push (router already set it);
  `fromRoute=false` pushes `/BizBrain-Pro/suppliers/{id}` via `pushState` (not
  `Router.navigateToUrl`, which caused a re-entry loop). HTML stays in `supplier-profile.html`;
  JS only manages state/data.
