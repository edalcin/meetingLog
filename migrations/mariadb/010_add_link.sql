CREATE TABLE IF NOT EXISTS `link` (
  `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `reuniao_id` INT UNSIGNED  NOT NULL,
  `nome`       VARCHAR(500)  NOT NULL,
  `url`        VARCHAR(2048) NOT NULL,
  `ordem`      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `criado_em`  DATETIME      NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_link` (`reuniao_id`, `url`(500)),
  KEY `idx_link_reuniao_ordem` (`reuniao_id`, `ordem`),
  CONSTRAINT `fk_link_reuniao`
    FOREIGN KEY (`reuniao_id`) REFERENCES `reuniao`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
