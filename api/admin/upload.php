<?php
/**
 * NIWA.PH — POST /api/admin/upload.php
 *
 * Upload di un file (foto o video) e creazione automatica della riga media
 * con il file principale collegato. Richiede sessione admin.
 *
 * Form multipart/form-data:
 *   file:      File da caricare (image/jpeg, image/png, image/webp, video/mp4, video/webm)
 *   category:  slug categoria (default: prima attiva)
 *   preset:    slug preset (default: "niwa")
 *   aspect:    sq|tall|wide|pano|port (default: sq)
 *   visibility: draft|published|private (default: draft)
 *
 * Risposta:
 *   201 { ok:true, id_media, id, type, src, poster? }
 *   400 { ok:false, error:"bad_request"|"invalid_mime"|"too_large" }
 *   401 { ok:false, error:"unauthorized" }
 *   500 { ok:false, error:"server_error" }
 *
 * Limiti:
 *   - Max 50 MB per immagine, 200 MB per video.
 *   - Solo i MIME nella whitelist sopra.
 *   - Nome file sanificato e prefissato con timestamp+random per evitare collisioni.
 *   - I file vanno in /uploads/photos/ o /uploads/videos/ a seconda del tipo.
 *
 * Sicurezza:
 *   - Non si fida dell'estensione né del Content-Type del client: usa finfo/exif_imagetype.
 *   - Salva sempre con un nome generato dal server, mai con quello dell'utente.
 *   - La cartella /uploads ha un .htaccess che disabilita l'esecuzione PHP.
 */

declare(strict_types=1);

require_once __DIR__ . '/../_helpers.php';

niwa_require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    niwa_json(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
    niwa_json(400, ['ok' => false, 'error' => 'bad_request']);
}
$f = $_FILES['file'];

if (($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    $err = (int)($f['error'] ?? 0);
    if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) {
        niwa_json(400, ['ok' => false, 'error' => 'too_large']);
    }
    niwa_json(400, ['ok' => false, 'error' => 'upload_failed']);
}

$tmpPath = (string)$f['tmp_name'];
$origName = (string)($f['name'] ?? 'file');
$size = (int)($f['size'] ?? 0);

// Whitelist MIME → estensione canonica
$allowed = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
    'video/mp4'  => 'mp4',
    'video/webm' => 'webm',
];

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($tmpPath) ?: '';
if (!isset($allowed[$mime])) {
    niwa_json(400, ['ok' => false, 'error' => 'invalid_mime']);
}
$ext = $allowed[$mime];
$isVideo = str_starts_with($mime, 'video/');

// Limiti dimensione
$maxBytes = $isVideo ? (200 * 1024 * 1024) : (50 * 1024 * 1024);
if ($size <= 0 || $size > $maxBytes) {
    niwa_json(400, ['ok' => false, 'error' => 'too_large']);
}

// Per le immagini, doppio check con exif_imagetype
if (!$isVideo) {
    $imgType = @exif_imagetype($tmpPath);
    $okImg = ($imgType === IMAGETYPE_JPEG && $mime === 'image/jpeg')
          || ($imgType === IMAGETYPE_PNG  && $mime === 'image/png')
          || ($imgType === IMAGETYPE_WEBP && $mime === 'image/webp');
    if (!$okImg) {
        niwa_json(400, ['ok' => false, 'error' => 'invalid_mime']);
    }
}

// Costruisce un nome file sicuro
$baseName = pathinfo($origName, PATHINFO_FILENAME);
$slug = niwa_slugify($baseName);
if ($slug === '') $slug = 'media';
$unique = bin2hex(random_bytes(4));
$finalName = $slug . '-' . date('Ymd-His') . '-' . $unique . '.' . $ext;

// Cartella di destinazione
$subdir = $isVideo ? 'videos' : 'photos';
$absDir = realpath(__DIR__ . '/../../uploads');
if (!$absDir) {
    // Crea /uploads se non esiste (la prima volta)
    @mkdir(__DIR__ . '/../../uploads', 0755, true);
    $absDir = realpath(__DIR__ . '/../../uploads');
}
$targetDir = $absDir . DIRECTORY_SEPARATOR . $subdir;
if (!is_dir($targetDir)) {
    @mkdir($targetDir, 0755, true);
}
$absTarget = $targetDir . DIRECTORY_SEPARATOR . $finalName;
$publicUrl = '/uploads/' . $subdir . '/' . $finalName;

if (!@move_uploaded_file($tmpPath, $absTarget)) {
    niwa_json(500, ['ok' => false, 'error' => 'server_error']);
}

// Dimensioni immagine (per i video lasciamo NULL: serve ffprobe)
$wPx = null; $hPx = null;
if (!$isVideo) {
    $info = @getimagesize($absTarget);
    if (is_array($info)) {
        $wPx = (int)$info[0];
        $hPx = (int)$info[1];
    }
}

