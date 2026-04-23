CREATE TABLE IF NOT EXISTS `projeto_link` (
  `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `projeto_id` INT UNSIGNED  NOT NULL,
  `nome`       VARCHAR(500)  NULL,
  `url`        VARCHAR(2048) NOT NULL,
  `ordem`      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `criado_em`  DATETIME      NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_projeto_link` (`projeto_id`, `url`(500)),
  KEY `idx_projeto_link_projeto_ordem` (`projeto_id`, `ordem`),
  CONSTRAINT `fk_projeto_link_projeto`
    FOREIGN KEY (`projeto_id`) REFERENCES `projeto`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
