-- NIWA.PH - schema del database (solo struttura, nessun dato)

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
--

-- --------------------------------------------------------

--
-- Struttura della tabella `admin_login_attempt`
--

CREATE TABLE `admin_login_attempt` (
  `id` bigint UNSIGNED NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `username` varchar(60) DEFAULT NULL,
  `success` tinyint(1) NOT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `admin_session`
--

CREATE TABLE `admin_session` (
  `token_hash` char(64) NOT NULL,
  `id_admin` int UNSIGNED NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `expires_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `admin_user`
--

CREATE TABLE `admin_user` (
  `id_admin` int UNSIGNED NOT NULL,
  `username` varchar(60) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `display_name` varchar(120) NOT NULL,
  `email` varchar(190) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `category`
--

CREATE TABLE `category` (
  `id_category` int UNSIGNED NOT NULL,
  `slug` varchar(80) NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `category_translation`
--

CREATE TABLE `category_translation` (
  `id_category` int UNSIGNED NOT NULL,
  `lang` char(2) NOT NULL,
  `name` varchar(120) NOT NULL,
  `description` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `contact_message`
--

CREATE TABLE `contact_message` (
  `id_message` bigint UNSIGNED NOT NULL,
  `name` varchar(160) NOT NULL,
  `email` varchar(190) NOT NULL,
  `subject` varchar(160) NOT NULL,
  `message` text NOT NULL,
  `status` enum('new','read','replied','archived') NOT NULL DEFAULT 'new',
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `event`
--

CREATE TABLE `event` (
  `id_event` int UNSIGNED NOT NULL,
  `date_from` date NOT NULL,
  `date_to` date DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `event_translation`
--

CREATE TABLE `event_translation` (
  `id_event` int UNSIGNED NOT NULL,
  `lang` char(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `description` text COLLATE utf8mb4_unicode_ci,
  `tag` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `media`
--

CREATE TABLE `media` (
  `id_media` bigint UNSIGNED NOT NULL,
  `id_category` int UNSIGNED NOT NULL,
  `id_preset` int UNSIGNED DEFAULT NULL,
  `type` enum('photo','video') NOT NULL,
  `slug` varchar(160) DEFAULT NULL,
  `aspect` enum('sq','tall','wide','pano','port') NOT NULL DEFAULT 'sq',
  `visibility` enum('draft','published','private') NOT NULL DEFAULT 'published',
  `is_featured` tinyint(1) NOT NULL DEFAULT '0',
  `show_info` tinyint(1) NOT NULL DEFAULT '1',
  `carousel_frame_url` varchar(500) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `adj_exposure` smallint DEFAULT NULL,
  `adj_contrast` smallint DEFAULT NULL,
  `adj_saturation` smallint DEFAULT NULL,
  `adj_warmth` smallint DEFAULT NULL,
  `adj_grain` smallint DEFAULT NULL,
  `adj_vignette` smallint DEFAULT NULL,
  `adj_fade` smallint DEFAULT NULL,
  `shot_at` date DEFAULT NULL,
  `location` varchar(160) DEFAULT NULL,
  `camera` varchar(120) DEFAULT NULL,
  `lens` varchar(120) DEFAULT NULL,
  `width_px` int UNSIGNED DEFAULT NULL,
  `height_px` int UNSIGNED DEFAULT NULL,
  `duration_seconds` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `media_file`
--

CREATE TABLE `media_file` (
  `id_file` bigint UNSIGNED NOT NULL,
  `id_media` bigint UNSIGNED NOT NULL,
  `kind` enum('main','poster','thumbnail','webp','original') NOT NULL DEFAULT 'main',
  `storage_path` varchar(500) NOT NULL,
  `public_url` varchar(500) NOT NULL,
  `original_filename` varchar(255) DEFAULT NULL,
  `mime_type` varchar(120) DEFAULT NULL,
  `size_bytes` bigint UNSIGNED DEFAULT NULL,
  `width_px` int UNSIGNED DEFAULT NULL,
  `height_px` int UNSIGNED DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `media_tag`
--

CREATE TABLE `media_tag` (
  `id_media` bigint UNSIGNED NOT NULL,
  `id_tag` int UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `media_translation`
--

CREATE TABLE `media_translation` (
  `id_media` bigint UNSIGNED NOT NULL,
  `lang` char(2) NOT NULL,
  `title` varchar(190) DEFAULT NULL,
  `description` text,
  `alt_text` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `preset`
--

CREATE TABLE `preset` (
  `id_preset` int UNSIGNED NOT NULL,
  `slug` varchar(80) NOT NULL,
  `exposure` smallint NOT NULL DEFAULT '0',
  `contrast` smallint NOT NULL DEFAULT '0',
  `saturation` smallint NOT NULL DEFAULT '0',
  `warmth` smallint NOT NULL DEFAULT '0',
  `grain` smallint NOT NULL DEFAULT '0',
  `vignette` smallint NOT NULL DEFAULT '0',
  `fade` smallint NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `preset_translation`
--

CREATE TABLE `preset_translation` (
  `id_preset` int UNSIGNED NOT NULL,
  `lang` char(2) NOT NULL,
  `label` varchar(120) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `service`
--

CREATE TABLE `service` (
  `id_service` int UNSIGNED NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `service_translation`
--

CREATE TABLE `service_translation` (
  `id_service` int UNSIGNED NOT NULL,
  `lang` char(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `site_text`
--

CREATE TABLE `site_text` (
  `key_path` varchar(120) NOT NULL,
  `lang` char(2) NOT NULL,
  `value` text NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `social_link`
--

CREATE TABLE `social_link` (
  `id_social` int UNSIGNED NOT NULL,
  `label` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `subject`
--

CREATE TABLE `subject` (
  `id_subject` int UNSIGNED NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `subject_translation`
--

CREATE TABLE `subject_translation` (
  `id_subject` int UNSIGNED NOT NULL,
  `lang` char(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `tag`
--

CREATE TABLE `tag` (
  `id_tag` int UNSIGNED NOT NULL,
  `slug` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Struttura stand-in per le viste `v_media_public`
-- (Vedi sotto per la vista effettiva)
--
CREATE TABLE `v_media_public` (
`id_media` bigint unsigned
,`type` enum('photo','video')
,`category` varchar(80)
,`preset` varchar(80)
,`slug` varchar(160)
,`aspect` enum('sq','tall','wide','pano','port')
,`is_featured` tinyint(1)
,`sort_order` int
,`adj_exposure` smallint
,`adj_contrast` smallint
,`adj_saturation` smallint
,`adj_warmth` smallint
,`adj_grain` smallint
,`adj_vignette` smallint
,`adj_fade` smallint
,`src` varchar(500)
,`poster` varchar(500)
,`title_it` varchar(190)
,`title_en` varchar(190)
,`desc_it` text
,`desc_en` text
,`created_at` timestamp
,`updated_at` timestamp
);

--
-- Indici per le tabelle scaricate
--

--
-- Indici per le tabelle `admin_login_attempt`
--
ALTER TABLE `admin_login_attempt`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_login_attempt_ip_time` (`ip_address`,`created_at`);

--
-- Indici per le tabelle `admin_session`
--
ALTER TABLE `admin_session`
  ADD PRIMARY KEY (`token_hash`),
  ADD KEY `idx_admin_session_admin` (`id_admin`),
  ADD KEY `idx_admin_session_expires` (`expires_at`);

--
-- Indici per le tabelle `admin_user`
--
ALTER TABLE `admin_user`
  ADD PRIMARY KEY (`id_admin`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Indici per le tabelle `category`
--
ALTER TABLE `category`
  ADD PRIMARY KEY (`id_category`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Indici per le tabelle `category_translation`
--
ALTER TABLE `category_translation`
  ADD PRIMARY KEY (`id_category`,`lang`);

--
-- Indici per le tabelle `contact_message`
--
ALTER TABLE `contact_message`
  ADD PRIMARY KEY (`id_message`),
  ADD KEY `idx_contact_status_created` (`status`,`created_at`);

--
-- Indici per le tabelle `event`
--
ALTER TABLE `event`
  ADD PRIMARY KEY (`id_event`),
  ADD KEY `idx_event_active_date` (`is_active`,`date_from`);

--
-- Indici per le tabelle `event_translation`
--
ALTER TABLE `event_translation`
  ADD PRIMARY KEY (`id_event`,`lang`);

--
-- Indici per le tabelle `media`
--
ALTER TABLE `media`
  ADD PRIMARY KEY (`id_media`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD KEY `fk_media_preset` (`id_preset`),
  ADD KEY `idx_media_type_visibility` (`type`,`visibility`),
  ADD KEY `idx_media_category` (`id_category`),
  ADD KEY `idx_media_featured` (`is_featured`,`sort_order`),
  ADD KEY `idx_media_sort` (`sort_order`,`created_at`);

--
-- Indici per le tabelle `media_file`
--
ALTER TABLE `media_file`
  ADD PRIMARY KEY (`id_file`),
  ADD UNIQUE KEY `uq_media_file_kind_order` (`id_media`,`kind`,`sort_order`),
  ADD KEY `idx_media_file_kind` (`kind`);

--
-- Indici per le tabelle `media_tag`
--
ALTER TABLE `media_tag`
  ADD PRIMARY KEY (`id_media`,`id_tag`),
  ADD KEY `fk_media_tag_tag` (`id_tag`);

--
-- Indici per le tabelle `media_translation`
--
ALTER TABLE `media_translation`
  ADD PRIMARY KEY (`id_media`,`lang`);
ALTER TABLE `media_translation` ADD FULLTEXT KEY `ft_media_translation` (`title`,`description`,`alt_text`);

--
-- Indici per le tabelle `preset`
--
ALTER TABLE `preset`
  ADD PRIMARY KEY (`id_preset`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Indici per le tabelle `preset_translation`
--
ALTER TABLE `preset_translation`
  ADD PRIMARY KEY (`id_preset`,`lang`);

--
-- Indici per le tabelle `service`
--
ALTER TABLE `service`
  ADD PRIMARY KEY (`id_service`),
  ADD KEY `idx_service_active_order` (`is_active`,`sort_order`);

--
-- Indici per le tabelle `service_translation`
--
ALTER TABLE `service_translation`
  ADD PRIMARY KEY (`id_service`,`lang`);

--
-- Indici per le tabelle `site_text`
--
ALTER TABLE `site_text`
  ADD PRIMARY KEY (`key_path`,`lang`);

--
-- Indici per le tabelle `social_link`
--
ALTER TABLE `social_link`
  ADD PRIMARY KEY (`id_social`),
  ADD KEY `idx_social_active_order` (`is_active`,`sort_order`);

--
-- Indici per le tabelle `subject`
--
ALTER TABLE `subject`
  ADD PRIMARY KEY (`id_subject`),
  ADD KEY `idx_subject_active_order` (`is_active`,`sort_order`);

--
-- Indici per le tabelle `subject_translation`
--
ALTER TABLE `subject_translation`
  ADD PRIMARY KEY (`id_subject`,`lang`);

--
-- Indici per le tabelle `tag`
--
ALTER TABLE `tag`
  ADD PRIMARY KEY (`id_tag`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- AUTO_INCREMENT per le tabelle scaricate
--

--
-- AUTO_INCREMENT per la tabella `admin_login_attempt`
--
ALTER TABLE `admin_login_attempt`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT per la tabella `admin_user`
--
ALTER TABLE `admin_user`
  MODIFY `id_admin` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT per la tabella `category`
--
ALTER TABLE `category`
  MODIFY `id_category` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT per la tabella `contact_message`
--
ALTER TABLE `contact_message`
  MODIFY `id_message` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT per la tabella `event`
--
ALTER TABLE `event`
  MODIFY `id_event` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT per la tabella `media`
--
ALTER TABLE `media`
  MODIFY `id_media` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT per la tabella `media_file`
--
ALTER TABLE `media_file`
  MODIFY `id_file` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT per la tabella `preset`
--
ALTER TABLE `preset`
  MODIFY `id_preset` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT per la tabella `service`
--
ALTER TABLE `service`
  MODIFY `id_service` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT per la tabella `social_link`
--
ALTER TABLE `social_link`
  MODIFY `id_social` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT per la tabella `subject`
--
ALTER TABLE `subject`
  MODIFY `id_subject` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT per la tabella `tag`
--
ALTER TABLE `tag`
  MODIFY `id_tag` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

-- --------------------------------------------------------

--
-- Struttura per vista `v_media_public`
--
DROP TABLE IF EXISTS `v_media_public`;

CREATE SQL SECURITY INVOKER VIEW `v_media_public`  AS SELECT `m`.`id_media` AS `id_media`, `m`.`type` AS `type`, `c`.`slug` AS `category`, `p`.`slug` AS `preset`, `m`.`slug` AS `slug`, `m`.`aspect` AS `aspect`, `m`.`is_featured` AS `is_featured`, `m`.`sort_order` AS `sort_order`, `m`.`adj_exposure` AS `adj_exposure`, `m`.`adj_contrast` AS `adj_contrast`, `m`.`adj_saturation` AS `adj_saturation`, `m`.`adj_warmth` AS `adj_warmth`, `m`.`adj_grain` AS `adj_grain`, `m`.`adj_vignette` AS `adj_vignette`, `m`.`adj_fade` AS `adj_fade`, `mf_main`.`public_url` AS `src`, `mf_poster`.`public_url` AS `poster`, `mt_it`.`title` AS `title_it`, `mt_en`.`title` AS `title_en`, `mt_it`.`description` AS `desc_it`, `mt_en`.`description` AS `desc_en`, `m`.`created_at` AS `created_at`, `m`.`updated_at` AS `updated_at` FROM ((((((`media` `m` join `category` `c` on((`c`.`id_category` = `m`.`id_category`))) left join `preset` `p` on((`p`.`id_preset` = `m`.`id_preset`))) left join `media_file` `mf_main` on(((`mf_main`.`id_media` = `m`.`id_media`) and (`mf_main`.`kind` = 'main') and (`mf_main`.`sort_order` = 0)))) left join `media_file` `mf_poster` on(((`mf_poster`.`id_media` = `m`.`id_media`) and (`mf_poster`.`kind` = 'poster') and (`mf_poster`.`sort_order` = 0)))) left join `media_translation` `mt_it` on(((`mt_it`.`id_media` = `m`.`id_media`) and (`mt_it`.`lang` = 'it')))) left join `media_translation` `mt_en` on(((`mt_en`.`id_media` = `m`.`id_media`) and (`mt_en`.`lang` = 'en')))) WHERE (`m`.`visibility` = 'published') ORDER BY `m`.`sort_order` ASC, `m`.`created_at` DESC ;

--
-- Limiti per le tabelle scaricate
--

--
-- Limiti per la tabella `admin_session`
--
ALTER TABLE `admin_session`
  ADD CONSTRAINT `fk_admin_session_admin` FOREIGN KEY (`id_admin`) REFERENCES `admin_user` (`id_admin`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Limiti per la tabella `category_translation`
--
ALTER TABLE `category_translation`
  ADD CONSTRAINT `fk_category_translation_category` FOREIGN KEY (`id_category`) REFERENCES `category` (`id_category`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Limiti per la tabella `event_translation`
--
ALTER TABLE `event_translation`
  ADD CONSTRAINT `fk_event_tr_event` FOREIGN KEY (`id_event`) REFERENCES `event` (`id_event`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Limiti per la tabella `media`
--
ALTER TABLE `media`
  ADD CONSTRAINT `fk_media_category` FOREIGN KEY (`id_category`) REFERENCES `category` (`id_category`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_media_preset` FOREIGN KEY (`id_preset`) REFERENCES `preset` (`id_preset`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Limiti per la tabella `media_file`
--
ALTER TABLE `media_file`
  ADD CONSTRAINT `fk_media_file_media` FOREIGN KEY (`id_media`) REFERENCES `media` (`id_media`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Limiti per la tabella `media_tag`
--
ALTER TABLE `media_tag`
  ADD CONSTRAINT `fk_media_tag_media` FOREIGN KEY (`id_media`) REFERENCES `media` (`id_media`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_media_tag_tag` FOREIGN KEY (`id_tag`) REFERENCES `tag` (`id_tag`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Limiti per la tabella `media_translation`
--
ALTER TABLE `media_translation`
  ADD CONSTRAINT `fk_media_translation_media` FOREIGN KEY (`id_media`) REFERENCES `media` (`id_media`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Limiti per la tabella `preset_translation`
--
ALTER TABLE `preset_translation`
  ADD CONSTRAINT `fk_preset_translation_preset` FOREIGN KEY (`id_preset`) REFERENCES `preset` (`id_preset`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Limiti per la tabella `service_translation`
--
ALTER TABLE `service_translation`
  ADD CONSTRAINT `fk_service_tr_service` FOREIGN KEY (`id_service`) REFERENCES `service` (`id_service`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Limiti per la tabella `subject_translation`
--
ALTER TABLE `subject_translation`
  ADD CONSTRAINT `fk_subject_tr` FOREIGN KEY (`id_subject`) REFERENCES `subject` (`id_subject`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
