<?php
/**
 * NIWA.PH — /api/admin/social.php
 *
 * GET    elenco social (anche disattivati)
 * POST   crea social   { label, url, icon?, sort_order?, is_active? }
 * PUT    aggiorna ?id=<id>
 * DELETE elimina  ?id=<id>
 */

declare(strict_types=1);

require_once __DIR__ . '/../_helpers.php';

niwa_require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
switch ($method) {
    case 'GET':    sl_list(); break;
    case 'POST':   sl_create(); break;
    case 'PUT':    sl_update(); break;
    case 'DELETE': sl_delete(); break;
    default:
        niwa_json(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

function sl_list(): void
{
    try {
        $rows = niwa_db()->query(
            "SELECT id_social, label, url, icon, sort_order, is_active
               FROM social_link
              ORDER BY sort_order ASC, id_social ASC"
        )->fetchAll();
        $out = array_map(fn($r) => [
            'id'         => (int)$r['id_social'],
            'label'      => (string)$r['label'],
            'url'        => (string)$r['url'],
            'icon'       => $r['icon'],
            'sort_order' => (int)$r['sort_order'],
            'is_active'  => (int)$r['is_active'] === 1,
        ], $rows);
        niwa_json(200, $out);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function sl_validate_url(string $u): bool
{
    if ($u === '') return false;
    return (bool)filter_var($u, FILTER_VALIDATE_URL)
        && (str_starts_with($u, 'http://') || str_starts_with($u, 'https://'));
}

function sl_create(): void
{
    $body  = niwa_read_json_body();
    $label = trim((string)niwa_str($body, 'label', ''));
    $url   = trim((string)niwa_str($body, 'url', ''));
    $icon  = niwa_str($body, 'icon'); // può essere null
    if ($label === '' || !sl_validate_url($url)) {
        niwa_json(400, ['ok' => false, 'error' => 'invalid_input']);
    }
    try {
        $st = niwa_db()->prepare(
            "INSERT INTO social_link (label, url, icon, sort_order, is_active)
                  VALUES (:l, :u, :i, :so, :ia)"
        );
        $st->execute([
            ':l'  => substr($label, 0, 80),
            ':u'  => substr($url,   0, 500),
            ':i'  => $icon !== null ? substr((string)$icon, 0, 40) : null,
            ':so' => niwa_int($body, 'sort_order', 0),
            ':ia' => isset($body['is_active']) ? ($body['is_active'] ? 1 : 0) : 1,
        ]);
        niwa_json(201, ['ok' => true, 'id' => (int)niwa_db()->lastInsertId()]);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function sl_update(): void
{
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) niwa_json(400, ['ok' => false, 'error' => 'invalid_id']);
    $body = niwa_read_json_body();
    $sets = []; $args = [':i' => $id];
    if (isset($body['label']))      { $sets[] = "label = :l";  $args[':l']  = substr(trim((string)$body['label']), 0, 80); }
    if (isset($body['url'])) {
        $u = trim((string)$body['url']);
        if (!sl_validate_url($u)) niwa_json(400, ['ok' => false, 'error' => 'invalid_url']);
        $sets[] = "url = :u";  $args[':u'] = substr($u, 0, 500);
    }
    if (array_key_exists('icon', $body)) {
        $sets[] = "icon = :ic";
        $args[':ic'] = ($body['icon'] === null || $body['icon'] === '') ? null : substr((string)$body['icon'], 0, 40);
    }
    if (isset($body['sort_order'])) { $sets[] = "sort_order = :so"; $args[':so'] = (int)$body['sort_order']; }
    if (isset($body['is_active']))  { $sets[] = "is_active = :ia";  $args[':ia'] = $body['is_active'] ? 1 : 0; }
    if (empty($sets)) niwa_json(400, ['ok' => false, 'error' => 'nothing_to_update']);
    try {
        niwa_db()->prepare("UPDATE social_link SET " . implode(', ', $sets) . " WHERE id_social = :i")
            ->execute($args);
        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}

function sl_delete(): void
{
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) niwa_json(400, ['ok' => false, 'error' => 'invalid_id']);
    try {
        niwa_db()->prepare("DELETE FROM social_link WHERE id_social = :i")
            ->execute([':i' => $id]);
        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}
