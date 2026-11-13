<?php
/**
 * NIWA.PH — Connessione PDO al DB.
 *
 * Tutte le credenziali vanno definite in un file .env o, in alternativa,
 * direttamente qui SOLO se il file è fuori dalla document root.
 * In produzione, NON committare credenziali reali nel repository.
 */

declare(strict_types=1);

// ---- Hardening produzione ----
// Disattiva display_errors esplicitamente per essere sicuri che un'eccezione
// non mostri il dump dello stack (incluse credenziali DB) al browser.
// Gli errori vengono comunque scritti nel log del server, accessibile via Aruba.
$niwa_dev = getenv('NIWA_DEV') === '1';  // 1 solo in locale (vedi dev.bat)
ini_set('display_errors', $niwa_dev ? '1' : '0');
ini_set('display_startup_errors', $niwa_dev ? '1' : '0');
error_reporting(E_ALL);
ini_set('log_errors', '1');

// ---- Config DB ----
// Qui dentro non ci sono credenziali: stanno in _secrets.php, che non e'
// versionato e che il .htaccess non lascia raggiungere dal web (regola "^_").
// Le variabili d'ambiente hanno la precedenza, cosi' dev.bat puo' puntare al
// MySQL locale senza toccare niente. Modello: _secrets.example.php
$niwa_secrets = @include __DIR__ . '/_secrets.php';
if (!is_array($niwa_secrets)) {
    $niwa_secrets = [];
}

define('NIWA_DB_HOST', getenv('NIWA_DB_HOST') ?: ($niwa_secrets['host'] ?? 'localhost'));
define('NIWA_DB_NAME', getenv('NIWA_DB_NAME') ?: ($niwa_secrets['name'] ?? 'niwaph'));
define('NIWA_DB_USER', getenv('NIWA_DB_USER') ?: ($niwa_secrets['user'] ?? 'niwaph'));
define('NIWA_DB_PASS', getenv('NIWA_DB_PASS') ?: ($niwa_secrets['pass'] ?? ''));
const NIWA_DB_CHARSET = 'utf8mb4';

/**
 * Restituisce un'istanza PDO singleton per la durata della richiesta.
 *
 * @return PDO
 */
function niwa_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        NIWA_DB_HOST,
        NIWA_DB_NAME,
        NIWA_DB_CHARSET
    );

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false, // prepared statements veri
    ];

    $pdo = new PDO($dsn, NIWA_DB_USER, NIWA_DB_PASS, $options);
    return $pdo;
}

/**
 * Risponde con JSON e termina lo script.
 *
 * @param int   $status  HTTP status code
 * @param array $payload Dati da serializzare
 * @return never
 */
function niwa_json(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Restituisce un identificativo dell'IP client, troncato per il rate limit.
 * Non logga IP per query, è solo per il binding del cookie/sessione.
 */
function niwa_client_ip(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    // NB: se sei dietro a un proxy/CDN affidabile, qui andrebbe gestito
    // X-Forwarded-For con whitelist del proxy.
    return substr($ip, 0, 45);
}
