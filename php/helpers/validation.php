<?php
/**
 * BizBrain — php/helpers/validation.php
 * File upload helpers & constants.
 */

// ── Allowed MIME types ───────────────────────────────────────
define('ALLOWED_IMAGES', ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);
define('ALLOWED_DOCS',   ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                          'text/csv', 'text/plain']);
define('ALLOWED_ALL',    array_merge(ALLOWED_IMAGES, ALLOWED_DOCS, [
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
]));

define('UPLOAD_MAX_SIZE', 10 * 1024 * 1024); // 10 MB

/**
 * Handle a single file upload.
 *
 * @param string $field   The $_FILES field name
 * @param string $subdir  Subdirectory under uploads/ (e.g. 'logos', 'invoices')
 * @param array  $allowedMime  Allowed MIME types
 * @param int    $maxSize      Max file size in bytes
 * @return array ['name' => ..., 'path' => ..., 'mime' => ..., 'size' => ...]
 * @throws RuntimeException
 */
function handleUpload(string $field, string $subdir = 'general', array $allowedMime = ALLOWED_ALL, int $maxSize = UPLOAD_MAX_SIZE): array {
    if (!isset($_FILES[$field]) || $_FILES[$field]['error'] === UPLOAD_ERR_NO_FILE) {
        throw new RuntimeException('No file uploaded');
    }

    $file = $_FILES[$field];

    // Check for upload errors
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $messages = [
            UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload limit',
            UPLOAD_ERR_FORM_SIZE  => 'File exceeds form upload limit',
            UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Server temp directory missing',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
            UPLOAD_ERR_EXTENSION  => 'File upload stopped by extension',
        ];
        throw new RuntimeException($messages[$file['error']] ?? 'Unknown upload error');
    }

    // Validate size
    if ($file['size'] > $maxSize) {
        throw new RuntimeException('File is too large. Maximum size: ' . ($maxSize / 1024 / 1024) . 'MB');
    }

    // Validate MIME type
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime  = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mime, $allowedMime)) {
        throw new RuntimeException('File type not allowed: ' . $mime);
    }

    // Sanitize subdir (only allow safe chars)
    $subdir = preg_replace('/[^a-z0-9_-]/', '', strtolower($subdir));
    if (empty($subdir)) $subdir = 'general';

    // Ensure target directory exists
    $targetDir = __DIR__ . '/../../uploads/' . $subdir;
    if (!is_dir($targetDir)) {
        if (!mkdir($targetDir, 0755, true)) {
            throw new RuntimeException('Failed to create upload directory');
        }
    }

    // Generate safe filename
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $safeName = bin2hex(random_bytes(16)) . '.' . $ext;
    $destPath = $targetDir . '/' . $safeName;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        throw new RuntimeException('Failed to save uploaded file');
    }

    // Relative web path for storage
    $relativePath = 'uploads/' . $subdir . '/' . $safeName;

    return [
        'name' => $file['name'],
        'path' => $relativePath,
        'mime' => $mime,
        'size' => $file['size'],
    ];
}

/**
 * Handle a base64-encoded file upload (for registration wizard logo).
 *
 * @param string $base64Data  Base64 data URL string (e.g. "data:image/png;base64,...")
 * @param string $subdir      Subdirectory under uploads/
 * @param array  $allowedMime Allowed MIME types
 * @return array ['name' => ..., 'path' => ..., 'mime' => ..., 'size' => ...]
 * @throws RuntimeException
 */
function handleBase64Upload(string $base64Data, string $subdir = 'logos', array $allowedMime = ALLOWED_IMAGES): array {
    if (empty($base64Data)) {
        throw new RuntimeException('No image data provided');
    }

    // Extract MIME type and base64 data
    if (!preg_match('/^data:(image\/(\w+));base64,(.+)$/', $base64Data, $matches)) {
        throw new RuntimeException('Invalid image data format');
    }

    $mime      = $matches[1];
    $ext       = $matches[2] === 'jpeg' ? 'jpg' : $matches[2];
    $data      = base64_decode($matches[3], true);

    if ($data === false) {
        throw new RuntimeException('Invalid base64 image data');
    }

    if (!in_array($mime, $allowedMime)) {
        throw new RuntimeException('Image type not allowed: ' . $mime);
    }

    // Max 2MB for base64 uploads (registration logos)
    $maxSize = 2 * 1024 * 1024;
    if (strlen($data) > $maxSize) {
        throw new RuntimeException('Image is too large. Maximum size: 2MB');
    }

    // Sanitize subdir
    $subdir = preg_replace('/[^a-z0-9_-]/', '', strtolower($subdir));
    if (empty($subdir)) $subdir = 'logos';

    $targetDir = __DIR__ . '/../../uploads/' . $subdir;
    if (!is_dir($targetDir)) {
        if (!mkdir($targetDir, 0755, true)) {
            throw new RuntimeException('Failed to create upload directory');
        }
    }

    $safeName = bin2hex(random_bytes(16)) . '.' . $ext;
    $destPath = $targetDir . '/' . $safeName;

    if (file_put_contents($destPath, $data) === false) {
        throw new RuntimeException('Failed to save image file');
    }

    $relativePath = 'uploads/' . $subdir . '/' . $safeName;

    return [
        'name' => 'logo.' . $ext,
        'path' => $relativePath,
        'mime' => $mime,
        'size' => strlen($data),
    ];
}

/**
 * Delete an uploaded file by its stored path.
 *
 * @param string $storedPath Relative path from project root (e.g. "uploads/logos/abc123.jpg")
 * @return bool True if file was deleted or didn't exist
 */
function deleteUpload(string $storedPath): bool {
    $fullPath = __DIR__ . '/../../' . ltrim($storedPath, '/');
    if (file_exists($fullPath)) {
        return unlink($fullPath);
    }
    return true; // File already gone
}
