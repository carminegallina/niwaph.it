<?php
// Copyright (c) 2026 Carmine Gallina - https://github.com/carminegallina
/**
 * NIWA.PH — GET /api/social.php
 *
 * Restituisce i link social attivi mostrati nella pagina Contatti.
 * L'icona è quella scelta dall'admin (se presente) o auto-dedotta
 * dall'host dell'url per i social più comuni.
 *
 * Risposta:
 *   200 [
 *     { id, label, url, icon }, ...
 *   ]
 */

declare(strict_types=1);

require_once __DIR__ . '/_db.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    niwa_json(405, ['error' => 'method_not_allowed']);
}

/**
 * Auto-detect dell'icona dal dominio dell'url, se l'admin non l'ha
 * impostata esplicitamente. Mappa coerente con quella usata nel client
 * (vedi app-pages.jsx, SOCIAL_ICONS).
 */
function niwa_detect_social_icon(string $url): string
{
    $host = parse_url($url, PHP_URL_HOST) ?: '';
    $host = strtolower($host);
    if ($host === '') return 'link';

    $map = [
        'instagram.com'  => 'instagram',
        'facebook.com'   => 'facebook',
        'tiktok.com'     => 'tiktok',
        'youtube.com'    => 'youtube',
        'youtu.be'       => 'youtube',
        'twitter.com'    => 'twitter',
        'x.com'          => 'twitter',
        'linkedin.com'   => 'linkedin',
        'behance.net'    => 'behance',
        'vimeo.com'      => 'vimeo',
        'pinterest.com'  => 'pinterest',
        't.me'           => 'telegram',
        'telegram.me'    => 'telegram',
        'wa.me'          => 'whatsapp',
        'whatsapp.com'   => 'whatsapp',
    ];
    foreach ($map as $domain => $icon) {
        // Match esatto o sottodominio (es. "www.instagram.com")
        if ($host === $domain || str_ends_with($host, '.' . $domain)) {
            return $icon;
        }
    }
    return 'link';
}

try {
    $rows = niwa_db()->query(
        "SELECT id_social, label, url, icon
           FROM social_link
          WHERE is_active = 1
          ORDER BY sort_order ASC, id_social ASC"
    )->fetchAll();

    $out = [];
    foreach ($rows as $r) {
        $icon = $r['icon'];
        if (!$icon || $icon === '' || $icon === 'auto') {
            $icon = niwa_detect_social_icon((string)$r['url']);
        }
        $out[] = [
            'id'    => (int)$r['id_social'],
            'label' => (string)$r['label'],
            'url'   => (string)$r['url'],
            'icon'  => $icon,
        ];
    }
    niwa_json(200, $out);
} catch (Throwable $e) {
    niwa_json(500, ['error' => 'server_error']);
}
