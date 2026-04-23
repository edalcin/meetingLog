CREATE TABLE IF NOT EXISTS `projeto` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `nome`        VARCHAR(255)  NOT NULL,
  `ativo`       BOOLEAN       NOT NULL DEFAULT TRUE,
  `instituicao` VARCHAR(255)  NULL,
  `criado_em`   DATETIME      NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_nome` (`nome`),
  KEY `idx_ativo` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `reuniao_projeto` (
  `reuniao_id` INT UNSIGNED NOT NULL,
  `projeto_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`reuniao_id`, `projeto_id`),
  FOREIGN KEY (`reuniao_id`) REFERENCES `reuniao`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`projeto_id`) REFERENCES `projeto`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
