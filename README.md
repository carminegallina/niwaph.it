# Niwa.ph

Sito portfolio di un fotografo, scritto da zero: niente WordPress, niente framework,
niente passaggio di build. Frontend React compilato nel browser, API in PHP, MySQL,
e un pannello di amministrazione da cui si gestiscono foto, video, testi ed eventi.

Online su [niwaph.it](https://www.niwaph.it).

## Com'è fatto

| | |
|---|---|
| Frontend | React 18 via UMD + Babel standalone, JSX servito così com'è |
| Stile | CSS scritto a mano, ~2.400 righe, tema chiaro/scuro |
| Backend | PHP 8, PDO con prepared statement, nessuna dipendenza esterna |
| Database | MySQL 8, 21 tabelle + 1 vista |
| Hosting | spazio condiviso Apache, deploy via FTP |

**Perché senza build.** L'hosting è uno spazio condiviso con accesso FTP: niente Node,
niente CI. Un passaggio di build avrebbe voluto dire compilare sul PC e caricare
artefatti, e un file sbagliato in mezzo sarebbe stato invisibile. Servendo i `.jsx`
direttamente, quello che sta nel repo è esattamente quello che gira sul server. Il
prezzo è Babel che compila a ogni caricamento di pagina: accettabile per un sito di
poche pagine, da rivedere se il peso cresce.

## Cosa fa

- **Galleria** foto e video con filtri per categoria, due viste (griglia e mosaico) e lightbox.
- **Preset fotografici** — esposizione, contrasto, saturazione, calore, grana, vignettatura, sfumatura — salvati per singolo media e applicati con `filter` CSS, senza ritoccare i file.
- **Bilingue** italiano/inglese, con i testi del sito modificabili dall'admin.
- **Pannello admin**: caricamento media, riordino, categorie, preset, eventi, servizi, link social, testi, messaggi ricevuti. Sessioni con token in cookie `HttpOnly`/`SameSite=Strict`, login con limite ai tentativi.
- **Miniature al volo** (`api/thumb.php`): le foto originali pesano 5-14 MB, la galleria ne serve versioni da 400/800/1600 px tenute in cache su disco. Sulla galleria completa sono 170 MB che diventano 2,2 MB.
- **Form contatti** con validazione lato server e limite di frequenza.

## Struttura

```
index.html          pagina unica, carica i quattro moduli JSX
app-core.jsx        router, contesti (tema, lingua, dati), chiamate alle API
app-shell.jsx       navigazione, card, lightbox, footer
app-pages.jsx       home, gallerie, chi sono, contatti
app-admin.jsx       pannello di amministrazione
data.js             preset, helper, dati demo di esempio
styles.css
api/                endpoint pubblici (media, categorie, eventi, contatti...)
api/admin/          endpoint protetti da sessione
api/thumb.php       generatore di miniature con cache
db/schema.sql       schema del database, senza dati
dev.bat             server di sviluppo locale
pubblica.ps1        caricamento su hosting via FTPS, con verifica
```

## Avviare in locale

Servono PHP 8 con `pdo_mysql` e `gd`, e un MySQL. Su Windows bastano quelli di WAMP o
XAMPP, non serve avviarne i servizi: `dev.bat` usa direttamente i binari.

```
copy api\_secrets.example.php api\_secrets.php   REM e metti i tuoi dati
mysql -u root nomedeldb < db\schema.sql
dev.bat
```

Il sito risponde su `http://localhost:8000`, il pannello su `/#admin`. I percorsi in
`dev.bat` puntano a `C:\wamp64`: se la tua installazione sta altrove, cambiali lì.

Nota: su Windows il PHP di WAMP non ha un elenco di CA, quindi `api/proxy_asset.php`
(che serve solo ai media di esempio) fallisce in locale con un errore sul certificato.
Sul server funziona.

Senza dati nel database la galleria è vuota — è il comportamento giusto, i media si
caricano dal pannello admin.

## Cosa non c'è nel repo, di proposito

- **Le foto e i video**: 260 MB di lavoro del fotografo, non sono materiale da repository.
- **I dati del database**: contengono messaggi ricevuti dai visitatori, sessioni e l'utente amministratore. Lo schema c'è, i dati no.
- **Le credenziali**: stanno in `api/_secrets.php`, che non è versionato e che il `.htaccess` di `api/` non lascia raggiungere dal web (blocca tutto ciò che inizia con `_`). Il modello è `api/_secrets.example.php`.

## Note di sicurezza

Le cose a cui si è fatta attenzione, se interessa il dettaglio:

- Query solo con prepared statement, `PDO::ATTR_EMULATE_PREPARES` a `false`.
- Upload verificati con `finfo` ed `exif_imagetype`, non con l'estensione; in `uploads/` l'esecuzione di PHP è disattivata via `.htaccess`, così un `foto.php.jpg` non può girare.
- `api/thumb.php` accetta solo percorsi dentro `/uploads/photos/` e larghezze da un elenco fisso: niente traversal, niente cache riempibile a piacere.
- `api/proxy_asset.php` scarica solo da host in whitelist e solo risposte `image/*` o `video/*`.
- Password dell'amministratore con `password_hash()`, tentativi di accesso limitati per IP.
- HTTPS forzato, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.

## Pubblicare

`pubblica.ps1` carica via FTPS i file di `_da-caricare\`, e **dopo ogni file rilegge la
dimensione dal server e ricarica se non combacia**. Non è prudenza decorativa: questo
hosting scarta il trasferimento ogni tanto senza segnalarlo, né al client né nella
risposta — in un caricamento da 9 file ne sono arrivati 3 a zero byte, con il server
che rispondeva `226 Transfer complete` su tutti.

## Licenza

Il codice è sotto licenza [MIT](LICENSE): usalo, modificalo, fanne quello che vuoi.

Non rientrano nella licenza il marchio Niwa.ph, il logo in `assets/` e le fotografie
pubblicate sul sito, che restano dell'autore e sono tutelate a parte.
