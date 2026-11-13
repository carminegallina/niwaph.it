<?php
/**
 * NIWA.PH — Helper di sessione admin.
 *
 * Le sessioni admin NON usano il sistema $_SESSION di PHP per due motivi:
 *  1) Vogliamo controllo totale sulla scadenza e sull'invalidazione lato DB.
 *  2) Il token va legato all'IP del client (mitigazione session hijack).
 *
 * Schema cookie:
 *   nome:    niwa_admin
 *   valore:  64 hex chars (token random 32 byte)
 *   flags:   HttpOnly + Secure + SameSite=Strict
 *   path:    /api/admin
 *   scadenza: 2 ore di inattività (rolling)
 *
 * Tabella richiesta nel DB (admin_session):
 *   token_hash CHAR(64) PRIMARY KEY  -- SHA-256 del token, mai il token in chiaro
 *   id_admin   INT UNSIGNED NOT NULL FK admin_user.id_admin
 *   ip_address VARCHAR(45) NOT NULL
 *   user_agent VARCHAR(255) NULL
 *   created_at DATETIME NOT NULL
 *   expires_at DATETIME NOT NULL
 *   INDEX (id_admin), INDEX (expires_at)
 */

declare(strict_types=1);

require_once __DIR__ . '/../_db.php';

const NIWA_COOKIE_NAME    = 'niwa_admin';
const NIWA_SESSION_TTL    = 7200;   // 2 ore
const NIWA_RATELIMIT_WIN  = 900;    // 15 minuti
const NIWA_RATELIMIT_MAX  = 5;      // tentativi falliti consentiti per IP
const NIWA_BIND_TO_IP     = true;   // se true, sessione invalidata se cambia IP

/**
 * Genera un nuovo token di sessione e lo salva su DB.
 * Restituisce il token in chiaro da impostare nel cookie.
 */
function niwa_session_create(int $idAdmin, string $userAgent): string
{
    $token = bin2hex(random_bytes(32)); // 64 hex
    $hash  = hash('sha256', $token);

    $expiresAt = (new DateTimeImmutable('+' . NIWA_SESSION_TTL . ' seconds'))
        ->format('Y-m-d H:i:s');
    $createdAt = (new DateTimeImmutable())->format('Y-m-d H:i:s');

    $sql = 'INSERT INTO admin_session
            (token_hash, id_admin, ip_address, user_agent, created_at, expires_at)
            VALUES (:h, :u, :ip, :ua, :c, :e)';
    $st = niwa_db()->prepare($sql);
    $st->execute([
        ':h'  => $hash,
        ':u'  => $idAdmin,
        ':ip' => niwa_client_ip(),
        ':ua' => substr($userAgent, 0, 255),
        ':c'  => $createdAt,
        ':e'  => $expiresAt,
    ]);

    niwa_session_set_cookie($token);
    return $token;
}

/**
 * Imposta il cookie di sessione con tutte le flag di sicurezza.
 */
function niwa_session_set_cookie(string $token): void
{
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? null) == 443);

    setcookie(NIWA_COOKIE_NAME, $token, [
        'expires'  => time() + NIWA_SESSION_TTL,
        'path'     => '/api/admin',
        'secure'   => $isHttps,   // in produzione sarà sempre true
        'httponly' => true,        // non accessibile da JavaScript
        'samesite' => 'Strict',    // blocca CSRF cross-site
    ]);
}

/**
 * Rimuove il cookie di sessione lato browser.
 */
