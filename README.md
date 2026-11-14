# Niwa.ph

**English** · [Italiano](README.it.md)

A photographer's portfolio site, written from scratch: no WordPress, no framework, no
build step. React frontend compiled in the browser, PHP API, MySQL, and an admin panel
for managing photos, videos, site copy and events.

Live at [niwaph.it](https://www.niwaph.it).

## How it is built

| | |
|---|---|
| Frontend | React 18 via UMD + Babel standalone, JSX served as it is |
| Styling | hand-written CSS, ~2,400 lines, light and dark theme |
| Backend | PHP 8, PDO with prepared statements, no external dependencies |
| Database | MySQL 8, 21 tables + 1 view |
| Hosting | shared Apache space, deployed over FTP |

**Why no build step.** The hosting is a shared space reachable only over FTP: no Node,
no CI. A build step would have meant compiling on my PC and uploading artifacts, where
one wrong file in the middle would have been invisible. By serving the `.jsx` files
directly, what sits in the repository is exactly what runs on the server. The price is
Babel compiling on every page load: acceptable for a site of a few pages, worth
revisiting if it grows.

## What it does

- **Gallery** of photos and videos with category filters, two views (grid and mosaic) and a lightbox.
- **Photo presets** — exposure, contrast, saturation, warmth, grain, vignette, fade — stored per media item and applied with CSS `filter`, without touching the files.
- **Bilingual** Italian and English, with the site copy editable from the admin panel.
- **Admin panel**: media upload, reordering, categories, presets, events, services, social links, copy, incoming messages. Sessions use a token in an `HttpOnly`/`SameSite=Strict` cookie, and login attempts are rate limited.
- **Thumbnails on the fly** (`api/thumb.php`): the originals weigh 5-14 MB, so the gallery serves 400/800/1600 px versions cached on disk. Across the full gallery that turns 170 MB into 2.2 MB.
- **Contact form** with server-side validation and rate limiting.

## Layout

```
index.html          single page, loads the four JSX modules
app-core.jsx        router, contexts (theme, language, data), API calls
app-shell.jsx       navigation, cards, lightbox, footer
app-pages.jsx       home, galleries, about, contact
app-admin.jsx       admin panel
data.js             presets, helpers, sample demo data
styles.css
api/                public endpoints (media, categories, events, contact...)
api/admin/          endpoints behind a session
api/thumb.php       thumbnail generator with on-disk cache
db/schema.sql       database schema, no data
dev.bat             local development server
pubblica.ps1        FTPS upload to the hosting, with verification
```

## Running it locally

You need PHP 8 with `pdo_mysql` and `gd`, plus a MySQL server. On Windows the binaries
shipped with WAMP or XAMPP are enough — there is no need to start their services, since
`dev.bat` calls the binaries directly.

```
copy api\_secrets.example.php api\_secrets.php   REM then fill in your own values
mysql -u root yourdbname < db\schema.sql
dev.bat
```

The site answers on `http://localhost:8000`, the panel on `/#admin`. The paths in
`dev.bat` point at `C:\wamp64`: if your installation lives elsewhere, change them there.

One caveat: on Windows the PHP shipped with WAMP has no CA bundle, so
`api/proxy_asset.php` (used only by the sample media) fails locally with a certificate
error. It works on the server.

With an empty database the gallery is empty — that is the correct behaviour, media are
uploaded from the admin panel.

## What is deliberately not in the repository

- **The photos and videos**: 260 MB of the photographer's work, not repository material.
- **The database contents**: they hold messages sent by visitors, sessions and the admin user. The schema is here, the data is not.
- **The credentials**: they live in `api/_secrets.php`, which is not versioned and which the `.htaccess` in `api/` keeps unreachable from the web (it blocks anything starting with `_`). The template is `api/_secrets.example.php`.

## Security notes

The things that got attention, if you want the detail:

- Queries only through prepared statements, with `PDO::ATTR_EMULATE_PREPARES` set to `false`.
- Uploads validated with `finfo` and `exif_imagetype` rather than by extension; PHP execution is switched off inside `uploads/` via `.htaccess`, so a `photo.php.jpg` cannot run.
- `api/thumb.php` accepts only paths inside `/uploads/photos/` and widths from a fixed list: no traversal, and no cache an outsider can fill at will.
- `api/proxy_asset.php` fetches only from whitelisted hosts and only `image/*` or `video/*` responses.
- The admin password is stored with `password_hash()`, and login attempts are rate limited per IP.
- HTTPS enforced, plus `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`.

## Deploying

`pubblica.ps1` uploads the files in `_da-caricare\` over FTPS and, **after every file,
reads its size back from the server and re-uploads if it does not match**. That is not
decorative caution: this hosting occasionally drops a transfer without reporting it,
neither to the client nor in its response — in one nine-file upload three arrived at
zero bytes while the server answered `226 Transfer complete` for all of them.

## Licence

The code is under the [MIT](LICENSE) licence: use it, change it, do what you like with it.

The licence does not cover the Niwa.ph name, the logo in `assets/` or the photographs
published on the site, which remain the author's and are protected separately.
