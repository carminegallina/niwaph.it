<?php
// Copyright (c) 2026 Carmine Gallina - https://github.com/carminegallina
/**
 * NIWA.PH — /api/admin/media.php
 *
 * Tutte le operazioni richiedono sessione admin valida.
 *
 * GET    /api/admin/media.php
 *        Lista TUTTI i media (anche draft/private), formato esteso.
 *
 * POST   /api/admin/media.php
 *        Crea una riga media. Body JSON:
 *          {
 *            type: "photo"|"video",
 *            category: "weddings",
 *            preset:   "niwa",
 *            aspect:   "sq"|"tall"|"wide"|"pano"|"port",
 *            visibility: "draft"|"published"|"private",
 *            is_featured: 0|1,
 *            sort_order:  int,
 *            adj: { exposure?, contrast?, ..., fade? },
 *            title: { it, en },
 *            desc:  { it, en },
 *            alt:   { it, en },
 *            tags:  ["slug", ...],
 *            src:   "/uploads/..."  (URL pubblico del file principale, opzionale
 *                                     se l'inserimento è già stato fatto da upload.php)
 *            poster:"/uploads/..."  (per video)
 *          }
 *        Risposta: 201 { ok:true, id_media }
 *
 * PUT    /api/admin/media.php?id=<id>
 *        Aggiorna i campi indicati (partial update).
 *        Risposta: 200 { ok:true }
 *
 * DELETE /api/admin/media.php?id=<id>
 *        Elimina il media e i file collegati (su disco e in DB).
 *        Risposta: 200 { ok:true }
 */

declare(strict_types=1);

require_once __DIR__ . '/../_helpers.php';

