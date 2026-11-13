<?php
/**
 * NIWA.PH — POST /api/admin/logout.php
 *
 * Distrugge la sessione corrente lato server e rimuove il cookie.
 *
 * Risposta:
 *   200 { ok:true }
 */

declare(strict_types=1);

require_once __DIR__ . '/../_db.php';
require_once __DIR__ . '/_session.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    niwa_json(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

try {
    niwa_session_destroy_current();
    niwa_json(200, ['ok' => true]);
} catch (Throwable $e) {
    // Anche in caso di errore, lato client la sessione va trattata come chiusa.
    niwa_session_clear_cookie();
    niwa_json(200, ['ok' => true]);
}
