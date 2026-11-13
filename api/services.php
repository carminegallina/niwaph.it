<?php
/**
 * NIWA.PH — GET /api/services.php
 *
 * Restituisce i servizi attivi (lista "cosa fa Carmine" nella About).
 * Ordinati per sort_order, poi id.
 *
 * Risposta:
 *   200 [
 *     { id: 1, name: {it, en} }, ...
 *   ]
 */

declare(strict_types=1);

require_once __DIR__ . '/_db.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    niwa_json(405, ['error' => 'method_not_allowed']);
}

try {
    $sql = "
        SELECT s.id_service, st.lang, st.name
          FROM service s
          LEFT JOIN service_translation st ON st.id_service = s.id_service
         WHERE s.is_active = 1
         ORDER BY s.sort_order ASC, s.id_service ASC
    ";
    $rows = niwa_db()->query($sql)->fetchAll();

    $byId = [];
    foreach ($rows as $r) {
        $id = (int)$r['id_service'];
        if (!isset($byId[$id])) {
            $byId[$id] = ['id' => $id, 'name' => ['it' => '', 'en' => '']];
        }
        if ($r['lang'] === 'it' || $r['lang'] === 'en') {
            $byId[$id]['name'][$r['lang']] = $r['name'] ?? '';
        }
    }

    niwa_json(200, array_values($byId));
} catch (Throwable $e) {
    niwa_json(500, ['error' => 'server_error']);
}
