-- MOVRA — Schema inicial
-- Rodar no PostgreSQL do Render via psql ou shell do serviço

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Empresas (clientes da plataforma)
CREATE TABLE IF NOT EXISTS empresas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        UNIQUE NOT NULL,
  senha_hash  TEXT        NOT NULL,
  nombre      TEXT        NOT NULL,
  ruc         TEXT        DEFAULT '',
  contacto    TEXT        DEFAULT '',
  plan        TEXT        DEFAULT 'Starter',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Sequência para IDs legíveis de cargas
CREATE SEQUENCE IF NOT EXISTS cargas_seq START 1;

-- Cargas publicadas pelas empresas
CREATE TABLE IF NOT EXISTS cargas (
  id                 TEXT        PRIMARY KEY DEFAULT 'CRG-' || LPAD(nextval('cargas_seq')::TEXT, 3, '0'),
  empresa_id         UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  empresa_nombre     TEXT        NOT NULL,
  origen             TEXT        NOT NULL,
  destino            TEXT        NOT NULL,
  tipo               TEXT        NOT NULL,
  peso               TEXT        DEFAULT '',
  valor_gs           BIGINT      DEFAULT 0,
  fecha_salida       DATE,
  status             TEXT        DEFAULT 'pendiente',
  transportista_nombre TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargas_empresa ON cargas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cargas_status  ON cargas(status);

-- Transportistas na rede MOVRA
CREATE TABLE IF NOT EXISTS transportistas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT        NOT NULL,
  vehiculo    TEXT        DEFAULT '',
  placa       TEXT        DEFAULT '',
  ciudad      TEXT        DEFAULT '',
  status      TEXT        DEFAULT 'disponible',
  score       NUMERIC(3,1) DEFAULT 4.5,
  viajes      INT         DEFAULT 0,
  capacidad   TEXT        DEFAULT '',
  zona        TEXT        DEFAULT '',
  respuesta   TEXT        DEFAULT '15 min',
  docs        TEXT[]      DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
