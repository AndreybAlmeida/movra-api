-- MOVRA v4 — Ambiente Operacional Real
-- Executar no Neon SQL Editor (console.neon.tech → projeto movra → SQL Editor)
-- Seguro para executar múltiplas vezes (IF NOT EXISTS em tudo)

-- ────────────────────────────────────────────────────────────
-- 1. CHOFERES — entidade separada de empresas
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS choferes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT        UNIQUE NOT NULL,
  senha_hash          TEXT        NOT NULL,
  nombre              TEXT        NOT NULL,
  telefono            TEXT        DEFAULT '',
  ci                  TEXT        DEFAULT '',
  placa               TEXT        DEFAULT '',
  tipo_camion         TEXT        DEFAULT '',
  tipo_carroceria     TEXT        DEFAULT '',
  capacidad           TEXT        DEFAULT '',
  lat                 NUMERIC,
  lng                 NUMERIC,
  location_updated_at TIMESTAMPTZ,
  status              TEXT        DEFAULT 'disponible',
  creditos            INT         DEFAULT 0,
  score               NUMERIC(3,1) DEFAULT 4.5,
  viajes              INT         DEFAULT 0,
  docs                TEXT[]      DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 2. EMPRESAS — expandir com tipo e contato
-- ────────────────────────────────────────────────────────────
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS tipo_cuenta TEXT DEFAULT 'transportista',
  ADD COLUMN IF NOT EXISTS telefono    TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS direccion   TEXT DEFAULT '';

-- ────────────────────────────────────────────────────────────
-- 3. EMPRESAS_REPRESENTADAS — para Agenciadores
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empresas_representadas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agenciador_id  UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre         TEXT        NOT NULL,
  ruc            TEXT        DEFAULT '',
  telefono       TEXT        DEFAULT '',
  direccion      TEXT        DEFAULT '',
  responsable    TEXT        DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 4. CARGAS — novas colunas operacionais
-- ────────────────────────────────────────────────────────────
ALTER TABLE cargas
  ADD COLUMN IF NOT EXISTS empresa_representada_id UUID REFERENCES empresas_representadas(id),
  ADD COLUMN IF NOT EXISTS chofer_solicitante_id   UUID REFERENCES choferes(id),
  ADD COLUMN IF NOT EXISTS lat_origen              NUMERIC,
  ADD COLUMN IF NOT EXISTS lng_origen              NUMERIC,
  ADD COLUMN IF NOT EXISTS lat_destino             NUMERIC,
  ADD COLUMN IF NOT EXISTS lng_destino             NUMERIC;

-- ────────────────────────────────────────────────────────────
-- 5. DESBLOQUEIOS — registro de pagamento por carga
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS desbloqueios (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  carga_id        TEXT        NOT NULL REFERENCES cargas(id),
  chofer_id       UUID        NOT NULL REFERENCES choferes(id),
  metodo_pago     TEXT        DEFAULT 'creditos',
  creditos_usados INT         DEFAULT 1,
  desbloqueado_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(carga_id, chofer_id)
);

-- ────────────────────────────────────────────────────────────
-- 6. SOLICITUDES — solicitações de carga pelo Chofer
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS solicitudes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  carga_id      TEXT        NOT NULL REFERENCES cargas(id),
  chofer_id     UUID        NOT NULL REFERENCES choferes(id),
  status        TEXT        DEFAULT 'pendiente',
  notas         TEXT        DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  respondido_at TIMESTAMPTZ,
  UNIQUE(carga_id, chofer_id)
);

-- ────────────────────────────────────────────────────────────
-- 7. CREDITO_TRANSACCIONES — histórico de créditos
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credito_transacciones (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chofer_id       UUID        NOT NULL REFERENCES choferes(id),
  tipo            TEXT        NOT NULL,
  cantidad        INT         NOT NULL,
  descripcion     TEXT        DEFAULT '',
  referencia_pago TEXT        DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 8. ÍNDICES DE PERFORMANCE
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_choferes_email        ON choferes(email);
CREATE INDEX IF NOT EXISTS idx_choferes_location     ON choferes(lat, lng);
CREATE INDEX IF NOT EXISTS idx_desbloqueios_chofer   ON desbloqueios(chofer_id);
CREATE INDEX IF NOT EXISTS idx_desbloqueios_carga    ON desbloqueios(carga_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_carga     ON solicitudes(carga_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_chofer    ON solicitudes(chofer_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_status    ON solicitudes(status);
CREATE INDEX IF NOT EXISTS idx_emp_rep_agenciador    ON empresas_representadas(agenciador_id);
CREATE INDEX IF NOT EXISTS idx_cred_trans_chofer     ON credito_transacciones(chofer_id);

-- ────────────────────────────────────────────────────────────
-- 9. VERIFICAÇÃO
-- ────────────────────────────────────────────────────────────
SELECT 'choferes'              AS tabela, COUNT(*) FROM choferes              UNION ALL
SELECT 'empresas_representadas',           COUNT(*) FROM empresas_representadas UNION ALL
SELECT 'desbloqueios',                     COUNT(*) FROM desbloqueios           UNION ALL
SELECT 'solicitudes',                      COUNT(*) FROM solicitudes            UNION ALL
SELECT 'credito_transacciones',            COUNT(*) FROM credito_transacciones;
