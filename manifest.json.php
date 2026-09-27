<?php
/**
 * BizBrain ERP — Dynamic Manifest Generator
 * 
 * Automatically sets the correct start_url and scope based on deployment location.
 * Works in both root (https://example.com/) and subfolder (http://localhost/BizBrain-Pro/).
 */

$basePath = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/manifest.json.php'), '/') . '/';

header('Content-Type: application/manifest+json; charset=utf-8');
header('Cache-Control: max-age=86400');

echo json_encode([
    'name'            => 'BizBrain — Business Manager',
    'short_name'      => 'BizBrain',
    'description'     => 'Offline-first business management: clients, projects, expenses, and invoices.',
    'start_url'       => $basePath,
    'scope'           => $basePath,
    'display'         => 'standalone',
    'orientation'     => 'portrait-primary',
    'theme_color'     => '#0a0d14',
    'background_color'=> '#080b12',
    'lang'            => 'en',
    'categories'      => ['business', 'productivity', 'finance'],

    'icons' => [
        ['src' => 'assets/icon-72.png',   'sizes' => '72x72',  'type' => 'image/png', 'purpose' => 'any'],
        ['src' => 'assets/icon-96.png',   'sizes' => '96x96',  'type' => 'image/png', 'purpose' => 'any'],
        ['src' => 'assets/icon-128.png',  'sizes' => '128x128','type' => 'image/png', 'purpose' => 'any'],
        ['src' => 'assets/icon-192.png',  'sizes' => '192x192','type' => 'image/png', 'purpose' => 'any maskable'],
        ['src' => 'assets/icon-512.png',  'sizes' => '512x512','type' => 'image/png', 'purpose' => 'any maskable'],
    ],

    'screenshots' => [
        ['src' => 'assets/screenshot-desktop.png', 'sizes' => '1280x800', 'type' => 'image/png', 'form_factor' => 'wide',  'label' => 'BizBrain Dashboard'],
        ['src' => 'assets/screenshot-mobile.png',  'sizes' => '390x844',  'type' => 'image/png', 'form_factor' => 'narrow','label' => 'BizBrain Mobile'],
    ],

    'shortcuts' => [
        ['name' => 'New Client',  'short_name' => 'Client',  'description' => 'Add a new client',  'url' => $basePath . '#clients',  'icons' => [['src' => 'assets/icon-96.png', 'sizes' => '96x96']]],
        ['name' => 'New Invoice', 'short_name' => 'Invoice', 'description' => 'Create a new invoice','url' => $basePath . '#invoices', 'icons' => [['src' => 'assets/icon-96.png', 'sizes' => '96x96']]],
        ['name' => 'Add Expense', 'short_name' => 'Expense', 'description' => 'Record an expense',  'url' => $basePath . '#expenses', 'icons' => [['src' => 'assets/icon-96.png', 'sizes' => '96x96']]],
    ],

    'prefer_related_applications' => false,
    'related_applications' => [],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);