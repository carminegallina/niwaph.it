<?php
// Copyright (c) 2026 Carmine Gallina - https://github.com/carminegallina
/**
 * NIWA.PH — Helper condivisi per gli endpoint API.
 *
 * Funzionalità:
 *  - niwa_require_admin()  : protegge un endpoint richiedendo sessione valida.
 *  - niwa_read_json_body() : legge e valida il body JSON.
 *  - niwa_int(), niwa_str(): coercion helpers semplici.
 */

declare(strict_types=1);

require_once __DIR__ . '/_db.php';
require_once __DIR__ . '/admin/_session.php';

/**
 * Termina la richiesta se non c'è una sessione admin valida.
 * Restituisce i dati admin se autenticato.
 *
 * @return array{id_admin:int, username:string, display_name:string}
 */
function niwa_require_admin(): array
{
    try {
        $u = niwa_session_validate();
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
    if ($u === null) {
        niwa_json(401, ['ok' => false, 'error' => 'unauthorized']);
    }
    return $u;
}

/**
 * Legge il body JSON. Termina con 400 se non è JSON valido o non è un oggetto.
 *
 * @return array<string,mixed>
 */
function niwa_read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        niwa_json(400, ['ok' => false, 'error' => 'bad_request']);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        niwa_json(400, ['ok' => false, 'error' => 'bad_request']);
    }
    return $data;
}

/**
 * Estrae un intero da un array, opzionalmente con default.
 */
function niwa_int(array $src, string $key, ?int $default = null): ?int
{
    if (!array_key_exists($key, $src) || $src[$key] === null || $src[$key] === '') {
        return $default;
    }
    return (int) $src[$key];
}

/**
 * Estrae una stringa da un array, trimmata. Restituisce null se assente/vuota.
 */
function niwa_str(array $src, string $key, ?string $default = null): ?string
{
    if (!isset($src[$key])) {
        return $default;
    }
    $v = trim((string) $src[$key]);
    return $v === '' ? $default : $v;
}

/**
 * Slug seguro: solo a-z 0-9 -, max 80 char.
 */
function niwa_slugify(string $s): string
{
    $s = strtolower(trim($s));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s) ?? '';
    $s = trim($s, '-');
    return substr($s, 0, 80);
}
