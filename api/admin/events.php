<?php
/**
 * NIWA.PH — /api/admin/events.php
 *
 * GET    elenco completo eventi (anche disattivati) con traduzioni IT/EN
 * POST   crea evento  { date_from, date_to?, sort_order?, is_active?,
 *                       title_it?, title_en?, desc_it?, desc_en?, tag_it?, tag_en? }
 * PUT    aggiorna evento ?id=<id>  body: { stessi campi }
 * DELETE elimina evento  ?id=<id>
 */

declare(strict_types=1);

require_once __DIR__ . '/../_helpers.php';

niwa_require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($method) {
    case 'GET':    ev_list(); break;
    case 'POST':   ev_create(); break;
    case 'PUT':    ev_update(); break;
    case 'DELETE': ev_delete(); break;
    default:
        niwa_json(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

function ev_list(): void
{
    try {
        $sql = "SELECT e.id_event, e.date_from, e.date_to, e.sort_order, e.is_active,
                       et.lang, et.title, et.description, et.tag
                  FROM event e
                  LEFT JOIN event_translation et ON et.id_event = e.id_event
                 ORDER BY e.date_from DESC, e.sort_order ASC, e.id_event DESC";
        $rows = niwa_db()->query($sql)->fetchAll();
        $byId = [];
        foreach ($rows as $r) {
            $id = (int)$r['id_event'];
            if (!isset($byId[$id])) {
                $byId[$id] = [
                    'id'          => $id,
                    'date_from'   => $r['date_from'],
                    'date_to'     => $r['date_to'],
                    'sort_order'  => (int)$r['sort_order'],
                    'is_active'   => (int)$r['is_active'] === 1,
                    'title'       => ['it' => '', 'en' => ''],
                    'description' => ['it' => '', 'en' => ''],
                    'tag'         => ['it' => '', 'en' => ''],
                ];
            }
            if ($r['lang'] === 'it' || $r['lang'] === 'en') {
                $byId[$id]['title'][$r['lang']]       = $r['title']       ?? '';
                $byId[$id]['description'][$r['lang']] = $r['description'] ?? '';
                $byId[$id]['tag'][$r['lang']]         = $r['tag']         ?? '';
            }
        }
        niwa_json(200, array_values($byId));
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function ev_create(): void
{
    $body = niwa_read_json_body();
    $dateFrom = niwa_str($body, 'date_from') ?? '';
    if (!ev_valid_date($dateFrom)) {
        niwa_json(400, ['ok' => false, 'error' => 'invalid_date_from']);
    }
    $dateTo = niwa_str($body, 'date_to') ?? '';
    if ($dateTo !== '' && !ev_valid_date($dateTo)) {
        niwa_json(400, ['ok' => false, 'error' => 'invalid_date_to']);
    }
    if ($dateTo !== '' && $dateTo < $dateFrom) {
        niwa_json(400, ['ok' => false, 'error' => 'date_to_before_from']);
    }

    try {
        $pdo = niwa_db();
        $pdo->beginTransaction();
        $st = $pdo->prepare(
            "INSERT INTO event (date_from, date_to, sort_order, is_active)
                  VALUES (:df, :dt, :so, :ia)"
        );
        $st->execute([
            ':df' => $dateFrom,
            ':dt' => $dateTo !== '' ? $dateTo : null,
            ':so' => niwa_int($body, 'sort_order', 0),
            ':ia' => isset($body['is_active']) ? ($body['is_active'] ? 1 : 0) : 1,
        ]);
        $idEvent = (int)$pdo->lastInsertId();
        ev_upsert_translations($pdo, $idEvent, $body);
        $pdo->commit();
        niwa_json(201, ['ok' => true, 'id' => $idEvent]);
    } catch (Throwable $e) {
        if (niwa_db()->inTransaction()) niwa_db()->rollBack();
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function ev_update(): void
{
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) niwa_json(400, ['ok' => false, 'error' => 'invalid_id']);
    $body = niwa_read_json_body();

    try {
        $pdo = niwa_db();
        $pdo->beginTransaction();

        // Aggiorna campi principali se forniti
        $set = []; $args = [':i' => $id];
        if (isset($body['date_from'])) {
            if (!ev_valid_date($body['date_from'])) {
                $pdo->rollBack();
                niwa_json(400, ['ok' => false, 'error' => 'invalid_date_from']);
            }
            $set[] = 'date_from = :df';
            $args[':df'] = $body['date_from'];
        }
        if (array_key_exists('date_to', $body)) {
            $dt = $body['date_to'];
            if ($dt !== null && $dt !== '' && !ev_valid_date((string)$dt)) {
                $pdo->rollBack();
                niwa_json(400, ['ok' => false, 'error' => 'invalid_date_to']);
            }
            $set[] = 'date_to = :dt';
            $args[':dt'] = ($dt === null || $dt === '') ? null : $dt;
        }
        if (isset($body['sort_order'])) {
            $set[] = 'sort_order = :so';
            $args[':so'] = (int)$body['sort_order'];
        }
        if (isset($body['is_active'])) {
            $set[] = 'is_active = :ia';
            $args[':ia'] = $body['is_active'] ? 1 : 0;
        }
        if (!empty($set)) {
            $pdo->prepare("UPDATE event SET " . implode(', ', $set) . " WHERE id_event = :i")
                ->execute($args);
        }

        ev_upsert_translations($pdo, $id, $body);
        $pdo->commit();
        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        if (niwa_db()->inTransaction()) niwa_db()->rollBack();
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function ev_delete(): void
{
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) niwa_json(400, ['ok' => false, 'error' => 'invalid_id']);
    try {
        $st = niwa_db()->prepare("DELETE FROM event WHERE id_event = :i");
        $st->execute([':i' => $id]);
        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function ev_upsert_translations(PDO $pdo, int $id, array $body): void
{
    foreach (['it', 'en'] as $lang) {
        $title = $body["title_$lang"] ?? null;
        $desc  = $body["desc_$lang"]  ?? null;
        $tag   = $body["tag_$lang"]   ?? null;
        if ($title === null && $desc === null && $tag === null) continue;

        $st = $pdo->prepare(
            "INSERT INTO event_translation (id_event, lang, title, description, tag)
                  VALUES (:i, :l, :t, :d, :g)
             ON DUPLICATE KEY UPDATE
                  title       = COALESCE(VALUES(title), title),
                  description = COALESCE(VALUES(description), description),
                  tag         = COALESCE(VALUES(tag), tag)"
        );
        $st->execute([
            ':i' => $id,
            ':l' => $lang,
            ':t' => $title !== null ? substr((string)$title, 0, 255) : '',
            ':d' => $desc,
            ':g' => $tag !== null ? substr((string)$tag, 0, 80) : null,
        ]);
    }
}

function ev_valid_date(string $s): bool
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) return false;
    $dt = DateTime::createFromFormat('Y-m-d', $s);
    return $dt && $dt->format('Y-m-d') === $s;
}