// Parametri post
$catSlug = niwa_str($_POST, 'category');
$preset  = niwa_str($_POST, 'preset', 'niwa');
$aspect  = niwa_str($_POST, 'aspect', 'sq');
$vis     = niwa_str($_POST, 'visibility', 'published');
// Nuovi parametri: in evidenza (per il carosello home) e mostra info
// (per la lightbox del visitatore). Letti dal modale di review pre-upload.
$feat    = isset($_POST['is_featured'])
    ? (filter_var($_POST['is_featured'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0)
    : 0;
$showInfo = isset($_POST['show_info'])
    ? (filter_var($_POST['show_info'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0)
    : 1;

if (!in_array($aspect, ['sq','tall','wide','pano','port'], true)) $aspect = 'sq';
if (!in_array($vis, ['draft','published','private'], true)) $vis = 'draft';

try {
    $pdo = niwa_db();
    $pdo->beginTransaction();

    // Risolve categoria (default: prima attiva per sort_order)
    if ($catSlug) {
        $st = $pdo->prepare("SELECT id_category FROM category WHERE slug = :s LIMIT 1");
        $st->execute([':s' => $catSlug]);
        $idCat = $st->fetchColumn();
    } else {
        $idCat = $pdo->query(
            "SELECT id_category FROM category WHERE is_active = 1
              ORDER BY sort_order ASC LIMIT 1"
        )->fetchColumn();
    }
    if (!$idCat) {
        $pdo->rollBack();
        @unlink($absTarget);
        niwa_json(400, ['ok' => false, 'error' => 'invalid_category']);
    }

    // Preset
    $idPreset = null;
    if ($preset && $preset !== 'none') {
        $st = $pdo->prepare("SELECT id_preset FROM preset WHERE slug = :s LIMIT 1");
        $st->execute([':s' => $preset]);
        $idPreset = $st->fetchColumn() ?: null;
    }

    $type = $isVideo ? 'video' : 'photo';

    $ins = $pdo->prepare(
        "INSERT INTO media (id_category, id_preset, type, aspect, visibility, sort_order,
                            is_featured, show_info, width_px, height_px)
         VALUES (:c, :p, :t, :a, :v, 0, :f, :si, :w, :h)"
    );
    $ins->execute([
        ':c' => $idCat,
        ':p' => $idPreset,
        ':t' => $type,
        ':a' => $aspect,
        ':v' => $vis,
        ':f' => $feat,
        ':si' => $showInfo,
        ':w' => $wPx,
        ':h' => $hPx,
    ]);
    $idMedia = (int)$pdo->lastInsertId();

    // Insert media_file
    $insF = $pdo->prepare(
        "INSERT INTO media_file (id_media, kind, storage_path, public_url, original_filename,
                                 mime_type, size_bytes, width_px, height_px, sort_order)
         VALUES (:i, 'main', :sp, :pu, :on, :m, :s, :w, :h, 0)"
    );
    $insF->execute([
        ':i'  => $idMedia,
        ':sp' => $publicUrl,
        ':pu' => $publicUrl,
        ':on' => substr($origName, 0, 255),
        ':m'  => $mime,
        ':s'  => $size,
        ':w'  => $wPx,
        ':h'  => $hPx,
    ]);

    // Tag opzionali: il client può passare 'tags' come CSV
    // (es. "ritratto,studio" oppure "__profile__" per le foto profilo).
    // Vengono creati i record in tag/media_tag corrispondenti.
    $tagsCsv = niwa_str($_POST, 'tags');
    if ($tagsCsv) {
        $tagSlugs = array_filter(array_map('trim', explode(',', $tagsCsv)));
        if (!empty($tagSlugs)) {
            $stTagIns = $pdo->prepare(
                "INSERT INTO tag (slug, name) VALUES (:s, :n)
                 ON DUPLICATE KEY UPDATE name = VALUES(name)"
            );
            $stTagSel = $pdo->prepare("SELECT id_tag FROM tag WHERE slug = :s LIMIT 1");
            $stTagLink = $pdo->prepare(
                "INSERT IGNORE INTO media_tag (id_media, id_tag) VALUES (:m, :t)"
            );
            foreach ($tagSlugs as $rawSlug) {
                // Normalizzazione minima: i tag interni '__profile__' non
                // vengono modificati, ma per gli altri tagli a 80 char.
                $slug = substr($rawSlug, 0, 80);
                if ($slug === '') continue;
                $stTagIns->execute([':s' => $slug, ':n' => $slug]);
                $stTagSel->execute([':s' => $slug]);
                $idTag = (int)($stTagSel->fetchColumn() ?: 0);
                if ($idTag > 0) {
                    $stTagLink->execute([':m' => $idMedia, ':t' => $idTag]);
                }
            }
        }
    }

    $pdo->commit();

    niwa_json(201, [
        'ok'       => true,
        'id_media' => $idMedia,
        'id'       => 'm' . $idMedia,
        'type'     => $type,
        'src'      => $publicUrl,
        'aspect'   => $aspect,
    ]);
} catch (Throwable $e) {
    if (niwa_db()->inTransaction()) niwa_db()->rollBack();
    @unlink($absTarget);
    niwa_json(500, ['ok' => false, 'error' => 'server_error']);
}
