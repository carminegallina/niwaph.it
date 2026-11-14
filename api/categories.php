<?php
// Copyright (c) 2026 Carmine Gallina - https://github.com/carminegallina
/**
 * NIWA.PH — GET /api/categories.php
 *
 * Restituisce le categorie attive con le traduzioni IT/EN.
 *
 * Risposta:
 *   200 {
 *     weddings: { it: "...", en: "..." },
 *     nature:   { it: "...", en: "..." },
 *     ...
 *   }
 */

declare(strict_types=1);

require_once __DIR__ . '/_db.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    niwa_json(405, ['error' => 'method_not_allowed']);
}

try {
    $sql = "
        SELECT c.id_category, c.slug, ct.lang, ct.name
          FROM category c
          LEFT JOIN category_translation ct ON ct.id_category = c.id_category
         WHERE c.is_active = 1
         ORDER BY c.sort_order ASC, c.id_category ASC
    ";
    $rows = niwa_db()->query($sql)->fetchAll();

    $out = [];
    foreach ($rows as $r) {
        $slug = $r['slug'];
        if (!isset($out[$slug])) {
            $out[$slug] = ['it' => '', 'en' => ''];
        }
        if ($r['lang'] === 'it' || $r['lang'] === 'en') {
            $out[$slug][$r['lang']] = $r['name'] ?? '';
        }
    }

    niwa_json(200, $out);
} catch (Throwable $e) {
    niwa_json(500, ['error' => 'server_error']);
}
