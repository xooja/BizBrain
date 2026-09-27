<?php
/**
 * BizBrain — php/api/dashboard.php
 * Dashboard summary API with key metrics for all modules.
 */
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../config/database.php';

$user = requireAuth();
$pdo  = getDB();

$uid = $user['id'];

// Product metrics
$totalProducts   = $pdo->prepare('SELECT COUNT(*) FROM products WHERE user_id = ?'); $totalProducts->execute([$uid]); $totalProducts = (int)$totalProducts->fetchColumn();
$activeProducts  = $pdo->prepare("SELECT COUNT(*) FROM products WHERE user_id = ? AND status='active'"); $activeProducts->execute([$uid]); $activeProducts = (int)$activeProducts->fetchColumn();
$lowStockProducts= $pdo->prepare('SELECT COUNT(*) FROM products WHERE user_id = ? AND stock <= min_stock AND status = \'active\''); $lowStockProducts->execute([$uid]); $lowStockProducts = (int)$lowStockProducts->fetchColumn();
$stockValue      = $pdo->prepare('SELECT COALESCE(SUM(purchase_price * stock), 0) FROM products WHERE user_id = ?'); $stockValue->execute([$uid]); $stockValue = (float)$stockValue->fetchColumn();

// Supplier/Customer counts
$totalSuppliers  = $pdo->prepare("SELECT COUNT(*) FROM suppliers WHERE user_id = ? AND status='active'"); $totalSuppliers->execute([$uid]); $totalSuppliers = (int)$totalSuppliers->fetchColumn();
$totalCustomers  = $pdo->prepare("SELECT COUNT(*) FROM customers WHERE user_id = ? AND status='active'"); $totalCustomers->execute([$uid]); $totalCustomers = (int)$totalCustomers->fetchColumn();

// Payables / Receivables
$totalPayables   = $pdo->prepare('SELECT COALESCE(SUM(current_balance), 0) FROM suppliers WHERE user_id = ?'); $totalPayables->execute([$uid]); $totalPayables = (float)$totalPayables->fetchColumn();
$totalReceivables= $pdo->prepare('SELECT COALESCE(SUM(current_balance), 0) FROM customers WHERE user_id = ?'); $totalReceivables->execute([$uid]); $totalReceivables = (float)$totalReceivables->fetchColumn();

// Purchase/Sales totals (current month)
$purchaseTotal   = $pdo->prepare("SELECT COALESCE(SUM(total), 0) FROM purchase_invoices WHERE user_id = ? AND MONTH(date) = MONTH(CURDATE()) AND YEAR(date) = YEAR(CURDATE())"); $purchaseTotal->execute([$uid]); $purchaseTotal = (float)$purchaseTotal->fetchColumn();
$salesTotal      = $pdo->prepare("SELECT COALESCE(SUM(total), 0) FROM sales_invoices WHERE user_id = ? AND MONTH(date) = MONTH(CURDATE()) AND YEAR(date) = YEAR(CURDATE()) AND status != 'cancelled'"); $salesTotal->execute([$uid]); $salesTotal = (float)$salesTotal->fetchColumn();

// Due purchases/sales
$duePurchases    = $pdo->prepare("SELECT COALESCE(SUM(balance), 0) FROM purchase_invoices WHERE user_id = ? AND status IN ('received','partial')"); $duePurchases->execute([$uid]); $duePurchases = (float)$duePurchases->fetchColumn();
$dueSales        = $pdo->prepare("SELECT COALESCE(SUM(balance), 0) FROM sales_invoices WHERE user_id = ? AND status IN ('sent','partial','overdue')"); $dueSales->execute([$uid]); $dueSales = (float)$dueSales->fetchColumn();

// Recent activity
$recentActivity  = $pdo->prepare("SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10"); $recentActivity->execute([$uid]); $recentActivity = $recentActivity->fetchAll();

// Category breakdown
$categoryBreakdown = $pdo->prepare(
    'SELECT c.name, COUNT(p.id) as product_count, COALESCE(SUM(p.stock), 0) as total_stock, COALESCE(SUM(p.purchase_price * p.stock), 0) as stock_value
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.user_id = c.user_id
     WHERE c.user_id = ?
     GROUP BY c.id, c.name
     ORDER BY stock_value DESC'
);
$categoryBreakdown->execute([$uid]); $categoryBreakdown = $categoryBreakdown->fetchAll();

// Team members count
$teamCount = $pdo->prepare("SELECT COUNT(*) FROM team_members WHERE user_id = ? AND status = 'active'"); $teamCount->execute([$uid]); $teamCount = (int)$teamCount->fetchColumn();

// Payment methods breakdown
$paymentMethods = $pdo->prepare(
    "SELECT method, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
     FROM payments WHERE user_id = ? GROUP BY method ORDER BY total_amount DESC"
);
$paymentMethods->execute([$uid]); $paymentMethods = $paymentMethods->fetchAll();

jsonSuccess([
    'products' => [
        'total'     => $totalProducts,
        'active'    => $activeProducts,
        'low_stock' => $lowStockProducts,
        'stock_value' => $stockValue,
    ],
    'parties' => [
        'suppliers'  => $totalSuppliers,
        'customers'  => $totalCustomers,
    ],
    'accounts' => [
        'payables'   => $totalPayables,
        'receivables'=> $totalReceivables,
    ],
    'transactions' => [
        'purchase_total' => $purchaseTotal,
        'sales_total'    => $salesTotal,
        'due_purchases'  => $duePurchases,
        'due_sales'      => $dueSales,
    ],
    'team' => [
        'count' => $teamCount,
    ],
    'categories'     => $categoryBreakdown,
    'payment_methods'=> $paymentMethods,
    'recent_activity'=> $recentActivity,
]);
