<?php
/**
 * NIWA.PH — GET /api/thumb.php?src=/uploads/photos/foo.jpg&w=800
 *
 * Ridimensiona una foto e tiene il risultato in uploads/cache/w<N>/.
 * Serve a non spedire al browser gli originali da 5-14 MB.
 *
 * Se GD non c'è, se il file è più piccolo della larghezza richiesta, o se
 * qualcosa fallisce, si serve l'originale: il sito funziona comunque.
 */

declare(strict_types=1);

const NIWA_THUMB_WIDTHS = [400, 800, 1600];
const NIWA_THUMB_QUALITY = 82;

$src = (string) ($_GET['src'] ?? '');
$w   = (int) ($_GET['w'] ?? 1600);
if (!in_array($w, NIWA_THUMB_WIDTHS, true)) {
    $w = 1600; // niente larghezze arbitrarie: riempirebbero la cache
}

// Solo file dentro /uploads/photos/, nessun ../ e nessuna estensione strana.
if (!preg_match('#^/uploads/photos/([A-Za-z0-9._-]+)\.(jpe?g|png|webp)$#i', $src, $m)) {
    http_response_code(400);
    exit;
}

$root = dirname(__DIR__);
$orig = $root . $src;
if (!is_file($orig)) {
    http_response_code(404);
    exit;
}

/**
 * Manda un file al browser come immagine cacheabile a lungo.
 * I nomi dei file contengono già un hash, quindi non cambiano mai contenuto.
 */
function niwa_thumb_send(string $path, string $mime): void
{
    $mtime = (int) filemtime($path);
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: public, max-age=31536000, immutable');
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');
    header('X-Content-Type-Options: nosniff');
    readfile($path);
    exit;
}

$mimeByExt = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
$origMime  = $mimeByExt[strtolower($m[2])] ?? 'image/jpeg';

$cacheDir  = $root . '/uploads/cache/w' . $w;
$cacheFile = $cacheDir . '/' . $m[1] . '.jpg';

if (is_file($cacheFile)) {
    niwa_thumb_send($cacheFile, 'image/jpeg');
}

// --- Generazione ---
// Decomprimere un JPEG da 24 Mpx costa ~100 MB: alziamo il limite se possibile.
@ini_set('memory_limit', '512M');

$size = @getimagesize($orig);
if (!function_exists('imagecreatefromjpeg') || $size === false || (int) $size[0] <= $w) {
    // GD assente o foto già abbastanza piccola: l'originale va benissimo.
    niwa_thumb_send($orig, $origMime);
}

try {
    switch ($origMime) {
        case 'image/png':  $im = @imagecreatefrompng($orig); break;
        case 'image/webp': $im = @imagecreatefromwebp($orig); break;
        default:           $im = @imagecreatefromjpeg($orig); break;
    }
    if (!$im) {
        niwa_thumb_send($orig, $origMime);
    }

    // ponytail: nessuna rotazione EXIF — nessuna foto caricata finora ne ha
    // bisogno. Se un domani una foto esce ruotata, leggere Orientation qui
    // con exif_read_data() e applicare imagerotate().
    $small = imagescale($im, $w, -1, IMG_BICUBIC);
    imagedestroy($im);
    if (!$small) {
        niwa_thumb_send($orig, $origMime);
    }

    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0775, true);
    }
    // Scrittura atomica: evita che una richiesta parallela legga un file a metà.
    $tmp = $cacheFile . '.' . getmypid() . '.tmp';
    imageinterlace($small, true); // JPEG progressivo: si vede prima
    $ok = imagejpeg($small, $tmp, NIWA_THUMB_QUALITY);
    imagedestroy($small);

    if (!$ok || !@rename($tmp, $cacheFile)) {
        @unlink($tmp);
        niwa_thumb_send($orig, $origMime);
    }

    niwa_thumb_send($cacheFile, 'image/jpeg');
} catch (Throwable $e) {
    error_log('niwa thumb: ' . $e->getMessage());
    niwa_thumb_send($orig, $origMime);
}
