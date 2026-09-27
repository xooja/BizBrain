/* ══════════════════════════════════════════════════════════════
   MODULES.CSS — Module Panel System (Shopify-style 2-Panel)
   BizBrain ERP
   ══════════════════════════════════════════════════════════════ */

/* ── Overlay ────────────────────────────────────────────────── */
.module-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: var(--bg-base, #080b12);
  display: none;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.module-overlay.open {
  display: flex;
  opacity: 1;
}

/* ── Sheet (full viewport) ──────────────────────────────────── */
.module-sheet {
  position: relative;
  width: 100%;
  height: 100vh;
  background: var(--bg-base, #080b12);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Header ─────────────────────────────────────────────────── */
.module-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
  flex-shrink: 0;
  min-height: 52px;
  background: var(--bg-surface, #0d1117);
}
.module-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.module-back-btn {
  background: none;
  border: none;
  color: var(--txt-secondary, #8892a4);
  font-size: 14px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: var(--radius-sm, 6px);
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s, color 0.15s;
  font-family: var(--font-body);
}
.module-back-btn:hover {
  background: var(--bg-glass-hov, rgba(255,255,255,0.07));
  color: var(--txt-primary, #f0f4f8);
}
.module-back-btn i {
  font-size: 14px;
}
.module-title {
  font-family: var(--font-head, 'Syne', sans-serif);
  font-size: 16px;
  font-weight: 700;
  color: var(--txt-primary, #f0f4f8);
  margin: 0;
}

/* ── Body (2-panel layout) ──────────────────────────────────── */
.module-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ══════════════════════════════════════════════════════════════
   LEFT SIDEBAR — Supplier List
   ══════════════════════════════════════════════════════════════ */
.module-list-panel {
  width: 320px;
  min-width: 320px;
  flex-shrink: 0;
  border-right: 1px solid var(--border, rgba(255,255,255,0.07));
  display: flex;
  flex-direction: column;
  background: var(--bg-surface, #0d1117);
}

/* ── Search Bar ─────────────────────────────────────────────── */
.module-list-search {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
  flex-shrink: 0;
}
.module-list-search .input-wrap {
  width: 100%;
}
.module-list-search input {
  width: 100%;
  padding: 9px 12px 9px 34px;
  background: var(--bg-elevated, #131720);
  border: 1px solid var(--border, rgba(255,255,255,0.07));
  border-radius: var(--radius-sm, 6px);
  color: var(--txt-primary, #f0f4f8);
  font-size: 13px;
  font-family: var(--font-body);
  outline: none;
  transition: border-color 0.2s;
}
.module-list-search input:focus {
  border-color: var(--accent, #3b82f6);
}
.module-list-search input::placeholder {
  color: var(--txt-muted, #4a5568);
}

/* ── Supplier List Count ────────────────────────────────────── */
.module-list-count {
  padding: 8px 16px;
  font-size: 11px;
  font-weight: 600;
  color: var(--txt-muted, #4a5568);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
  flex-shrink: 0;
}

/* ── Supplier Cards Container ───────────────────────────────── */
.module-list-items {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

/* ── Supplier Card in List ──────────────────────────────────── */
.supplier-list-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-md, 12px);
  cursor: pointer;
  transition: background 0.15s;
  border: 1px solid transparent;
  margin-bottom: 4px;
}
.supplier-list-card:hover {
  background: var(--bg-glass-hov, rgba(255,255,255,0.05));
}
.supplier-list-card.active {
  background: var(--bg-glass, rgba(255,255,255,0.04));
  border-color: var(--accent, #3b82f6);
}
.supplier-list-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.supplier-list-info {
  flex: 1;
  min-width: 0;
}
.supplier-list-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--txt-primary, #f0f4f8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.supplier-list-company {
  font-size: 11px;
  color: var(--txt-muted, #4a5568);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}
.supplier-list-meta {
  text-align: right;
  flex-shrink: 0;
}
.supplier-list-balance {
  font-size: 13px;
  font-weight: 700;
  color: var(--txt-primary, #f0f4f8);
}
.supplier-list-balance.negative {
  color: var(--danger, #ef4444);
}
.supplier-list-status {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 4px;
}
.supplier-list-status.active {
  background: var(--success, #10b981);
}
.supplier-list-status.inactive {
  background: var(--txt-muted, #4a5568);
}

/* ── Empty state ────────────────────────────────────────────── */
.module-list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}
.module-list-empty i {
  font-size: 36px;
  color: var(--txt-muted, #4a5568);
  opacity: 0.3;
  margin-bottom: 12px;
}
.module-list-empty p {
  font-size: 13px;
  color: var(--txt-muted, #4a5568);
}

/* ══════════════════════════════════════════════════════════════
   RIGHT MAIN PANEL — Supplier Profile Dashboard
   ══════════════════════════════════════════════════════════════ */
.module-main-panel {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
  background: var(--bg-base, #080b12);
}
.module-main-inner {
  max-width: 1100px;
  margin: 0 auto;
}

/* ── Supplier Header ────────────────────────────────────────── */
.sp-header {
  margin-bottom: 24px;
}
.sp-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}
.sp-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.sp-avatar-wrap {
  position: relative;
}
.sp-avatar.avatar {
  width: 64px;
  height: 64px;
  font-size: 24px;
  border-radius: 16px;
  flex-shrink: 0;
}
.sp-avatar-status {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--bg-base, #080b12);
}
.sp-avatar-status.active {
  background: var(--success, #10b981);
}
.sp-avatar-status.inactive {
  background: var(--txt-muted, #4a5568);
}
.sp-header-info h2 {
  font-family: var(--font-head, 'Syne', sans-serif);
  font-size: 24px;
  font-weight: 700;
  color: var(--txt-primary, #f0f4f8);
  margin: 0;
  line-height: 1.2;
}
.sp-header-info .sp-company {
  font-size: 14px;
  color: var(--txt-secondary, #8892a4);
  margin-top: 2px;
}
.sp-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ── More actions ───────────────────────────────────────────── */
.sp-more-wrap {
  position: relative;
}
.sp-more-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 100;
  min-width: 220px;
  background: var(--bg-elevated, #131720);
  border: 1px solid var(--border, rgba(255,255,255,0.07));
  border-radius: var(--radius-md, 12px);
  box-shadow: var(--shadow-md, 0 8px 32px rgba(0,0,0,0.5));
  padding: 6px;
  display: none;
  margin-top: 4px;
}
.sp-more-menu.open {
  display: block;
}
.sp-more-menu .sp-more-header {
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--txt-muted, #4a5568);
}
.sp-more-menu button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: none;
  color: var(--txt-secondary, #8892a4);
  font-size: 13px;
  cursor: pointer;
  border-radius: var(--radius-sm, 6px);
  transition: background 0.15s, color 0.15s;
  font-family: var(--font-body);
}
.sp-more-menu button:hover {
  background: var(--bg-glass-hov, rgba(255,255,255,0.07));
  color: var(--txt-primary, #f0f4f8);
}
.sp-more-menu button.danger {
  color: var(--danger, #ef4444);
}
.sp-more-menu button.danger:hover {
  background: rgba(239, 68, 68, 0.1);
}
.sp-more-divider {
  height: 1px;
  background: var(--border, rgba(255,255,255,0.07));
  margin: 4px 0;
}

/* ── Header Meta ────────────────────────────────────────────── */
.sp-header-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 8px;
}
.sp-meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--txt-secondary, #8892a4);
}
.sp-meta-item i {
  width: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--txt-muted, #4a5568);
}

/* ── Dashboard-style Stat Cards ─────────────────────────────── */
.sp-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
  margin-bottom: 24px;
}
.sp-stat-card {
  padding: 18px;
  background: var(--bg-card, rgba(19, 23, 32, 0.85));
  border: 1px solid var(--border, rgba(255,255,255,0.07));
  border-radius: var(--radius-lg, 18px);
  transition: border-color 0.2s, transform 0.2s;
}
.sp-stat-card:hover {
  border-color: rgba(255,255,255,0.12);
  transform: translateY(-2px);
}
.sp-stat-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  font-size: 15px;
}
.sp-stat-icon.blue    { background: rgba(59,130,246,0.15); color: #3b82f6; }
.sp-stat-icon.green   { background: rgba(16,185,129,0.15); color: #10b981; }
.sp-stat-icon.purple  { background: rgba(139,92,246,0.15); color: #8b5cf6; }
.sp-stat-icon.red     { background: rgba(239,68,68,0.15);  color: #ef4444; }
.sp-stat-icon.orange  { background: rgba(245,158,11,0.15); color: #f59e0b; }
.sp-stat-value {
  font-size: 22px;
  font-weight: 800;
  color: var(--txt-primary, #f0f4f8);
  margin-bottom: 2px;
}
.sp-stat-label {
  font-size: 11px;
  color: var(--txt-muted, #4a5568);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

/* ── Tab Navigation ─────────────────────────────────────────── */
.sp-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
  margin-bottom: 20px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.sp-tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--txt-secondary, #8892a4);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  font-family: var(--font-body);
}
.sp-tab-btn:hover {
  color: var(--txt-primary, #f0f4f8);
  background: var(--bg-glass, rgba(255,255,255,0.04));
}
.sp-tab-btn.active {
  color: var(--accent, #3b82f6);
  border-bottom-color: var(--accent, #3b82f6);
  background: rgba(59,130,246,0.06);
}
.sp-tab-btn i {
  font-size: 13px;
  opacity: 0.7;
}
.sp-tab-btn.active i {
  opacity: 1;
}

/* ── Tab Content ────────────────────────────────────────────── */
.sp-tab-content {
  animation: moduleFadeIn 0.25s ease;
}
@keyframes moduleFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Overview Grid ──────────────────────────────────────────── */
.sp-overview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.sp-section-card {
  background: var(--bg-card, rgba(19, 23, 32, 0.85));
  border: 1px solid var(--border, rgba(255,255,255,0.07));
  border-radius: var(--radius-lg, 18px);
  padding: 18px;
}
.sp-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--txt-secondary, #8892a4);
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sp-section-title i {
  color: var(--accent, #3b82f6);
  font-size: 14px;
}
.sp-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}
.sp-info-item {
  padding: 7px 0;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
}
.sp-info-full {
  grid-column: 1 / -1;
}
.sp-info-label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: var(--txt-muted, #4a5568);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 2px;
}
.sp-info-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--txt-primary, #f0f4f8);
}

/* ── Tab Toolbar ────────────────────────────────────────────── */
.sp-tab-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.sp-tab-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--txt-muted, #4a5568);
}
.sp-date-input {
  background: var(--bg-elevated, #131720);
  border: 1px solid var(--border, rgba(255,255,255,0.07));
  border-radius: var(--radius-sm, 6px);
  padding: 7px 10px;
  color: var(--txt-primary, #f0f4f8);
  font-size: 12px;
  font-family: var(--font-body);
}

/* ── Tables ─────────────────────────────────────────────────── */
.sp-table-wrap {
  overflow-x: auto;
}
.sp-table.data-table {
  font-size: 12px;
  min-width: 550px;
}
.sp-table.data-table th {
  font-size: 11px;
  padding: 10px 12px;
}
.sp-table.data-table td {
  padding: 10px 12px;
}

/* ── Empty State ────────────────────────────────────────────── */
.sp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  color: var(--txt-muted, #4a5568);
  text-align: center;
}
.sp-empty i {
  font-size: 28px;
  margin-bottom: 8px;
  opacity: 0.3;
}
.sp-empty p {
  font-size: 13px;
}

/* ── Documents ──────────────────────────────────────────────── */
.sp-docs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.sp-drop-zone {
  border: 2px dashed var(--border, rgba(255,255,255,0.07));
  border-radius: var(--radius-md, 12px);
  padding: 28px 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.sp-drop-zone:hover,
.sp-drop-zone.drag-over {
  border-color: var(--accent, #3b82f6);
  background: rgba(59,130,246,0.05);
}
.sp-drop-icon {
  font-size: 32px;
  color: var(--accent, #3b82f6);
  opacity: 0.6;
  margin-bottom: 8px;
}
.sp-drop-text {
  font-size: 14px;
  color: var(--txt-secondary, #8892a4);
  margin-bottom: 4px;
}
.sp-drop-hint {
  font-size: 11px;
  color: var(--txt-muted, #4a5568);
}

/* ── Timeline ───────────────────────────────────────────────── */
.sp-timeline {
  position: relative;
  padding-left: 24px;
}
.sp-timeline::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--border, rgba(255,255,255,0.07));
}
.sp-timeline-item {
  position: relative;
  padding: 0 0 20px 20px;
}
.sp-timeline-item:last-child {
  padding-bottom: 0;
}
.sp-timeline-icon {
  position: absolute;
  left: -20px;
  top: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent, #3b82f6);
  border: 2px solid var(--bg-base, #080b12);
  z-index: 1;
}
.sp-timeline-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--txt-primary, #f0f4f8);
}
.sp-timeline-desc {
  font-size: 12px;
  color: var(--txt-secondary, #8892a4);
  margin-top: 2px;
}
.sp-timeline-time {
  font-size: 11px;
  color: var(--txt-muted, #4a5568);
  margin-top: 2px;
}

/* ── Settings Form ──────────────────────────────────────────── */
.sp-settings-form {
  max-width: 700px;
}
.sp-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.sp-form-full {
  grid-column: 1 / -1;
}
.sp-settings-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

/* ── Loading State ──────────────────────────────────────────── */
.module-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* ── Responsive ─────────────────────────────────────────────── */
@media (max-width: 900px) {
  .module-list-panel {
    width: 260px;
    min-width: 260px;
  }
  .sp-stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .sp-overview-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .module-body {
    flex-direction: column;
  }
  .module-list-panel {
    width: 100%;
    min-width: 100%;
    max-height: 45vh;
    border-right: none;
    border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
  }
  .module-main-panel {
    padding: 16px;
  }
  .sp-stats-grid {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .sp-header-top {
    flex-direction: column;
    align-items: flex-start;
  }
  .sp-header-actions {
    width: 100%;
  }
  .sp-docs-grid {
    grid-template-columns: 1fr;
  }
  .sp-form-grid {
    grid-template-columns: 1fr;
  }
  .sp-info-grid {
    grid-template-columns: 1fr;
  }
}

/* ── Scrollbar ──────────────────────────────────────────────── */
.module-list-items::-webkit-scrollbar,
.module-main-panel::-webkit-scrollbar {
  width: 4px;
}
.module-list-items::-webkit-scrollbar-thumb,
.module-main-panel::-webkit-scrollbar-thumb {
  background: var(--border, rgba(255,255,255,0.07));
  border-radius: 2px;
}
.module-list-items::-webkit-scrollbar-track,
.module-main-panel::-webkit-scrollbar-track {
  background: transparent;
}
