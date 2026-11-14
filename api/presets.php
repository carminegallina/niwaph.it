<?php
// Copyright (c) 2026 Carmine Gallina - https://github.com/carminegallina
/**
 * NIWA.PH — GET /api/presets.php
 *
 * Restituisce tutti i preset attivi con i valori dei look e le label IT/EN.
 *
 * Risposta:
 *   200 {
 *     none: { label:{it,en}, exposure, contrast, saturation, warmth, grain, vignette, fade },
 *     niwa: { ... },
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
        SELECT p.id_preset, p.slug,
               p.exposure, p.contrast, p.saturation, p.warmth,
               p.grain, p.vignette, p.fade, p.sort_order,
               pt.lang, pt.label
          FROM preset p
          LEFT JOIN preset_translation pt ON pt.id_preset = p.id_preset
         WHERE p.is_active = 1
         ORDER BY p.sort_order ASC, p.id_preset ASC
    ";
    $rows = niwa_db()->query($sql)->fetchAll();

    $out = [];
    $order = [];
    foreach ($rows as $r) {
        $slug = $r['slug'];
        if (!isset($out[$slug])) {
            $out[$slug] = [
                'label'      => ['it' => '', 'en' => ''],
                'exposure'   => (int)$r['exposure'],
                'contrast'   => (int)$r['contrast'],
                'saturation' => (int)$r['saturation'],
                'warmth'     => (int)$r['warmth'],
                'grain'      => (int)$r['grain'],
                'vignette'   => (int)$r['vignette'],
                'fade'       => (int)$r['fade'],
            ];
            $order[] = $slug;
        }
        if ($r['lang'] === 'it' || $r['lang'] === 'en') {
            $out[$slug]['label'][$r['lang']] = $r['label'] ?? $slug;
        }
    }

    niwa_json(200, ['presets' => $out, 'order' => $order]);
} catch (Throwable $e) {
    niwa_json(500, ['error' => 'server_error']);
}
