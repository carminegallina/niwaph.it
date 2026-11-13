<?php
/**
 * NIWA.PH — /api/admin/services.php
 *
 * GET    elenco servizi (anche disattivati)
 * POST   crea servizio { name_it, name_en, sort_order?, is_active? }
 * PUT    aggiorna servizio ?id=<id>
 * DELETE elimina servizio  ?id=<id>
 */

declare(strict_types=1);

require_once __DIR__ . '/../_helpers.php';

niwa_require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($method) {
    case 'GET':    sv_list(); break;
    case 'POST':   sv_create(); break;
    case 'PUT':    sv_update(); break;
    case 'DELETE': sv_delete(); break;
    default:
        niwa_json(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

function sv_list(): void
{
    try {
        $sql = "SELECT s.id_service, s.sort_order, s.is_active,
                       st.lang, st.name
                  FROM service s
                  LEFT JOIN service_translation st ON st.id_service = s.id_service
                 ORDER BY s.sort_order ASC, s.id_service ASC";
        $rows = niwa_db()->query($sql)->fetchAll();
        $byId = [];
        foreach ($rows as $r) {
            $id = (int)$r['id_service'];
            if (!isset($byId[$id])) {
                $byId[$id] = [
                    'id'         => $id,
                    'sort_order' => (int)$r['sort_order'],
                    'is_active'  => (int)$r['is_active'] === 1,
                    'name'       => ['it' => '', 'en' => ''],
                ];
            }
            if ($r['lang'] === 'it' || $r['lang'] === 'en') {
                $byId[$id]['name'][$r['lang']] = $r['name'] ?? '';
            }
        }
        niwa_json(200, array_values($byId));
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function sv_create(): void
{
    $body = niwa_read_json_body();
    try {
        $pdo = niwa_db();
        $pdo->beginTransaction();
        $st = $pdo->prepare(
            "INSERT INTO service (sort_order, is_active) VALUES (:so, :ia)"
        );
        $st->execute([
            ':so' => niwa_int($body, 'sort_order', 0),
            ':ia' => isset($body['is_active']) ? ($body['is_active'] ? 1 : 0) : 1,
        ]);
        $id = (int)$pdo->lastInsertId();
        sv_upsert_translations($pdo, $id, $body);
        $pdo->commit();
        niwa_json(201, ['ok' => true, 'id' => $id]);
    } catch (Throwable $e) {
        if (niwa_db()->inTransaction()) niwa_db()->rollBack();
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function sv_update(): void
{
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) niwa_json(400, ['ok' => false, 'error' => 'invalid_id']);
    $body = niwa_read_json_body();

    try {
        $pdo = niwa_db();
        $pdo->beginTransaction();
        $set = []; $args = [':i' => $id];
        if (isset($body['sort_order'])) {
            $set[] = 'sort_order = :so';
            $args[':so'] = (int)$body['sort_order'];
        }
        if (isset($body['is_active'])) {
            $set[] = 'is_active = :ia';
            $args[':ia'] = $body['is_active'] ? 1 : 0;
        }
        if (!empty($set)) {
            $pdo->prepare("UPDATE service SET " . implode(', ', $set) . " WHERE id_service = :i")
                ->execute($args);
        }
        sv_upsert_translations($pdo, $id, $body);
        $pdo->commit();
        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        if (niwa_db()->inTransaction()) niwa_db()->rollBack();
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function sv_delete(): void
{
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) niwa_json(400, ['ok' => false, 'error' => 'invalid_id']);
    try {
        $st = niwa_db()->prepare("DELETE FROM service WHERE id_service = :i");
        $st->execute([':i' => $id]);
        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function sv_upsert_translations(PDO $pdo, int $id, array $body): void
{
    foreach (['it', 'en'] as $lang) {
        $name = $body["name_$lang"] ?? null;
        if ($name === null) continue;
        $st = $pdo->prepare(
            "INSERT INTO service_translation (id_service, lang, name)
                  VALUES (:i, :l, :n)
             ON DUPLICATE KEY UPDATE name = VALUES(name)"
        );
        $st->execute([
            ':i' => $id,
            ':l' => $lang,
            ':n' => substr((string)$name, 0, 160),
        ]);
    }
}
