<?php
// Copyright (c) 2026 Carmine Gallina - https://github.com/carminegallina
/**
 * NIWA.PH — /api/admin/categories.php
 *
 * GET    elenco completo categorie (anche disattivate) con traduzioni IT/EN
 * POST   crea categoria { slug, it, en, sort_order? }
 * PUT    aggiorna categoria ?slug=<slug>  body: { it?, en?, sort_order?, is_active? }
 * DELETE elimina categoria  ?slug=<slug>
 *
 * Il campo "key" usato dal frontend è lo slug. La cancellazione fallisce
 * con 409 se ci sono ancora media collegati (vincolo FK ON DELETE RESTRICT).
 */

declare(strict_types=1);

require_once __DIR__ . '/../_helpers.php';

niwa_require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($method) {
    case 'GET':    cat_list(); break;
    case 'POST':   cat_create(); break;
    case 'PUT':    cat_update(); break;
    case 'DELETE': cat_delete(); break;
    default:
        niwa_json(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

function cat_list(): void
{
    try {
        $sql = "SELECT c.id_category, c.slug, c.sort_order, c.is_active,
                       ct.lang, ct.name
                  FROM category c
                  LEFT JOIN category_translation ct ON ct.id_category = c.id_category
                 ORDER BY c.sort_order ASC, c.id_category ASC";
        $rows = niwa_db()->query($sql)->fetchAll();
        $out = [];
        foreach ($rows as $r) {
            $slug = $r['slug'];
            if (!isset($out[$slug])) {
                $out[$slug] = [
                    'slug' => $slug,
                    'sort_order' => (int)$r['sort_order'],
                    'is_active'  => (int)$r['is_active'] === 1,
                    'it' => '',
                    'en' => '',
                ];
            }
            if ($r['lang'] === 'it' || $r['lang'] === 'en') {
                $out[$slug][$r['lang']] = $r['name'] ?? '';
            }
        }
        niwa_json(200, array_values($out));
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function cat_create(): void
{
    $body = niwa_read_json_body();
    $rawSlug = niwa_str($body, 'slug') ?? niwa_str($body, 'key');
    if (!$rawSlug) niwa_json(400, ['ok' => false, 'error' => 'bad_request']);
    $slug = niwa_slugify($rawSlug);
    if ($slug === '') niwa_json(400, ['ok' => false, 'error' => 'invalid_slug']);

    $it = niwa_str($body, 'it') ?? $slug;
    $en = niwa_str($body, 'en') ?? $slug;
    $sort = niwa_int($body, 'sort_order', 0) ?? 0;

    try {
        $pdo = niwa_db();
        $pdo->beginTransaction();

        $st = $pdo->prepare("SELECT id_category FROM category WHERE slug = :s LIMIT 1");
        $st->execute([':s' => $slug]);
        if ($st->fetchColumn()) {
            $pdo->rollBack();
            niwa_json(409, ['ok' => false, 'error' => 'slug_exists']);
        }

        $pdo->prepare("INSERT INTO category (slug, sort_order, is_active) VALUES (:s, :o, 1)")
            ->execute([':s' => $slug, ':o' => $sort]);
        $idCat = (int)$pdo->lastInsertId();

        $stT = $pdo->prepare(
            "INSERT INTO category_translation (id_category, lang, name) VALUES (:i, :l, :n)"
        );
        $stT->execute([':i' => $idCat, ':l' => 'it', ':n' => $it]);
        $stT->execute([':i' => $idCat, ':l' => 'en', ':n' => $en]);

        $pdo->commit();
        niwa_json(201, ['ok' => true, 'slug' => $slug]);
    } catch (Throwable $e) {
        if (niwa_db()->inTransaction()) niwa_db()->rollBack();
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function cat_update(): void
{
    $slug = niwa_str($_GET, 'slug');
    if (!$slug) niwa_json(400, ['ok' => false, 'error' => 'bad_request']);

    $body = niwa_read_json_body();

    try {
        $pdo = niwa_db();
        $st = $pdo->prepare("SELECT id_category FROM category WHERE slug = :s LIMIT 1");
        $st->execute([':s' => $slug]);
        $idCat = (int)($st->fetchColumn() ?: 0);
        if ($idCat <= 0) niwa_json(404, ['ok' => false, 'error' => 'not_found']);

        $pdo->beginTransaction();

        $sets = []; $bind = [':i' => $idCat];
        if (isset($body['sort_order'])) { $sets[] = "sort_order = :o"; $bind[':o'] = (int)$body['sort_order']; }
        if (isset($body['is_active']))  { $sets[] = "is_active  = :a"; $bind[':a'] = (int)(bool)$body['is_active']; }
        if (!empty($sets)) {
            $sql = "UPDATE category SET " . implode(', ', $sets) . " WHERE id_category = :i";
            $pdo->prepare($sql)->execute($bind);
        }

        foreach (['it','en'] as $lang) {
            if (isset($body[$lang])) {
                $sql = "INSERT INTO category_translation (id_category, lang, name)
                        VALUES (:i, :l, :n)
                        ON DUPLICATE KEY UPDATE name = VALUES(name)";
                $pdo->prepare($sql)->execute([
                    ':i' => $idCat,
                    ':l' => $lang,
                    ':n' => (string)$body[$lang],
                ]);
            }
        }

        $pdo->commit();
        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        if (niwa_db()->inTransaction()) niwa_db()->rollBack();
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function cat_delete(): void
{
    $slug = niwa_str($_GET, 'slug');
    if (!$slug) niwa_json(400, ['ok' => false, 'error' => 'bad_request']);

    try {
        $pdo = niwa_db();

        $st = $pdo->prepare("SELECT id_category FROM category WHERE slug = :s LIMIT 1");
        $st->execute([':s' => $slug]);
        $idCat = (int)($st->fetchColumn() ?: 0);
        if ($idCat <= 0) niwa_json(404, ['ok' => false, 'error' => 'not_found']);

        // Controlla media collegati (la FK è ON DELETE RESTRICT, ma diamo errore chiaro)
        $st = $pdo->prepare("SELECT COUNT(*) FROM media WHERE id_category = :i");
        $st->execute([':i' => $idCat]);
        $count = (int)$st->fetchColumn();
        if ($count > 0) {
            niwa_json(409, ['ok' => false, 'error' => 'category_in_use', 'media_count' => $count]);
        }

        $pdo->prepare("DELETE FROM category WHERE id_category = :i")->execute([':i' => $idCat]);
        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}
