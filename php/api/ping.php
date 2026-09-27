<?php
/**
 * BizBrain — ping.php
 * Minimal server health-check endpoint.
 * No database query, no session dependency — just a fast pong.
 * Used by the Connection Manager to verify backend availability.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Access-Control-Allow-Origin: *');

// ── Pong ──────────────────────────────────────────────────────────
echo json_encode([
    'status' => 'online',
    'time'   => date('c'),          // ISO 8601, e.g. 2026-07-24T10:41:31+05:00
]);