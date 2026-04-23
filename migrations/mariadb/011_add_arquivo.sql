CREATE TABLE IF NOT EXISTS `arquivo` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reuniao_id`        INT UNSIGNED NOT NULL,
  `filename_original` VARCHAR(255) NOT NULL,
  `filename_stored`   VARCHAR(255) NOT NULL,
  `letter`            CHAR(1)      NOT NULL,
  `mime_type`         VARCHAR(50)  NOT NULL,
  `file_size`         INT UNSIGNED NOT NULL,
  `criado_em`         DATETIME     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reuniao_letter` (`reuniao_id`, `letter`),
  KEY `idx_reuniao_id` (`reuniao_id`),
  CONSTRAINT `fk_arquivo_reuniao`
    FOREIGN KEY (`reuniao_id`) REFERENCES `reuniao`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
