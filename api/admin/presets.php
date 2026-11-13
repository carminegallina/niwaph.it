<?php
/**
 * NIWA.PH — /api/admin/presets.php
 *
 * GET    elenco preset (anche disattivati) con valori e label
 * POST   crea preset
 *          body: { slug, label_it, label_en, exposure?, contrast?, ..., fade?, sort_order? }
 * PUT    aggiorna preset  ?slug=<slug>
 *          body: { label_it?, label_en?, exposure?..., is_active?, sort_order? }
 * DELETE elimina preset   ?slug=<slug>
 *
 * Vincoli:
 *   - slug "none" è considerato di sistema e non eliminabile.
 *   - L'eliminazione di un preset usato dai media imposta id_preset = NULL
 *     (FK con ON DELETE SET NULL).
 */

declare(strict_types=1);

require_once __DIR__ . '/../_helpers.php';

niwa_require_admin();

const PRESET_SLIDERS = ['exposure','contrast','saturation','warmth','grain','vignette','fade'];

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($method) {
    case 'GET':    pre_list(); break;
    case 'POST':   pre_create(); break;
    case 'PUT':    pre_update(); break;
    case 'DELETE': pre_delete(); break;
    default:
        niwa_json(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

function pre_list(): void
{
    try {
        $sql = "SELECT p.*, pt.lang, pt.label
                  FROM preset p
                  LEFT JOIN preset_translation pt ON pt.id_preset = p.id_preset
                 ORDER BY p.sort_order ASC, p.id_preset ASC";
        $rows = niwa_db()->query($sql)->fetchAll();
        $out = [];
        foreach ($rows as $r) {
            $slug = $r['slug'];
            if (!isset($out[$slug])) {
                $obj = [
                    'slug'       => $slug,
                    'sort_order' => (int)$r['sort_order'],
                    'is_active'  => (int)$r['is_active'] === 1,
                    'label'      => ['it' => '', 'en' => ''],
                ];
                foreach (PRESET_SLIDERS as $k) {
                    $obj[$k] = (int)$r[$k];
                }
                $out[$slug] = $obj;
            }
            if ($r['lang'] === 'it' || $r['lang'] === 'en') {
                $out[$slug]['label'][$r['lang']] = $r['label'] ?? $slug;
            }
        }
        niwa_json(200, array_values($out));
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function pre_create(): void
{
    $body = niwa_read_json_body();
    $slug = niwa_slugify((string)($body['slug'] ?? ''));
    if ($slug === '') niwa_json(400, ['ok' => false, 'error' => 'invalid_slug']);

    $sort = niwa_int($body, 'sort_order', 0) ?? 0;
    $vals = [];
    foreach (PRESET_SLIDERS as $k) {
        $vals[$k] = niwa_int($body, $k, 0) ?? 0;
        if ($vals[$k] < -100 || $vals[$k] > 100) {
            niwa_json(400, ['ok' => false, 'error' => 'out_of_range']);
        }
    }

    try {
        $pdo = niwa_db();
        $pdo->beginTransaction();

        $st = $pdo->prepare("SELECT id_preset FROM preset WHERE slug = :s LIMIT 1");
        $st->execute([':s' => $slug]);
        if ($st->fetchColumn()) {
            $pdo->rollBack();
            niwa_json(409, ['ok' => false, 'error' => 'slug_exists']);
        }

        $cols = array_merge(['slug'], PRESET_SLIDERS, ['sort_order','is_active']);
        $bind = array_merge([$slug], array_values($vals), [$sort, 1]);
        $place = implode(',', array_fill(0, count($cols), '?'));
        $sql = "INSERT INTO preset (" . implode(',', $cols) . ") VALUES ($place)";
        $pdo->prepare($sql)->execute($bind);
        $idP = (int)$pdo->lastInsertId();

        $stT = $pdo->prepare(
            "INSERT INTO preset_translation (id_preset, lang, label) VALUES (:i, :l, :n)"
        );
        $labIt = niwa_str($body, 'label_it') ?? $slug;
        $labEn = niwa_str($body, 'label_en') ?? $slug;
        $stT->execute([':i' => $idP, ':l' => 'it', ':n' => $labIt]);
        $stT->execute([':i' => $idP, ':l' => 'en', ':n' => $labEn]);

        $pdo->commit();
        niwa_json(201, ['ok' => true, 'slug' => $slug]);
    } catch (Throwable $e) {
        if (niwa_db()->inTransaction()) niwa_db()->rollBack();
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function pre_update(): void
{
    $slug = niwa_str($_GET, 'slug');
    if (!$slug) niwa_json(400, ['ok' => false, 'error' => 'bad_request']);

    $body = niwa_read_json_body();

    try {
        $pdo = niwa_db();
        $st = $pdo->prepare("SELECT id_preset FROM preset WHERE slug = :s LIMIT 1");
        $st->execute([':s' => $slug]);
        $idP = (int)($st->fetchColumn() ?: 0);
        if ($idP <= 0) niwa_json(404, ['ok' => false, 'error' => 'not_found']);

        $pdo->beginTransaction();

        $sets = []; $bind = [':i' => $idP];
        foreach (PRESET_SLIDERS as $k) {
            if (isset($body[$k])) {
                $v = (int)$body[$k];
                if ($v < -100 || $v > 100) {
                    $pdo->rollBack();
                    niwa_json(400, ['ok' => false, 'error' => 'out_of_range']);
                }
                $sets[] = "$k = :_$k"; $bind[":_$k"] = $v;
            }
        }
        if (isset($body['sort_order'])) { $sets[] = "sort_order = :o"; $bind[':o'] = (int)$body['sort_order']; }
        if (isset($body['is_active']))  { $sets[] = "is_active = :a";  $bind[':a'] = (int)(bool)$body['is_active']; }
        if (!empty($sets)) {
            $sql = "UPDATE preset SET " . implode(', ', $sets) . " WHERE id_preset = :i";
            $pdo->prepare($sql)->execute($bind);
        }

        if (isset($body['label_it']) || isset($body['label_en'])) {
            $sql = "INSERT INTO preset_translation (id_preset, lang, label)
                    VALUES (:i, :l, :n)
                    ON DUPLICATE KEY UPDATE label = VALUES(label)";
            $stT = $pdo->prepare($sql);
            if (isset($body['label_it'])) {
                $stT->execute([':i' => $idP, ':l' => 'it', ':n' => (string)$body['label_it']]);
            }
            if (isset($body['label_en'])) {
                $stT->execute([':i' => $idP, ':l' => 'en', ':n' => (string)$body['label_en']]);
            }
        }

        $pdo->commit();
        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        if (niwa_db()->inTransaction()) niwa_db()->rollBack();
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function pre_delete(): void
{
    $slug = niwa_str($_GET, 'slug');
    if (!$slug) niwa_json(400, ['ok' => false, 'error' => 'bad_request']);
    if ($slug === 'none') niwa_json(409, ['ok' => false, 'error' => 'system_preset']);

    try {
        $st = niwa_db()->prepare("DELETE FROM preset WHERE slug = :s");
        $st->execute([':s' => $slug]);
        if ($st->rowCount() === 0) niwa_json(404, ['ok' => false, 'error' => 'not_found']);
        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}
