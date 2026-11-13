<?php
/**
 * NIWA.PH — /api/admin/messages.php
 *
 * GET    elenco messaggi contatti, ?status=new|read|replied|archived (opzionale)
 * PUT    aggiorna stato messaggio  ?id=<id>  body: { status: "..." }
 * DELETE elimina messaggio          ?id=<id>
 */

declare(strict_types=1);

require_once __DIR__ . '/../_helpers.php';

niwa_require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($method) {
    case 'GET':    msg_list(); break;
    case 'PUT':    msg_update(); break;
    case 'DELETE': msg_delete(); break;
    default:
        niwa_json(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

function msg_list(): void
{
    $status = niwa_str($_GET, 'status');
    $allowed = ['new','read','replied','archived'];
    try {
        if ($status && in_array($status, $allowed, true)) {
            $st = niwa_db()->prepare(
                "SELECT id_message, name, email, subject, message, status,
                        ip_address, created_at, updated_at
                   FROM contact_message
                  WHERE status = :s
               ORDER BY created_at DESC
                  LIMIT 500"
            );
            $st->execute([':s' => $status]);
            $rows = $st->fetchAll();
        } else {
            $rows = niwa_db()->query(
                "SELECT id_message, name, email, subject, message, status,
                        ip_address, created_at, updated_at
                   FROM contact_message
               ORDER BY created_at DESC
                  LIMIT 500"
            )->fetchAll();
        }
        niwa_json(200, $rows);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function msg_update(): void
{
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id <= 0) niwa_json(400, ['ok' => false, 'error' => 'bad_request']);

    $body = niwa_read_json_body();
    $status = niwa_str($body, 'status');
    if (!in_array($status, ['new','read','replied','archived'], true)) {
        niwa_json(400, ['ok' => false, 'error' => 'invalid_status']);
    }

    try {
        $st = niwa_db()->prepare(
            "UPDATE contact_message SET status = :s WHERE id_message = :i"
        );
        $st->execute([':s' => $status, ':i' => $id]);
        if ($st->rowCount() === 0) niwa_json(404, ['ok' => false, 'error' => 'not_found']);
        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function msg_delete(): void
{
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id <= 0) niwa_json(400, ['ok' => false, 'error' => 'bad_request']);

    try {
        $st = niwa_db()->prepare("DELETE FROM contact_message WHERE id_message = :i");
        $st->execute([':i' => $id]);
        if ($st->rowCount() === 0) niwa_json(404, ['ok' => false, 'error' => 'not_found']);
        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}
