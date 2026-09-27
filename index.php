<?php
/**
 * BizBrain ERP — SPA Entry Point
 * 
 * This PHP file serves as the entry point for all SPA routes.
 * Apache .htaccess rewrites all non-file/non-directory requests here.
 * It simply serves index.html, letting the SPA router handle the rest.
 */

// Serve the main SPA shell with the deployment directory as the document base.
$basePath = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
$shell = file_get_contents(__DIR__ . '/index.html');
echo str_replace('__APP_BASE_PATH__', htmlspecialchars($basePath . '/', ENT_QUOTES, 'UTF-8'), $shell);
