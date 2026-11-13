<?php
/**
 * NIWA.PH — GET /api/site_text.php
 *
 * Restituisce tutti gli override testuali del sito che sostituiscono
 * i valori default in NIWA_I18N (gestiti dall'admin).
 *
 * Risposta:
 *   200 {
 *     "home.blurb":   { it: "...", en: "..." },
 *     "about.bio_1":  { it: "...", en: "..." },
 *     ...
 *   }
 */

declare(strict_types=1);

require_once __DIR__ . '/_db.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    niwa_json(405, ['error' => 'method_not_allowed']);
}

try {
    $sql = "SELECT key_path, lang, value FROM site_text";
    $rows = niwa_db()->query($sql)->fetchAll();

    $out = [];
    foreach ($rows as $r) {
        $k = $r['key_path'];
        if (!isset($out[$k])) {
            $out[$k] = [];
        }
        if ($r['lang'] === 'it' || $r['lang'] === 'en') {
            $out[$k][$r['lang']] = $r['value'] ?? '';
        }
    }

    niwa_json(200, $out);
} catch (Throwable $e) {
    niwa_json(500, ['error' => 'server_error']);
}
