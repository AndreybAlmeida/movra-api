-- MOVRA v3 — Colunas ausentes na tabela cargas
-- Rodar no Neon SQL Editor

ALTER TABLE cargas
  ADD COLUMN IF NOT EXISTS tipo_camion      TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS especializacion  TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS carga_peligrosa  BOOLEAN DEFAULT false;

-- Verificação
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cargas'
ORDER BY ordinal_position;
