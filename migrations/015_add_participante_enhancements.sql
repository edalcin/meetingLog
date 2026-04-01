ALTER TABLE participante
  ADD COLUMN `lotacao` VARCHAR(255) NULL AFTER `instituicao`,
  ADD COLUMN `ativo`   BOOLEAN      NOT NULL DEFAULT TRUE AFTER `email`,
  ADD COLUMN `notas`   TEXT         NULL AFTER `ativo`,
  ADD KEY `idx_ativo` (`ativo`);
