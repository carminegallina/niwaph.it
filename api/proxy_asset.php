<?php
// Copyright (c) 2026 Carmine Gallina - https://github.com/carminegallina
/**
 * NIWA.PH — GET /api/proxy_asset.php?url=https://...
 *
 * Scarica lato server un'immagine/video ESTERNO e lo ritrasmette al browser.
 * Serve solo ai media demo (il seed in data.js) e al segnaposto dell'admin:
 * i media veri stanno tutti in /uploads/ e non passano di qui.
 *
 * Senza la whitelist qui sotto chiunque potrebbe usare questo endpoint per far
 * scaricare al server un URL qualsiasi, compresi indirizzi della rete interna
 * di Aruba, e per far uscire contenuti arbitrari dal dominio del sito.
 */

declare(strict_types=1);

require_once __DIR__ . '/_db.php';

// Host da cui e' lecito scaricare. Aggiungerne altri solo se servono davvero.
const NIWA_PROXY_HOSTS = [
    'images.unsplash.com',
    'commondatastorage.googleapis.com',
];

// 20 MB: i video di esempio sono piu' piccoli, oltre e' qualcosa che non ci aspettiamo.
const NIWA_PROXY_MAX_BYTES = 20971520;

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    niwa_json(405, ['error' => 'method_not_allowed']);
}

$url = (string)($_GET['url'] ?? '');
$parts = parse_url($url);
if (!is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || !isset($parts['host'])) {
    niwa_json(400, ['error' => 'bad_request']);
}
if (!in_array(strtolower($parts['host']), NIWA_PROXY_HOSTS, true)) {
    niwa_json(403, ['error' => 'host_not_allowed']);
}

$headers = [
    'User-Agent: NiwaProxy/1.0',
    'Accept: */*',
];

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 5,
    // Solo HTTPS, anche dopo un redirect: niente file://, gopher://, ftp://
    CURLOPT_PROTOCOLS      => CURLPROTO_HTTPS,
    CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT        => 20,
    CURLOPT_MAXFILESIZE    => NIWA_PROXY_MAX_BYTES,
    CURLOPT_HTTPHEADER     => $headers,
]);
$body = curl_exec($ch);
$err  = curl_error($ch);
$info = curl_getinfo($ch);
curl_close($ch);

if ($body === false || $err) {
    niwa_json(502, ['error' => 'proxy_failed']);
}

$status = (int)($info['http_code'] ?? 200);
$contentType = (string)($info['content_type'] ?? 'application/octet-stream');
if ($status < 200 || $status >= 400) {
    niwa_json($status ?: 502, ['error' => 'proxy_failed']);
}

// Ritrasmettiamo solo immagini e video: un text/html servito dal nostro dominio
// diventerebbe una pagina nostra a tutti gli effetti.
if (!preg_match('#^(image|video)/#i', $contentType)) {
    niwa_json(415, ['error' => 'unsupported_type']);
}
if (strlen($body) > NIWA_PROXY_MAX_BYTES) {
    niwa_json(502, ['error' => 'too_large']);
}

http_response_code(200);
header('Content-Type: ' . $contentType);
header('Content-Length: ' . strlen($body));
header('Cache-Control: public, max-age=86400');
header('X-Content-Type-Options: nosniff');
echo $body;
