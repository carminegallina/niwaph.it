<?php
// Copyright (c) 2026 Carmine Gallina - https://github.com/carminegallina
/**
 * NIWA.PH — GET /api/subjects.php
 *
 * Restituisce la lista di tipi di progetto (per il select del form contatti).
 *
 * Risposta:
 *   200 [ { id, label: {it, en} }, ... ]
 */

declare(strict_types=1);

require_once __DIR__ . '/_db.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    niwa_json(405, ['error' => 'method_not_allowed']);
}

try {
    $sql = "
        SELECT s.id_subject, st.lang, st.label
          FROM subject s
          LEFT JOIN subject_translation st ON st.id_subject = s.id_subject
         WHERE s.is_active = 1
         ORDER BY s.sort_order ASC, s.id_subject ASC
    ";
    $rows = niwa_db()->query($sql)->fetchAll();
    $byId = [];
    foreach ($rows as $r) {
        $id = (int)$r['id_subject'];
        if (!isset($byId[$id])) {
            $byId[$id] = ['id' => $id, 'label' => ['it' => '', 'en' => '']];
        }
        if ($r['lang'] === 'it' || $r['lang'] === 'en') {
            $byId[$id]['label'][$r['lang']] = $r['label'] ?? '';
        }
    }
    niwa_json(200, array_values($byId));
} catch (Throwable $e) {
    niwa_json(500, ['error' => 'server_error']);
}
