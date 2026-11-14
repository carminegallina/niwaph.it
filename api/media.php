<?php
// Copyright (c) 2026 Carmine Gallina - https://github.com/carminegallina
/**
 * NIWA.PH — GET /api/media.php
 *
 * Restituisce tutti i media pubblicati nel formato che il frontend si aspetta
 * (lo stesso shape di NIWA_SEED in data.js).
 *
 * Risposta:
 *   200 [
 *     {
 *       id, type, category, title:{it,en}, desc:{it,en},
 *       tags:[...], src, poster, aspect, preset, adj:{...}
 *     }, ...
 *   ]
 */

declare(strict_types=1);

require_once __DIR__ . '/_db.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    niwa_json(405, ['error' => 'method_not_allowed']);
}

try {
    // Media pubblicati con join su category, preset, file principale e poster.
    // Includiamo anche width_px/height_px (dalla media_file.main) — servono al
    // frontend per scegliere foto adatte al viewport del visitatore.
    // COALESCE: preferiamo i pixel salvati sulla riga media, ma se sono NULL
    // ricadiamo su quelli della media_file (popolati da upload.php via getimagesize).
    $sql = "
        SELECT
            m.id_media,
            m.type,
            c.slug AS category,
            p.slug AS preset,
            m.aspect,
            m.is_featured,
            m.sort_order,
            m.show_info,
            m.carousel_frame_url,
            m.adj_exposure, m.adj_contrast, m.adj_saturation, m.adj_warmth,
            m.adj_grain, m.adj_vignette, m.adj_fade,
            mf_main.public_url   AS src,
            mf_poster.public_url AS poster,
            COALESCE(m.width_px,  mf_main.width_px)  AS width_px,
            COALESCE(m.height_px, mf_main.height_px) AS height_px,
            mt_it.title AS title_it,  mt_en.title AS title_en,
            mt_it.description AS desc_it, mt_en.description AS desc_en,
            mt_it.alt_text AS alt_it, mt_en.alt_text AS alt_en
        FROM media m
        JOIN category c ON c.id_category = m.id_category
        LEFT JOIN preset p ON p.id_preset = m.id_preset
        LEFT JOIN media_file mf_main
          ON mf_main.id_media = m.id_media AND mf_main.kind = 'main'
        LEFT JOIN media_file mf_poster
          ON mf_poster.id_media = m.id_media AND mf_poster.kind = 'poster'
        LEFT JOIN media_translation mt_it ON mt_it.id_media = m.id_media AND mt_it.lang = 'it'
        LEFT JOIN media_translation mt_en ON mt_en.id_media = m.id_media AND mt_en.lang = 'en'
        WHERE m.visibility = 'published'
        ORDER BY m.sort_order ASC, m.created_at DESC
    ";
    $rows = niwa_db()->query($sql)->fetchAll();

    // Carica tutti i tag in una query sola e li indicizza per id_media
    $tagsByMedia = [];
    if (!empty($rows)) {
        $ids = array_column($rows, 'id_media');
        $place = implode(',', array_fill(0, count($ids), '?'));
        $stT = niwa_db()->prepare(
            "SELECT mt.id_media, t.slug
               FROM media_tag mt
               JOIN tag t ON t.id_tag = mt.id_tag
              WHERE mt.id_media IN ($place)"
        );
        $stT->execute($ids);
        foreach ($stT->fetchAll() as $r) {
            $tagsByMedia[(int)$r['id_media']][] = $r['slug'];
        }
    }

    $out = [];
    foreach ($rows as $r) {
        $id = (int)$r['id_media'];
        $adj = [];
        foreach (['exposure','contrast','saturation','warmth','grain','vignette','fade'] as $k) {
            $v = $r['adj_' . $k];
            if ($v !== null && $v !== '') $adj[$k] = (int)$v;
        }
        $out[] = [
            'id'       => 'm' . $id,                  // prefisso per evitare collisioni con seed locali
            'type'     => $r['type'],
            'category' => $r['category'],
            'title'    => ['it' => $r['title_it'] ?? '', 'en' => $r['title_en'] ?? ''],
            'desc'     => ['it' => $r['desc_it']  ?? '', 'en' => $r['desc_en']  ?? ''],
            'alt'      => ['it' => $r['alt_it']   ?? '', 'en' => $r['alt_en']   ?? ''],
            'tags'     => $tagsByMedia[$id] ?? [],
            'src'      => $r['src'] ?? '',
            'poster'   => $r['poster'] ?? '',
            'aspect'   => $r['aspect'],
            // Dimensioni reali in pixel (se note). Il frontend le usa per
            // capire foto orizzontali vs verticali a partire dal rapporto
            // width/height, invece di fidarsi del campo 'aspect' che può
            // essere stato impostato male in fase di upload.
            'width'    => $r['width_px']  !== null ? (int)$r['width_px']  : null,
            'height'   => $r['height_px'] !== null ? (int)$r['height_px'] : null,
            'preset'   => $r['preset'] ?? 'none',
            'adj'      => (object)$adj,                // forza JSON object {} anche se vuoto
            'is_featured' => (int)$r['is_featured'] === 1,
            // show_info: se 0, il sito pubblico nasconderà titolo/desc/tag/categoria
            // nell'overlay della lightbox, mostrando solo la foto/video pulito.
            'show_info'   => (int)($r['show_info'] ?? 1) === 1,
            // Frame statico (URL) da mostrare nel carosello home al posto del
            // video animato; impostato dall'admin via /api/admin/video_frame.php.
            'carousel_frame_url' => $r['carousel_frame_url'] ?? null,
            'sort_order'  => (int)$r['sort_order'],
        ];
    }

    niwa_json(200, $out);
} catch (Throwable $e) {
    niwa_json(500, ['error' => 'server_error']);
}
