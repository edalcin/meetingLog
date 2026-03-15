-- Remove coluna `participantes` TEXT legada da tabela reuniao.
-- IMPORTANTE: Executar SOMENTE após rodar docs/source/scripts/migrate-participantes.js
-- para garantir que os dados legados foram migrados para a tabela reuniao_participante.

ALTER TABLE `reuniao` DROP COLUMN `participantes`;
