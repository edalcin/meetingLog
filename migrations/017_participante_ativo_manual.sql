-- Tracks whether a participant's active status was set explicitly by a user,
-- which prevents the automatic cascade from deactivating them when projects become inactive.
ALTER TABLE participante
  ADD COLUMN `ativo_manual` BOOLEAN NOT NULL DEFAULT FALSE AFTER `ativo`;
