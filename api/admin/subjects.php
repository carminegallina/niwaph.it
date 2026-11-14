<?php
// Copyright (c) 2026 Carmine Gallina - https://github.com/carminegallina
/**
 * NIWA.PH — /api/admin/subjects.php
 *
 * GET    elenco subject (anche disattivati)
 * POST   crea  { label_it?, label_en?, sort_order?, is_active? }
 * PUT    aggiorna ?id=<id>
 * DELETE elimina  ?id=<id>
 */

declare(strict_types=1);

require_once __DIR__ . '/../_helpers.php';

niwa_require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
switch ($method) {
    case 'GET':    sj_list(); break;
    case 'POST':   sj_create(); break;
    case 'PUT':    sj_update(); break;
    case 'DELETE': sj_delete(); break;
    default:
        niwa_json(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

function sj_list(): void
{
    try {
        $sql = "SELECT s.id_subject, s.sort_order, s.is_active,
                       st.lang, st.label
                  FROM subject s
                  LEFT JOIN subject_translation st ON st.id_subject = s.id_subject
                 ORDER BY s.sort_order ASC, s.id_subject ASC";
        $rows = niwa_db()->query($sql)->fetchAll();
        $byId = [];
        foreach ($rows as $r) {
            $id = (int)$r['id_subject'];
            if (!isset($byId[$id])) {
                $byId[$id] = [
                    'id'         => $id,
                    'sort_order' => (int)$r['sort_order'],
                    'is_active'  => (int)$r['is_active'] === 1,
                    'label'      => ['it' => '', 'en' => ''],
                ];
            }
            if ($r['lang'] === 'it' || $r['lang'] === 'en') {
                $byId[$id]['label'][$r['lang']] = $r['label'] ?? '';
            }
        }
        niwa_json(200, array_values($byId));
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function sj_upsert_translations(PDO $pdo, int $id, array $body): void
{
    foreach (['it', 'en'] as $lang) {
        $label = $body["label_$lang"] ?? null;
        if ($label === null) continue;
        $st = $pdo->prepare(
            "INSERT INTO subject_translation (id_subject, lang, label)
                  VALUES (:i, :l, :n)
             ON DUPLICATE KEY UPDATE label = VALUES(label)"
        );
        $st->execute([
            ':i' => $id, ':l' => $lang,
            ':n' => substr((string)$label, 0, 160),
        ]);
    }
}

function sj_create(): void
{
    $body = niwa_read_json_body();
    try {
        $pdo = niwa_db();
        $pdo->beginTransaction();
        $st = $pdo->prepare(
            "INSERT INTO subject (sort_order, is_active) VALUES (:so, :ia)"
        );
        $st->execute([
            ':so' => niwa_int($body, 'sort_order', 0),
            ':ia' => isset($body['is_active']) ? ($body['is_active'] ? 1 : 0) : 1,
        ]);
        $id = (int)$pdo->lastInsertId();
        sj_upsert_translations($pdo, $id, $body);
        $pdo->commit();
        niwa_json(201, ['ok' => true, 'id' => $id]);
    } catch (Throwable $e) {
        if (niwa_db()->inTransaction()) niwa_db()->rollBack();
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function sj_update(): void
{
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) niwa_json(400, ['ok' => false, 'error' => 'invalid_id']);
    $body = niwa_read_json_body();
    try {
        $pdo = niwa_db();
        $pdo->beginTransaction();
        $sets = []; $args = [':i' => $id];
        if (isset($body['sort_order'])) { $sets[] = 'sort_order = :so'; $args[':so'] = (int)$body['sort_order']; }
        if (isset($body['is_active']))  { $sets[] = 'is_active = :ia';  $args[':ia'] = $body['is_active'] ? 1 : 0; }
        if (!empty($sets)) {
            $pdo->prepare("UPDATE subject SET " . implode(', ', $sets) . " WHERE id_subject = :i")
                ->execute($args);
        }
        sj_upsert_translations($pdo, $id, $body);
        $pdo->commit();
        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        if (niwa_db()->inTransaction()) niwa_db()->rollBack();
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function sj_delete(): void
{
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) niwa_json(400, ['ok' => false, 'error' => 'invalid_id']);
    try {
        niwa_db()->prepare("DELETE FROM subject WHERE id_subject = :i")
            ->execute([':i' => $id]);
        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}
