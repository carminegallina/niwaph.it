<?php
// Copyright (c) 2026 Carmine Gallina - https://github.com/carminegallina
/**
 * NIWA.PH — POST /api/admin/login.php
 *
 * Body JSON:
 *   { "username": "carmine", "password": "..." }
 *
 * Risposte:
 *   200 { ok:true,  username, display_name }
 *   400 { ok:false, error:"bad_request" }
 *   401 { ok:false, error:"invalid_credentials" }
 *   429 { ok:false, error:"rate_limited", retry_after: <int> }
 *   500 { ok:false, error:"server_error" }
 *
 * Note di sicurezza:
 *  - La password viene confrontata con password_verify() (bcrypt, costante in tempo).
 *  - In caso di utente inesistente eseguiamo comunque un hash dummy per
 *    evitare timing leak che riveli "username valido vs invalido".
 *  - Gli errori non distinguono "utente sbagliato" da "password sbagliata".
 *  - Rate limit: 5 tentativi falliti per IP in 15 minuti.
 *  - Logout-all: alla nuova autenticazione possiamo invalidare le sessioni
 *    precedenti (commentato sotto, da abilitare se Carmine vuole questa policy).
 */

declare(strict_types=1);

require_once __DIR__ . '/../_db.php';
require_once __DIR__ . '/_session.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    niwa_json(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

// Pulizia opportunistica delle sessioni scadute
niwa_session_gc();

// Lettura body JSON
$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);
if (!is_array($body)) {
    niwa_json(400, ['ok' => false, 'error' => 'bad_request']);
}

$username = isset($body['username']) ? trim((string)$body['username']) : '';
$password = isset($body['password']) ? (string)$body['password']    : '';

if ($username === '' || $password === ''
    || strlen($username) > 60 || strlen($password) > 200) {
    niwa_json(400, ['ok' => false, 'error' => 'bad_request']);
}

// Rate limit per IP
try {
    $wait = niwa_login_rate_limit_check();
    if ($wait > 0) {
        niwa_json(429, [
            'ok'          => false,
            'error'       => 'rate_limited',
            'retry_after' => $wait,
        ]);
    }
} catch (Throwable $e) {
    niwa_json(500, ['ok' => false, 'error' => 'server_error']);
}

// Hash dummy per costanza temporale quando l'utente non esiste.
// Genera un hash bcrypt della stringa vuota la prima volta.
$dummyHash = '$2y$10$Jr1QfoUQLp6PoUZYdxV9nuJ8rO8U8bM0zV9k0r5Z0K0P0J0K0K0K2';

try {
    $st = niwa_db()->prepare(
        'SELECT id_admin, username, display_name, password_hash, is_active
         FROM admin_user
         WHERE username = :u
         LIMIT 1'
    );
    $st->execute([':u' => $username]);
    $user = $st->fetch();

    $valid = false;
    if ($user && (int)$user['is_active'] === 1
        && is_string($user['password_hash']) && $user['password_hash'] !== '') {
        $valid = password_verify($password, $user['password_hash']);
    } else {
        // Esegue comunque una verify per pareggiare il tempo di risposta
        password_verify($password, $dummyHash);
    }

    // Registra il tentativo (success/fail) per il rate limit
    niwa_login_record_attempt($username, $valid);

    if (!$valid) {
        niwa_json(401, ['ok' => false, 'error' => 'invalid_credentials']);
    }

    // Rehash automatico se l'algoritmo/cost di default è cambiato
    if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
        $newHash = password_hash($password, PASSWORD_DEFAULT);
        $up = niwa_db()->prepare(
            'UPDATE admin_user SET password_hash = :h WHERE id_admin = :i'
        );
        $up->execute([':h' => $newHash, ':i' => (int)$user['id_admin']]);
    }

    // Politica opzionale: invalida tutte le sessioni precedenti dello stesso utente.
    // Decommenta se vuoi forzare un solo dispositivo connesso alla volta.
    // $del = niwa_db()->prepare('DELETE FROM admin_session WHERE id_admin = :i');
    // $del->execute([':i' => (int)$user['id_admin']]);

    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    niwa_session_create((int)$user['id_admin'], $ua);

    niwa_json(200, [
        'ok'           => true,
        'username'     => (string)$user['username'],
        'display_name' => (string)$user['display_name'],
    ]);
} catch (Throwable $e) {
    // Non esponiamo dettagli dell'errore al client
    niwa_json(500, ['ok' => false, 'error' => 'server_error']);
}
