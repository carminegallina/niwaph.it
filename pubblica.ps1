<#
  Carica su Aruba i file di _da-caricare\ via FTPS.

  Uso:   .\pubblica.ps1 -User <utente>
         (la password viene chiesta a te, non finisce ne' su disco ne' nella
         riga di comando: viene passata a curl sullo standard input)

  Il trasferimento lo fa curl.exe (in Windows dall'11): FtpWebRequest di .NET
  con questo server consegnava file troncati o vuoti rispondendo comunque
  "226 Transfer complete".

  -FtpHost e' ftplnx02.aruba.it e non ftp.niwaph.it perche' sono la stessa
  macchina (stessi IP) ma il certificato e' intestato al primo nome: cosi' la
  verifica TLS passa per intero, senza eccezioni da concedere.

  Alla fine ricontrolla la dimensione di ogni file sul server.
#>
param(
  [Parameter(Mandatory = $true)][string]$User,
  [string]$FtpHost = "ftplnx02.aruba.it",
  [string]$Remote = "www.niwaph.it"
)

$ErrorActionPreference = "Stop"
$base = Join-Path $PSScriptRoot "_da-caricare"
if (-not (Test-Path $base)) { throw "Manca la cartella _da-caricare" }
$curl = "$env:SystemRoot\System32\curl.exe"
if (-not (Test-Path $curl)) { throw "curl.exe non trovato" }

# .htaccess di root per ultimo: e' l'unico che puo' rompere il sito.
$files = @(
  "data.js",
  "app-shell.jsx",
  "app-admin.jsx",
  "api/thumb.php",
  "api/proxy_asset.php",
  "api/_secrets.php",
  "api/_db.php",
  "api/.htaccess",
  "api/admin/.htaccess",
  ".htaccess"
)

$pass = Read-Host -AsSecureString "Password FTP di $User"
$plain = (New-Object System.Net.NetworkCredential("", $pass)).Password
# curl legge le credenziali da qui, cosi' non compaiono nella riga di comando
# ne' nell'elenco dei processi.
$conf = "user = `"${User}:${plain}`""
$root = "ftp://$FtpHost/" + $Remote.Trim('/') + "/"

# --- Controllo: siamo davvero nella cartella del sito? ---
$listing = $conf | & $curl -s -K - --ssl-reqd --list-only $root
if ($LASTEXITCODE -ne 0) { throw "Connessione fallita (curl $LASTEXITCODE)" }
if (($listing -split "`r?`n") -notcontains "index.html") {
  "In $root non c'e' index.html. Contenuto trovato:"
  $listing
  throw "Cartella sbagliata: rilancia con -Remote <cartella giusta>"
}
"Cartella del sito confermata: $root"
""

function Get-RemoteSize($url) {
  $head = $conf | & $curl -s -K - --ssl-reqd -I $url
  $riga = ($head -split "`r?`n" | Where-Object { $_ -match '^Content-Length:' }) -join ''
  if ($riga -match '(\d+)') { return [int]$matches[1] }
  return -1
}

# Ogni file viene ricontrollato subito e ricaricato se non combacia: l'FTP di
# Aruba ogni tanto scarta il trasferimento senza dirlo, e un file vuoto qui
# vuol dire sito rotto.
foreach ($f in $files) {
  $local = Join-Path $base ($f -replace '/', '\')
  if (-not (Test-Path $local)) { throw "File mancante: $local" }
  $atteso = (Get-Item $local).Length
  $url = $root + $f
  $ok = $false

  for ($tentativo = 1; $tentativo -le 4 -and -not $ok; $tentativo++) {
    $conf | & $curl -s -S -K - --ssl-reqd -T $local $url
    if ($LASTEXITCODE -ne 0) { throw "$f non caricato (curl $LASTEXITCODE)" }
    $remoto = Get-RemoteSize $url
    $ok = ($remoto -eq $atteso)
    if (-not $ok) {
      "{0,-22} tentativo {1}: {2} byte invece di {3}, ricarico" -f $f, $tentativo, $remoto, $atteso
      Start-Sleep -Seconds 2
    }
  }

  if (-not $ok) {
    throw "$f non si carica per intero dopo 4 tentativi. ATTENZIONE: sul server c'e' un file incompleto, il sito puo' essere rotto."
  }
  "{0,-22} ok, {1} byte" -f $f, $atteso
}

""
"Tutto a posto. Apri https://www.niwaph.it e controlla che le foto si vedano."
"Se esce 'troppi reindirizzamenti': cancella .htaccess dalla root via FTP."
