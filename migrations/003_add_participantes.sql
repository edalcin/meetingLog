CREATE TABLE IF NOT EXISTS `participante` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `nome`        VARCHAR(255)  NOT NULL,
  `instituicao` VARCHAR(255)  NULL,
  `cargo`       VARCHAR(255)  NULL,
  `email`       VARCHAR(255)  NULL,
  `criado_em`   DATETIME      NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_nome` (`nome`),
  KEY `idx_nome` (`nome`),
  KEY `idx_instituicao` (`instituicao`(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `reuniao_participante` (
  `reuniao_id`      INT UNSIGNED NOT NULL,
  `participante_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`reuniao_id`, `participante_id`),
  CONSTRAINT `fk_rp_reuniao`      FOREIGN KEY (`reuniao_id`)      REFERENCES `reuniao`(`id`)      ON DELETE CASCADE,
  CONSTRAINT `fk_rp_participante` FOREIGN KEY (`participante_id`) REFERENCES `participante`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
