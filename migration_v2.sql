-- MOVRA v2 — Migration
-- Run in Neon SQL Editor (console.neon.tech → project movra → SQL Editor)
-- Safe to run multiple times (IF NOT EXISTS / ALTER ... IF NOT EXISTS)

-- ── Novas colunas na tabela cargas ─────────────────────────────────────────

ALTER TABLE cargas
  ADD COLUMN IF NOT EXISTS tipo_produto       TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS modalidade         TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS tipo_carroceria    TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS fecha_retiro       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_entrega      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valor_carga        NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS moneda             TEXT    DEFAULT 'PYG',
  ADD COLUMN IF NOT EXISTS observaciones      TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS distancia_km       NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tiempo_min         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pedagios           INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_pedagio_pyg  NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chofer_nombre      TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS chofer_placa       TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS chofer_telefono    TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS chofer_aceptado_at TIMESTAMPTZ;

-- Sync valor_carga from existing valor_gs
UPDATE cargas SET valor_carga = valor_gs WHERE valor_carga = 0 AND valor_gs > 0;

-- ── Índices para performance ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cargas_empresa_id ON cargas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cargas_status     ON cargas(status);
CREATE INDEX IF NOT EXISTS idx_cargas_created_at ON cargas(created_at DESC);

-- ── Verificação ─────────────────────────────────────────────────────────────

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'cargas'
ORDER BY ordinal_position;
