<?php
/**
 * NIWA.PH — /api/admin/site_text.php
 *
 * Gestisce gli override testuali del sito (sostituisce niwa.copy.v1).
 *
 * GET    elenco override esistenti (key_path → {it,en})
 * PUT    upsert di una chiave   ?key=<key_path>
 *           body: { it?: string, en?: string }
 * DELETE rimuove un override    ?key=<key_path>&lang=<it|en>   (lang opzionale: omesso → entrambe)
 *
 * Le key_path seguono il formato "home.blurb", "about.bio_1", ecc.
 */

declare(strict_types=1);

require_once __DIR__ . '/../_helpers.php';

niwa_require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($method) {
    case 'GET':    txt_list(); break;
    case 'PUT':    txt_upsert(); break;
    case 'DELETE': txt_delete(); break;
    default:
        niwa_json(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

function txt_list(): void
{
    try {
        $rows = niwa_db()->query("SELECT key_path, lang, value FROM site_text")->fetchAll();
        $out = [];
        foreach ($rows as $r) {
            $k = $r['key_path'];
            if (!isset($out[$k])) $out[$k] = [];
            if ($r['lang'] === 'it' || $r['lang'] === 'en') {
                $out[$k][$r['lang']] = $r['value'] ?? '';
            }
        }
        niwa_json(200, $out);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function txt_upsert(): void
{
    $key = niwa_str($_GET, 'key');
    if (!$key || !preg_match('/^[a-z0-9_]+(\.[a-z0-9_]+){1,5}$/i', $key) || strlen($key) > 120) {
        niwa_json(400, ['ok' => false, 'error' => 'bad_request']);
    }

    $body = niwa_read_json_body();
    $hasIt = array_key_exists('it', $body);
    $hasEn = array_key_exists('en', $body);
    if (!$hasIt && !$hasEn) {
        niwa_json(400, ['ok' => false, 'error' => 'bad_request']);
    }

    try {
        $pdo = niwa_db();
        $sql = "INSERT INTO site_text (key_path, lang, value)
                VALUES (:k, :l, :v)
                ON DUPLICATE KEY UPDATE value = VALUES(value)";
        $st = $pdo->prepare($sql);
        if ($hasIt) {
            $st->execute([':k' => $key, ':l' => 'it', ':v' => (string)$body['it']]);
        }
        if ($hasEn) {
            $st->execute([':k' => $key, ':l' => 'en', ':v' => (string)$body['en']]);
        }
        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function txt_delete(): void
{
    $key = niwa_str($_GET, 'key');
    if (!$key) niwa_json(400, ['ok' => false, 'error' => 'bad_request']);
    $lang = niwa_str($_GET, 'lang');

    try {
        if ($lang === 'it' || $lang === 'en') {
            niwa_db()->prepare("DELETE FROM site_text WHERE key_path = :k AND lang = :l")
                     ->execute([':k' => $key, ':l' => $lang]);
        } else {
            niwa_db()->prepare("DELETE FROM site_text WHERE key_path = :k")
                     ->execute([':k' => $key]);
        }
        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}
