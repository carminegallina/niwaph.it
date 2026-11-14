<?php
// Copyright (c) 2026 Carmine Gallina - https://github.com/carminegallina
/**
 * NIWA.PH — GET /api/admin/profile_history.php
 *
 * Restituisce le ultime 5 immagini profilo caricate dall'admin
 * (media taggati con '__profile__'), ordinate dalla più recente.
 * Esegue anche la "purge" automatica: se ce ne sono più di 5 in DB,
 * elimina le più vecchie e i file su disco. Comportamento FIFO/stack.
 *
 * Risposta:
 *   200 [ {id_media, src, created_at, is_active}, ... ]
 */

declare(strict_types=1);

require_once __DIR__ . '/../_helpers.php';

niwa_require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    niwa_json(405, ['error' => 'method_not_allowed']);
}

const PROFILE_HISTORY_MAX = 5;
const PROFILE_TAG_SLUG = '__profile__';

try {
    $pdo = niwa_db();

    // Risolvi (o crea) il tag interno '__profile__'
    $stTag = $pdo->prepare("SELECT id_tag FROM tag WHERE slug = :s LIMIT 1");
    $stTag->execute([':s' => PROFILE_TAG_SLUG]);
    $idTag = (int)($stTag->fetchColumn() ?: 0);
    if ($idTag === 0) {
        // Nessun tag = nessuna cronologia
        niwa_json(200, []);
    }

    // Tutte le foto profilo, dalla più recente
    $sql = "
        SELECT m.id_media, m.created_at,
               mf.public_url AS src
          FROM media m
          JOIN media_tag mt ON mt.id_media = m.id_media
          LEFT JOIN media_file mf ON mf.id_media = m.id_media AND mf.kind = 'main'
         WHERE mt.id_tag = :t
         ORDER BY m.id_media DESC
    ";
    $st = $pdo->prepare($sql);
    $st->execute([':t' => $idTag]);
    $allRows = $st->fetchAll();

    // Purge: se eccedono 5, cancelliamo le più vecchie (in coda all'ordine)
    if (count($allRows) > PROFILE_HISTORY_MAX) {
        $toDelete = array_slice($allRows, PROFILE_HISTORY_MAX);

        // Recupera i file su disco prima di cancellare il record
        $idsToDelete = array_map(fn($r) => (int)$r['id_media'], $toDelete);
        $place = implode(',', array_fill(0, count($idsToDelete), '?'));

        $stFiles = $pdo->prepare(
            "SELECT storage_path FROM media_file WHERE id_media IN ($place)"
        );
        $stFiles->execute($idsToDelete);
        $paths = array_column($stFiles->fetchAll(), 'storage_path');

        // Elimina i record media (cascade su media_file/translation/tag)
        $del = $pdo->prepare("DELETE FROM media WHERE id_media IN ($place)");
        $del->execute($idsToDelete);

        // Elimina i file su disco (best effort, dentro /uploads)
        $uploadsRoot = realpath(__DIR__ . '/../../uploads');
        foreach ($paths as $p) {
            if (!is_string($p) || $p === '') continue;
            $real = realpath(__DIR__ . '/../../' . ltrim($p, '/'));
            if ($real && $uploadsRoot && str_starts_with($real, $uploadsRoot) && is_file($real)) {
                @unlink($real);
            }
        }

        // I rows da restituire sono solo i primi 5
        $allRows = array_slice($allRows, 0, PROFILE_HISTORY_MAX);
    }

    // Output: solo i campi che servono al client
    $out = array_map(fn($r) => [
        'id_media'   => (int)$r['id_media'],
        'src'        => $r['src'] ?? '',
        'created_at' => $r['created_at'],
    ], $allRows);

    niwa_json(200, $out);
} catch (Throwable $e) {
    niwa_json(500, ['error' => 'server_error']);
}
