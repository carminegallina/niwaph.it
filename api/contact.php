<?php
/**
 * NIWA.PH — POST /api/contact.php
 *
 * Riceve un messaggio dal form contatti del sito pubblico e lo salva
 * nella tabella contact_message.
 *
 * Body JSON: { name, email, subject, message }
 *
 * Risposta:
 *   200 { ok:true }
 *   400 { ok:false, error:"bad_request" }
 *   429 { ok:false, error:"rate_limited" }
 *   500 { ok:false, error:"server_error" }
 *
 * Anti-spam:
 *  - Max 5 invii per IP / ora (riusa admin_login_attempt? no: tabella nuova).
 *    In questo file usiamo una piccola finestra basata sui created_at recenti
 *    della stessa contact_message dallo stesso IP.
 *  - Honeypot opzionale: se il campo "website" è valorizzato, ignoriamo.
 */

declare(strict_types=1);

require_once __DIR__ . '/_db.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    niwa_json(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);
if (!is_array($body)) {
    niwa_json(400, ['ok' => false, 'error' => 'bad_request']);
}

// Honeypot
if (!empty($body['website'])) {
    // Fingiamo successo per non aiutare gli spammer a iterare.
    niwa_json(200, ['ok' => true]);
}

$name    = trim((string)($body['name']    ?? ''));
$email   = trim((string)($body['email']   ?? ''));
$subject = trim((string)($body['subject'] ?? ''));
$message = trim((string)($body['message'] ?? ''));

if ($name === '' || $email === '' || $subject === '' || $message === ''
    || strlen($name) > 160 || strlen($email) > 190
    || strlen($subject) > 160 || strlen($message) > 5000
    || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    niwa_json(400, ['ok' => false, 'error' => 'bad_request']);
}

$ip = niwa_client_ip();
$ua = substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);

try {
    // Anti-flood: max N messaggi / X minuti dallo stesso IP.
    // I limiti sono modificabili dall'admin via pannello "Testi del sito":
    //   contact.rate_limit_max     → max messaggi (default 5, fallback se vuoto/invalido)
    //   contact.rate_limit_window  → finestra in minuti (default 60)
    // Si legge dalla prima lingua disponibile (admin scrive lo stesso valore
    // in IT e EN, ma noi prendiamo quello che troviamo).
    $cfg = niwa_db()->query(
        "SELECT key_path, value FROM site_text
          WHERE key_path IN ('contact.rate_limit_max','contact.rate_limit_window')"
    )->fetchAll();
    $maxMessages = 5;
    $windowMin   = 60;
    foreach ($cfg as $row) {
        $val = (int)($row['value'] ?? 0);
        if ($val <= 0) continue; // valori invalidi → mantieni default
        if ($row['key_path'] === 'contact.rate_limit_max')    $maxMessages = $val;
        if ($row['key_path'] === 'contact.rate_limit_window') $windowMin   = $val;
    }
    // Hard cap di sicurezza: la finestra non può eccedere 1 giorno e il
    // numero di messaggi non può eccedere 100 (anche se l'admin scrive di più,
    // sarebbe un errore di battitura). Questo impedisce abusi accidentali.
    if ($maxMessages > 100) $maxMessages = 100;
    if ($windowMin   > 1440) $windowMin  = 1440;

    $st = niwa_db()->prepare(
        "SELECT COUNT(*) AS n FROM contact_message
          WHERE ip_address = :ip
            AND created_at >= (NOW() - INTERVAL :w MINUTE)"
    );
    // PDO non bind diretto su INTERVAL — uso un cast int sicuro
    $st->bindValue(':ip', $ip, PDO::PARAM_STR);
    $st->bindValue(':w',  $windowMin, PDO::PARAM_INT);
    $st->execute();
    $n = (int)($st->fetch()['n'] ?? 0);
    if ($n >= $maxMessages) {
        niwa_json(429, ['ok' => false, 'error' => 'rate_limited']);
    }

    $ins = niwa_db()->prepare(
        "INSERT INTO contact_message
            (name, email, subject, message, status, ip_address, user_agent, created_at)
         VALUES (:n, :e, :s, :m, 'new', :ip, :ua, NOW())"
    );
    $ins->execute([
        ':n'  => $name,
        ':e'  => $email,
        ':s'  => $subject,
        ':m'  => $message,
        ':ip' => $ip,
        ':ua' => $ua,
    ]);

    niwa_json(200, ['ok' => true]);
} catch (Throwable $e) {
    niwa_json(500, ['ok' => false, 'error' => 'server_error']);
}
