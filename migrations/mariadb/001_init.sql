CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `filename`   VARCHAR(255) NOT NULL,
  `applied_at` DATETIME     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_filename` (`filename`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `reuniao` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `data_hora`     DATETIME     NOT NULL,
  `tipo`          ENUM('Presencial','Remota') NOT NULL,
  `participantes` TEXT         NOT NULL,
  `projeto`       VARCHAR(255) NOT NULL,
  `criado_em`     DATETIME     NOT NULL DEFAULT NOW(),
  `atualizado_em` DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`),
  KEY `idx_data_hora` (`data_hora`),
  KEY `idx_projeto`   (`projeto`(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
