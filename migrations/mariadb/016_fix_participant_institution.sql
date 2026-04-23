-- Drop the unmaintained participante_instituicao junction table.
-- Participant-institution relationships are stored in participante.instituicao (VARCHAR),
-- which is the field maintained by the application form and propagated on institution renames.
-- The junction table was never written by the participant CRUD and contained stale/wrong data.
DROP TABLE IF EXISTS `participante_instituicao`;
