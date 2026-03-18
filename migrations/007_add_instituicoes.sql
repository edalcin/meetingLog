CREATE TABLE IF NOT EXISTS `instituicao` (
  `id`        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `sigla`     VARCHAR(100)  NOT NULL,
  `nome`      VARCHAR(255)  NULL,
  `criado_em` DATETIME      NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sigla` (`sigla`),
  KEY `idx_sigla` (`sigla`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `participante_instituicao` (
  `participante_id` INT UNSIGNED NOT NULL,
  `instituicao_id`  INT UNSIGNED NOT NULL,
  PRIMARY KEY (`participante_id`, `instituicao_id`),
  CONSTRAINT `fk_pi_participante` FOREIGN KEY (`participante_id`) REFERENCES `participante`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pi_instituicao`  FOREIGN KEY (`instituicao_id`)  REFERENCES `instituicao`(`id`)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `projeto_instituicao` (
  `projeto_id`     INT UNSIGNED NOT NULL,
  `instituicao_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`projeto_id`, `instituicao_id`),
  CONSTRAINT `fk_proi_projeto`     FOREIGN KEY (`projeto_id`)     REFERENCES `projeto`(`id`)     ON DELETE CASCADE,
  CONSTRAINT `fk_proi_instituicao` FOREIGN KEY (`instituicao_id`) REFERENCES `instituicao`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
