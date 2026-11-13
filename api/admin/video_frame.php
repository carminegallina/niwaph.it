<?php
/**
 * NIWA.PH — POST /api/admin/video_frame.php
 *
 * Riceve un'immagine (estratta lato browser da un video tramite <canvas>)
 * e la associa al media indicato come "carousel_frame_url": questo è il
 * frame statico che apparirà nel carosello home al posto del video.
 *
 * Form multipart/form-data:
 *   file:     File immagine (image/jpeg, image/png, image/webp)
 *   id_media: id_media del video di destinazione
 *
 * Risposta:
 *   200 { ok:true, carousel_frame_url:"/uploads/photos/..." }
 *   400 { ok:false, error:"bad_request"|"invalid_mime"|"too_large"|"media_not_found" }
 *   401 { ok:false, error:"unauthorized" }
 *
 * DELETE: rimuove il frame copertina dal media (e dal disco se possibile).
 *   ?id=<id_media>
 */

declare(strict_types=1);

require_once __DIR__ . '/../_helpers.php';

niwa_require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'DELETE') {
    handle_delete_frame();
    exit;
}
if ($method !== 'POST') {
    niwa_json(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

// --- Validate input ----------------------------------------------------
if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
    niwa_json(400, ['ok' => false, 'error' => 'bad_request']);
}
$f = $_FILES['file'];
if (($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    niwa_json(400, ['ok' => false, 'error' => 'bad_request']);
}

$idMedia = (int)($_POST['id_media'] ?? 0);
if ($idMedia <= 0) {
    niwa_json(400, ['ok' => false, 'error' => 'invalid_id_media']);
}

// Verify media exists and is a video (frame from non-video has no sense)
try {
    $st = niwa_db()->prepare("SELECT id_media, type, carousel_frame_url FROM media WHERE id_media = :i LIMIT 1");
    $st->execute([':i' => $idMedia]);
    $existing = $st->fetch();
    if (!$existing) niwa_json(400, ['ok' => false, 'error' => 'media_not_found']);
    if ($existing['type'] !== 'video') {
        niwa_json(400, ['ok' => false, 'error' => 'media_not_video']);
    }
} catch (Throwable $e) {
    niwa_json(500, ['ok' => false, 'error' => 'server_error']);
}

// --- Validate mime ----------------------------------------------------
$tmpPath = $f['tmp_name'];
$size    = (int)($f['size'] ?? 0);
if ($size <= 0 || $size > 10 * 1024 * 1024) {
    niwa_json(400, ['ok' => false, 'error' => 'too_large']);
}

// finfo strict
$finfo = @finfo_open(FILEINFO_MIME_TYPE);
$mime  = $finfo ? @finfo_file($finfo, $tmpPath) : '';
if ($finfo) finfo_close($finfo);

$allowed = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
];
if (!isset($allowed[$mime])) {
    niwa_json(400, ['ok' => false, 'error' => 'invalid_mime']);
}
$ext = $allowed[$mime];

// --- Save to disk -----------------------------------------------------
$unique = bin2hex(random_bytes(4));
$finalName = 'frame-m' . $idMedia . '-' . date('Ymd-His') . '-' . $unique . '.' . $ext;

$absDir = realpath(__DIR__ . '/../../uploads');
if (!$absDir) {
    @mkdir(__DIR__ . '/../../uploads', 0755, true);
    $absDir = realpath(__DIR__ . '/../../uploads');
}
$targetDir = $absDir . DIRECTORY_SEPARATOR . 'photos';
if (!is_dir($targetDir)) {
    @mkdir($targetDir, 0755, true);
}
$absTarget = $targetDir . DIRECTORY_SEPARATOR . $finalName;
$publicUrl = '/uploads/photos/' . $finalName;

if (!@move_uploaded_file($tmpPath, $absTarget)) {
    niwa_json(500, ['ok' => false, 'error' => 'server_error']);
}

// --- Update DB --------------------------------------------------------
try {
    // Se esisteva già un frame precedente, lo cancelliamo dal disco
    // per non lasciare file orfani.
    $previousUrl = $existing['carousel_frame_url'] ?? null;
    if ($previousUrl && str_starts_with($previousUrl, '/uploads/photos/')) {
        $previousAbs = $absDir . DIRECTORY_SEPARATOR . 'photos' . DIRECTORY_SEPARATOR . basename($previousUrl);
        if (is_file($previousAbs)) {
            @unlink($previousAbs);
        }
    }

    $up = niwa_db()->prepare("UPDATE media SET carousel_frame_url = :u WHERE id_media = :i");
    $up->execute([':u' => $publicUrl, ':i' => $idMedia]);

    niwa_json(200, ['ok' => true, 'carousel_frame_url' => $publicUrl]);
} catch (Throwable $e) {
    // In caso di errore DB cancelliamo anche il file appena caricato
    @unlink($absTarget);
    niwa_json(500, ['ok' => false, 'error' => 'server_error']);
}

function handle_delete_frame(): void
{
    $idMedia = (int)($_GET['id'] ?? 0);
    if ($idMedia <= 0) niwa_json(400, ['ok' => false, 'error' => 'invalid_id']);

    try {
        $st = niwa_db()->prepare("SELECT carousel_frame_url FROM media WHERE id_media = :i LIMIT 1");
        $st->execute([':i' => $idMedia]);
        $row = $st->fetch();
        if (!$row) niwa_json(400, ['ok' => false, 'error' => 'media_not_found']);

        $url = $row['carousel_frame_url'];
        if ($url && str_starts_with($url, '/uploads/photos/')) {
            $absDir = realpath(__DIR__ . '/../../uploads');
            $abs    = $absDir . DIRECTORY_SEPARATOR . 'photos' . DIRECTORY_SEPARATOR . basename($url);
            if (is_file($abs)) @unlink($abs);
        }

        niwa_db()->prepare("UPDATE media SET carousel_frame_url = NULL WHERE id_media = :i")
            ->execute([':i' => $idMedia]);

        niwa_json(200, ['ok' => true]);
    } catch (Throwable $e) {
        niwa_json(500, ['ok' => false, 'error' => 'server_error']);
    }
}