niwa_require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($method) {
    case 'GET':    handle_list(); break;
    case 'POST':   handle_create(); break;
    case 'PUT':    handle_update(); break;
    case 'DELETE': handle_delete(); break;
    default:
        niwa_json(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

/* -------------------------------------------------------------- */

function handle_list(): void
{
    try {
        // Esclude i media taggati come "__profile__" (foto profilo dell'About).
        // Questi vivono in una sezione separata (profile_history.php) e NON
        // devono apparire nella lista Media generale dell'admin.
        $sql = "
            SELECT m.*, c.slug AS category_slug, p.slug AS preset_slug
              FROM media m
              JOIN category c ON c.id_category = m.id_category
              LEFT JOIN preset p ON p.id_preset = m.id_preset
             WHERE m.id_media NOT IN (
                SELECT mt.id_media FROM media_tag mt
                  JOIN tag t ON t.id_tag = mt.id_tag
                 WHERE t.slug = '__profile__'
             )
             ORDER BY m.sort_order ASC, m.created_at DESC
        ";
        $rows = niwa_db()->query($sql)->fetchAll();

        // Carica file, traduzioni e tag in batch
        $ids = array_column($rows, 'id_media');
        $filesByMedia = [];
        $transByMedia = [];
        $tagsByMedia  = [];
        if (!empty($ids)) {
            $ph = implode(',', array_fill(0, count($ids), '?'));

            $stF = niwa_db()->prepare(
                "SELECT id_media, kind, public_url, mime_type
                   FROM media_file WHERE id_media IN ($ph)
                   ORDER BY sort_order ASC"
            );
            $stF->execute($ids);
            foreach ($stF->fetchAll() as $r) {
                $filesByMedia[(int)$r['id_media']][$r['kind']] = $r['public_url'];
            }

            $stT = niwa_db()->prepare(
                "SELECT id_media, lang, title, description, alt_text
                   FROM media_translation WHERE id_media IN ($ph)"
            );
            $stT->execute($ids);
            foreach ($stT->fetchAll() as $r) {
                $transByMedia[(int)$r['id_media']][$r['lang']] = $r;
            }

            $stG = niwa_db()->prepare(
                "SELECT mt.id_media, t.slug
                   FROM media_tag mt JOIN tag t ON t.id_tag = mt.id_tag
                  WHERE mt.id_media IN ($ph)"
            );
            $stG->execute($ids);
            foreach ($stG->fetchAll() as $r) {
                $tagsByMedia[(int)$r['id_media']][] = $r['slug'];
            }
        }

        $out = [];
        foreach ($rows as $r) {
            $id = (int)$r['id_media'];
            $adj = [];
            foreach (['exposure','contrast','saturation','warmth','grain','vignette','fade'] as $k) {
                if ($r['adj_'.$k] !== null) $adj[$k] = (int)$r['adj_'.$k];
            }
            $tIt = $transByMedia[$id]['it'] ?? null;
            $tEn = $transByMedia[$id]['en'] ?? null;
            $out[] = [
                'id'          => 'm' . $id,
                'id_media'    => $id,
                'type'        => $r['type'],
                'category'    => $r['category_slug'],
                'preset'      => $r['preset_slug'] ?? 'none',
                'aspect'      => $r['aspect'],
                'visibility'  => $r['visibility'],
                'is_featured' => (int)$r['is_featured'] === 1,
                'show_info'   => (int)($r['show_info'] ?? 1) === 1,
                'carousel_frame_url' => $r['carousel_frame_url'] ?? null,
                'sort_order'  => (int)$r['sort_order'],
                'src'         => $filesByMedia[$id]['main']   ?? '',
                'poster'      => $filesByMedia[$id]['poster'] ?? '',
                'title' => ['it' => $tIt['title'] ?? '',       'en' => $tEn['title'] ?? ''],
                'desc'  => ['it' => $tIt['description'] ?? '', 'en' => $tEn['description'] ?? ''],
                'alt'   => ['it' => $tIt['alt_text'] ?? '',    'en' => $tEn['alt_text'] ?? ''],
                'tags'  => $tagsByMedia[$id] ?? [],
                'adj'   => (object) $adj,
            ];
        }

        niwa_json(200, $out);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

/* -------------------------------------------------------------- */

function handle_create(): void
{
    $body = niwa_read_json_body();

    $type   = niwa_str($body, 'type', 'photo');
    $catSlug= niwa_str($body, 'category');
    $preset = niwa_str($body, 'preset', 'none');
    $aspect = niwa_str($body, 'aspect', 'sq');
    $vis    = niwa_str($body, 'visibility', 'published');
    $feat   = niwa_int($body, 'is_featured', 0) ?: 0;
    $sort   = niwa_int($body, 'sort_order', 0)  ?: 0;
    // show_info: 1 mostra titolo/desc/tag al visitatore, 0 li nasconde.
    // Default 1 per backward compatibility.
    $showInfo = isset($body['show_info'])
        ? ($body['show_info'] ? 1 : 0)
        : 1;

    if (!in_array($type, ['photo','video'], true)
        || !in_array($aspect, ['sq','tall','wide','pano','port'], true)
        || !in_array($vis, ['draft','published','private'], true)
        || $catSlug === null) {
        niwa_json(400, ['ok' => false, 'error' => 'bad_request']);
    }

    try {
        $pdo = niwa_db();
        $pdo->beginTransaction();

        // Risolve id_category
        $st = $pdo->prepare("SELECT id_category FROM category WHERE slug = :s LIMIT 1");
        $st->execute([':s' => $catSlug]);
        $idCat = $st->fetchColumn();
        if (!$idCat) {
            $pdo->rollBack();
            niwa_json(400, ['ok' => false, 'error' => 'invalid_category']);
        }

        // Risolve id_preset (nullable)
        $idPreset = null;
        if ($preset && $preset !== 'none') {
            $st = $pdo->prepare("SELECT id_preset FROM preset WHERE slug = :s LIMIT 1");
            $st->execute([':s' => $preset]);
            $idPreset = $st->fetchColumn() ?: null;
        }

        // Insert media
        $cols = ['id_category','id_preset','type','aspect','visibility','is_featured','show_info','sort_order'];
        $vals = [$idCat, $idPreset, $type, $aspect, $vis, $feat, $showInfo, $sort];

        $adj = is_array($body['adj'] ?? null) ? $body['adj'] : [];
        foreach (['exposure','contrast','saturation','warmth','grain','vignette','fade'] as $k) {
            if (array_key_exists($k, $adj) && $adj[$k] !== null && $adj[$k] !== '') {
                $cols[] = 'adj_'.$k;
                $vals[] = (int)$adj[$k];
            }
        }

        $place = implode(',', array_fill(0, count($cols), '?'));
        $sql = "INSERT INTO media (" . implode(',', $cols) . ") VALUES ($place)";
        $pdo->prepare($sql)->execute($vals);
        $idMedia = (int)$pdo->lastInsertId();

        // File principale e poster (se forniti come URL già caricati)
        $src    = niwa_str($body, 'src');
        $poster = niwa_str($body, 'poster');
        if ($src) {
            insert_media_file($pdo, $idMedia, 'main', $src, $body['mime'] ?? null);
        }
        if ($poster) {
            insert_media_file($pdo, $idMedia, 'poster', $poster, 'image/jpeg');
        }

        // Traduzioni
        upsert_translations($pdo, $idMedia, $body['title'] ?? [], $body['desc'] ?? [], $body['alt'] ?? []);

        // Tag
        $tags = is_array($body['tags'] ?? null) ? $body['tags'] : [];
        replace_tags($pdo, $idMedia, $tags);

        $pdo->commit();
        niwa_json(201, ['ok' => true, 'id_media' => $idMedia, 'id' => 'm'.$idMedia]);
    } catch (Throwable $e) {
        if (niwa_db()->inTransaction()) niwa_db()->rollBack();
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

/* -------------------------------------------------------------- */

function handle_update(): void
{
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id <= 0) niwa_json(400, ['ok' => false, 'error' => 'bad_request']);

    $body = niwa_read_json_body();

    try {
        $pdo = niwa_db();
        $pdo->beginTransaction();

        $st = $pdo->prepare("SELECT id_media FROM media WHERE id_media = :i LIMIT 1");
        $st->execute([':i' => $id]);
        if (!$st->fetchColumn()) {
            $pdo->rollBack();
            niwa_json(404, ['ok' => false, 'error' => 'not_found']);
        }

        $sets = [];
        $bind = [':i' => $id];

        if (isset($body['category'])) {
            $st = $pdo->prepare("SELECT id_category FROM category WHERE slug = :s LIMIT 1");
            $st->execute([':s' => (string)$body['category']]);
            $cid = $st->fetchColumn();
            if ($cid) { $sets[] = "id_category = :c"; $bind[':c'] = $cid; }
        }
        if (array_key_exists('preset', $body)) {
            $idP = null;
            $ps = $body['preset'];
            if (is_string($ps) && $ps !== '' && $ps !== 'none') {
                $st = $pdo->prepare("SELECT id_preset FROM preset WHERE slug = :s LIMIT 1");
                $st->execute([':s' => $ps]);
                $idP = $st->fetchColumn() ?: null;
            }
            $sets[] = "id_preset = :p"; $bind[':p'] = $idP;
        }
        foreach (['aspect','visibility','type'] as $k) {
            if (isset($body[$k])) { $sets[] = "$k = :_$k"; $bind[":_$k"] = (string)$body[$k]; }
        }
        foreach (['is_featured','show_info','sort_order'] as $k) {
            if (isset($body[$k])) { $sets[] = "$k = :_$k"; $bind[":_$k"] = (int)$body[$k]; }
        }

        // Adjustments: se passato come oggetto, sostituisce TUTTI i campi adj_*
        // (i campi non presenti diventano NULL).
        if (array_key_exists('adj', $body)) {
            $adj = is_array($body['adj']) ? $body['adj'] : [];
            foreach (['exposure','contrast','saturation','warmth','grain','vignette','fade'] as $k) {
                if (array_key_exists($k, $adj) && $adj[$k] !== null && $adj[$k] !== '') {
                    $sets[] = "adj_$k = :_adj_$k"; $bind[":_adj_$k"] = (int)$adj[$k];
                } else {
                    $sets[] = "adj_$k = NULL";
                }
            }
        }

        if (!empty($sets)) {
            $sql = "UPDATE media SET " . implode(', ', $sets) . " WHERE id_media = :i";
            $pdo->prepare($sql)->execute($bind);
        }

        // Traduzioni e tag
        if (isset($body['title']) || isset($body['desc']) || isset($body['alt'])) {
            upsert_translations($pdo, $id, $body['title'] ?? [], $body['desc'] ?? [], $body['alt'] ?? []);
        }
        if (array_key_exists('tags', $body)) {
            $tags = is_array($body['tags']) ? $body['tags'] : [];
            replace_tags($pdo, $id, $tags);
        }

        // Aggiornamento URL file (raro: avviene di solito tramite upload.php)
        if (array_key_exists('src', $body)) {
            replace_media_file($pdo, $id, 'main', (string)$body['src']);
        }
        if (array_key_exists('poster', $body)) {
            replace_media_file($pdo, $id, 'poster', (string)$body['poster']);
        }

        $pdo->commit();
        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        if (niwa_db()->inTransaction()) niwa_db()->rollBack();
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

/* -------------------------------------------------------------- */

function handle_delete(): void
{
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id <= 0) niwa_json(400, ['ok' => false, 'error' => 'bad_request']);

    try {
        $pdo = niwa_db();

        // Recupera i file su disco prima di cancellare le righe
        $st = $pdo->prepare("SELECT storage_path FROM media_file WHERE id_media = :i");
        $st->execute([':i' => $id]);
        $paths = array_column($st->fetchAll(), 'storage_path');

        // Cancella media (cascade su media_file, media_translation, media_tag)
        $del = $pdo->prepare("DELETE FROM media WHERE id_media = :i");
        $del->execute([':i' => $id]);

        if ($del->rowCount() === 0) {
            niwa_json(404, ['ok' => false, 'error' => 'not_found']);
        }

        // Cancella i file fisici (best effort)
        $uploadsRoot = realpath(__DIR__ . '/../../uploads');
        foreach ($paths as $p) {
            if (!is_string($p) || $p === '') continue;
            $real = realpath(__DIR__ . '/../../' . ltrim($p, '/'));
            if ($real && $uploadsRoot && str_starts_with($real, $uploadsRoot) && is_file($real)) {
                @unlink($real);
            }
        }

        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

/* ===== Helpers locali ===== */

function insert_media_file(PDO $pdo, int $idMedia, string $kind, string $publicUrl, ?string $mime = null): void
{
    $sql = "INSERT INTO media_file (id_media, kind, storage_path, public_url, mime_type, sort_order)
            VALUES (:i, :k, :sp, :pu, :m, 0)";
    $pdo->prepare($sql)->execute([
        ':i'  => $idMedia,
        ':k'  => $kind,
        ':sp' => $publicUrl, // qui memorizziamo lo stesso path; chi fa upload reale lo aggiorna a parte
        ':pu' => $publicUrl,
        ':m'  => $mime,
    ]);
}

function replace_media_file(PDO $pdo, int $idMedia, string $kind, string $publicUrl): void
{
    $del = $pdo->prepare("DELETE FROM media_file WHERE id_media = :i AND kind = :k");
    $del->execute([':i' => $idMedia, ':k' => $kind]);
    if ($publicUrl !== '') {
        insert_media_file($pdo, $idMedia, $kind, $publicUrl);
    }
}

function upsert_translations(PDO $pdo, int $idMedia, $title, $desc, $alt): void
{
    $title = is_array($title) ? $title : [];
    $desc  = is_array($desc)  ? $desc  : [];
    $alt   = is_array($alt)   ? $alt   : [];

    foreach (['it', 'en'] as $lang) {
        // Non scrivere se tutti e tre i campi sono assenti / vuoti per quella lingua
        $t = isset($title[$lang]) ? (string)$title[$lang] : null;
        $d = isset($desc[$lang])  ? (string)$desc[$lang]  : null;
        $a = isset($alt[$lang])   ? (string)$alt[$lang]   : null;

        $sql = "INSERT INTO media_translation (id_media, lang, title, description, alt_text)
                VALUES (:i, :l, :t, :d, :a)
                ON DUPLICATE KEY UPDATE
                  title = VALUES(title),
                  description = VALUES(description),
                  alt_text = VALUES(alt_text)";
        $pdo->prepare($sql)->execute([
            ':i' => $idMedia,
            ':l' => $lang,
            ':t' => $t === '' ? null : $t,
            ':d' => $d === '' ? null : $d,
            ':a' => $a === '' ? null : $a,
        ]);
    }
}

function replace_tags(PDO $pdo, int $idMedia, array $tagSlugs): void
{
    // Pulisce i tag esistenti per il media
    $pdo->prepare("DELETE FROM media_tag WHERE id_media = :i")->execute([':i' => $idMedia]);
    if (empty($tagSlugs)) return;

    $stIns = $pdo->prepare(
        "INSERT INTO tag (slug, name) VALUES (:s, :n)
         ON DUPLICATE KEY UPDATE name = VALUES(name)"
    );
    $stSel = $pdo->prepare("SELECT id_tag FROM tag WHERE slug = :s LIMIT 1");
    $stLink = $pdo->prepare("INSERT IGNORE INTO media_tag (id_media, id_tag) VALUES (:m, :t)");

    foreach ($tagSlugs as $raw) {
        $name = trim((string)$raw);
        if ($name === '') continue;
        $slug = niwa_slugify($name);
        if ($slug === '') continue;
        $stIns->execute([':s' => $slug, ':n' => $name]);
        $stSel->execute([':s' => $slug]);
        $idTag = (int)($stSel->fetchColumn() ?: 0);
        if ($idTag > 0) {
            $stLink->execute([':m' => $idMedia, ':t' => $idTag]);
        }
    }
}
