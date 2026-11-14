<?php
// Copyright (c) 2026 Carmine Gallina - https://github.com/carminegallina
/**
 * NIWA.PH — GET /api/events.php
 *
 * Restituisce gli eventi attivi (timeline About) con traduzioni IT/EN.
 * Ordinati dal più recente (date_from DESC).
 *
 * Risposta:
 *   200 [
 *     {
 *       id: 1,
 *       date_from: "2024-06-15",
 *       date_to: "2024-06-17",     // null se singolo giorno
 *       title: {it, en},
 *       description: {it, en},
 *       tag: {it, en}
 *     }, ...
 *   ]
 */

declare(strict_types=1);

require_once __DIR__ . '/_db.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    niwa_json(405, ['error' => 'method_not_allowed']);
}

try {
    $sql = "
        SELECT e.id_event, e.date_from, e.date_to, e.sort_order,
               et.lang, et.title, et.description, et.tag
          FROM event e
          LEFT JOIN event_translation et ON et.id_event = e.id_event
         WHERE e.is_active = 1
         ORDER BY e.date_from DESC, e.sort_order ASC, e.id_event DESC
    ";
    $rows = niwa_db()->query($sql)->fetchAll();

    $byId = [];
    foreach ($rows as $r) {
        $id = (int)$r['id_event'];
        if (!isset($byId[$id])) {
            $byId[$id] = [
                'id'          => $id,
                'date_from'   => $r['date_from'],
                'date_to'     => $r['date_to'],
                'title'       => ['it' => '', 'en' => ''],
                'description' => ['it' => '', 'en' => ''],
                'tag'         => ['it' => '', 'en' => ''],
            ];
        }
        if ($r['lang'] === 'it' || $r['lang'] === 'en') {
            $byId[$id]['title'][$r['lang']]       = $r['title']       ?? '';
            $byId[$id]['description'][$r['lang']] = $r['description'] ?? '';
            $byId[$id]['tag'][$r['lang']]         = $r['tag']         ?? '';
        }
    }

    niwa_json(200, array_values($byId));
} catch (Throwable $e) {
    niwa_json(500, ['error' => 'server_error']);
}