function niwa_session_clear_cookie(): void
{
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? null) == 443);

    setcookie(NIWA_COOKIE_NAME, '', [
        'expires'  => time() - 3600,
        'path'     => '/api/admin',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

/**
 * Verifica il token presente nel cookie. Se valido, ne estende la scadenza
 * (rolling session) e restituisce i dati admin. Altrimenti restituisce null.
 *
 * @return array{id_admin:int, username:string, display_name:string}|null
 */
function niwa_session_validate(): ?array
{
    $token = $_COOKIE[NIWA_COOKIE_NAME] ?? '';
    if (!is_string($token) || strlen($token) !== 64 || !ctype_xdigit($token)) {
        return null;
    }
    $hash = hash('sha256', $token);

    $sql = 'SELECT s.id_admin, s.expires_at, s.ip_address,
                   a.username, a.display_name, a.is_active
            FROM admin_session s
            JOIN admin_user a ON a.id_admin = s.id_admin
            WHERE s.token_hash = :h
            LIMIT 1';
    $st = niwa_db()->prepare($sql);
    $st->execute([':h' => $hash]);
    $row = $st->fetch();

    if (!$row) {
        return null;
    }
    if ((int)$row['is_active'] !== 1) {
        niwa_session_destroy_by_hash($hash);
        return null;
    }
    if (strtotime((string)$row['expires_at']) < time()) {
        niwa_session_destroy_by_hash($hash);
        return null;
    }
    if (NIWA_BIND_TO_IP && $row['ip_address'] !== niwa_client_ip()) {
        // IP cambiato: per prudenza invalidiamo la sessione.
        niwa_session_destroy_by_hash($hash);
        return null;
    }

    // Rolling: estende la scadenza
    $newExp = (new DateTimeImmutable('+' . NIWA_SESSION_TTL . ' seconds'))
        ->format('Y-m-d H:i:s');
    $up = niwa_db()->prepare(
        'UPDATE admin_session SET expires_at = :e WHERE token_hash = :h'
    );
    $up->execute([':e' => $newExp, ':h' => $hash]);

    // Rinnova anche il cookie lato browser
    niwa_session_set_cookie($token);

    return [
        'id_admin'     => (int)$row['id_admin'],
        'username'     => (string)$row['username'],
        'display_name' => (string)$row['display_name'],
    ];
}

/**
 * Elimina la sessione corrente (logout).
 */
function niwa_session_destroy_current(): void
{
    $token = $_COOKIE[NIWA_COOKIE_NAME] ?? '';
    if (is_string($token) && strlen($token) === 64 && ctype_xdigit($token)) {
        niwa_session_destroy_by_hash(hash('sha256', $token));
    }
    niwa_session_clear_cookie();
}

function niwa_session_destroy_by_hash(string $hash): void
{
    $st = niwa_db()->prepare('DELETE FROM admin_session WHERE token_hash = :h');
    $st->execute([':h' => $hash]);
}

/**
 * Pulizia opportunistica delle sessioni scadute. Chiamabile in login.php
 * con una piccola probabilità per evitare di sporcare ogni richiesta.
 */
function niwa_session_gc(): void
{
    if (mt_rand(1, 100) === 1) { // ~1% delle richieste di login
        niwa_db()->exec('DELETE FROM admin_session WHERE expires_at < NOW()');
    }
}

/* ================================================================
 * Rate limiting login per IP
 * ================================================================
 *
 * Tabella richiesta (admin_login_attempt):
 *   id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
 *   ip_address  VARCHAR(45) NOT NULL
 *   username    VARCHAR(60) NULL
 *   success     TINYINT(1)  NOT NULL
 *   created_at  DATETIME    NOT NULL
 *   INDEX (ip_address, created_at)
 */

/**
 * Controlla se l'IP corrente è bloccato per troppi tentativi falliti.
 * Restituisce il numero di secondi da attendere, oppure 0 se può procedere.
 */
function niwa_login_rate_limit_check(): int
{
    $ip = niwa_client_ip();
    $sql = 'SELECT COUNT(*) AS n, MIN(created_at) AS oldest
            FROM admin_login_attempt
            WHERE ip_address = :ip
              AND success = 0
              AND created_at >= (NOW() - INTERVAL :win SECOND)';
    $st = niwa_db()->prepare($sql);
    $st->bindValue(':ip', $ip);
    $st->bindValue(':win', NIWA_RATELIMIT_WIN, PDO::PARAM_INT);
    $st->execute();
    $row = $st->fetch();

    $n = (int)($row['n'] ?? 0);
    if ($n < NIWA_RATELIMIT_MAX) {
        return 0;
    }
    $oldest = strtotime((string)$row['oldest']);
    $unlockAt = $oldest + NIWA_RATELIMIT_WIN;
    return max(1, $unlockAt - time());
}

/**
 * Registra un tentativo di login (riuscito o fallito).
 */
function niwa_login_record_attempt(?string $username, bool $success): void
{
    $st = niwa_db()->prepare(
        'INSERT INTO admin_login_attempt (ip_address, username, success, created_at)
         VALUES (:ip, :u, :s, NOW())'
    );
    $st->execute([
        ':ip' => niwa_client_ip(),
        ':u'  => $username !== null ? substr($username, 0, 60) : null,
        ':s'  => $success ? 1 : 0,
    ]);

    // Pulizia opportunistica delle righe vecchie (no-op nella maggior parte dei casi)
    if (mt_rand(1, 50) === 1) {
        niwa_db()->exec(
            'DELETE FROM admin_login_attempt
             WHERE created_at < (NOW() - INTERVAL 7 DAY)'
        );
    }
}
