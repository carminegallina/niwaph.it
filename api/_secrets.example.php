<?php
// Copyright (c) 2026 Carmine Gallina - https://github.com/carminegallina
/**
 * Modello per _secrets.php, che contiene le credenziali vere del database
 * e non va versionato.
 *
 * In locale: copia questo file in _secrets.php e metti i dati del tuo MySQL.
 * In produzione: caricalo in /api/ via FTP una volta sola.
 *
 * In alternativa si possono usare le variabili d'ambiente NIWA_DB_HOST,
 * NIWA_DB_NAME, NIWA_DB_USER, NIWA_DB_PASS, che hanno la precedenza.
 */

return [
    'host' => 'localhost',
    'name' => 'niwaph',
    'user' => 'niwaph',
    'pass' => '',
];
