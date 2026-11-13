@echo off
rem ===== NIWA.PH - server locale di sviluppo =====
rem Avvia MySQL (binari di WAMP, senza bisogno del WampManager) e il server PHP.
rem Il sito sta su http://localhost:8000 - l'admin su http://localhost:8000/#admin
rem Chiudi questa finestra (o Ctrl+C) per fermare il server PHP.

set "PHP=C:\wamp64\bin\php\php8.3.14\php.exe"
set "MYSQL_DIR=C:\wamp64\bin\mysql\mysql9.1.0"

rem --- Config DB locale: l'host punta al MySQL sul PC, nome/utente/password
rem     arrivano da api\_secrets.php (vedi _secrets.example.php) ---
set NIWA_DEV=1
set NIWA_DB_HOST=127.0.0.1

rem --- MySQL: avvialo solo se non gira gia' ---
tasklist /fi "imagename eq mysqld.exe" | find /i "mysqld.exe" >nul
if errorlevel 1 (
  echo [niwa] avvio MySQL...
  start "niwa-mysql" /min "%MYSQL_DIR%\bin\mysqld.exe" --defaults-file="%MYSQL_DIR%\my.ini" --datadir="%MYSQL_DIR%\data" --console
  timeout /t 5 /nobreak >nul
) else (
  echo [niwa] MySQL gia' in esecuzione.
)

echo [niwa] sito su http://localhost:8000
"%PHP%" -S localhost:8000 -t "%~dp0." ^
  -d display_errors=1 ^
  -d upload_max_filesize=64M ^
  -d post_max_size=80M ^
  -d max_execution_time=300 ^
  -d memory_limit=512M
