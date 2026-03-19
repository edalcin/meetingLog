CREATE TABLE IF NOT EXISTS `pauta` (
  `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `reuniao_id` INT UNSIGNED  NOT NULL,
  `texto`      VARCHAR(1000) NOT NULL,
  `ordem`      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `criado_em`  DATETIME      NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pauta` (`reuniao_id`, `texto`(500)),
  KEY `idx_pauta_reuniao_ordem` (`reuniao_id`, `ordem`),
  CONSTRAINT `fk_pauta_reuniao`
    FOREIGN KEY (`reuniao_id`) REFERENCES `reuniao`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
