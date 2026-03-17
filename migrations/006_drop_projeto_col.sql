-- ⚠️ EXECUTAR APENAS APÓS migrate-projetos.js ter rodado com sucesso
-- Remove a coluna legada reuniao.projeto e seu índice
ALTER TABLE `reuniao`
  DROP INDEX `idx_projeto`,
  DROP COLUMN `projeto`;
