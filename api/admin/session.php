<?php
// Copyright (c) 2026 Carmine Gallina - https://github.com/carminegallina
/**
 * NIWA.PH — GET /api/admin/session.php
 *
 * Verifica se il cookie di sessione è valido.
 *
 * Risposte:
 *   200 { authed:true,  username, display_name }   — sessione valida (cookie rinnovato)
 *   200 { authed:false }                            — nessuna sessione
 *   500 { authed:false, error:"server_error" }
 */

declare(strict_types=1);

require_once __DIR__ . '/../_db.php';
require_once __DIR__ . '/_session.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    niwa_json(405, ['authed' => false, 'error' => 'method_not_allowed']);
}

try {
    $u = niwa_session_validate();
    if ($u === null) {
        niwa_json(200, ['authed' => false]);
    }
    niwa_json(200, [
        'authed'       => true,
        'username'     => $u['username'],
        'display_name' => $u['display_name'],
    ]);
} catch (Throwable $e) {
    niwa_json(500, ['authed' => false, 'error' => 'server_error']);
}
