-- MOVRA v5 — Catálogo, fotos, ratings e documentação
-- Seguro para executar múltiplas vezes (IF NOT EXISTS em tudo)

-- ────────────────────────────────────────────────────────────
-- 1. FOTOS DO CHOFER
-- ────────────────────────────────────────────────────────────
ALTER TABLE choferes
  ADD COLUMN IF NOT EXISTS foto_perfil TEXT,
  ADD COLUMN IF NOT EXISTS foto_camion TEXT;

-- ────────────────────────────────────────────────────────────
-- 2. RATINGS NAS CARGAS (avaliação mútua)
-- ────────────────────────────────────────────────────────────
ALTER TABLE cargas
  ADD COLUMN IF NOT EXISTS rating_chofer  SMALLINT,
  ADD COLUMN IF NOT EXISTS rating_empresa SMALLINT,
  ADD COLUMN IF NOT EXISTS rating_obs     TEXT;

-- ────────────────────────────────────────────────────────────
-- 3. CATALOG_OPTIONS — catálogo dinâmico de tipos e produtos
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalog_options (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category              VARCHAR(50) NOT NULL,
  name                  VARCHAR(80) NOT NULL,
  normalized_name       VARCHAR(80) NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'pending_review',
  scope                 VARCHAR(20) NOT NULL DEFAULT 'global',
  created_by_user_id    UUID,
  created_by_account_id UUID,
  approved_by_user_id   UUID,
  approved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (normalized_name, category)
);

CREATE INDEX IF NOT EXISTS idx_catalog_options_category ON catalog_options(category);
CREATE INDEX IF NOT EXISTS idx_catalog_options_status   ON catalog_options(status);
CREATE INDEX IF NOT EXISTS idx_catalog_options_account  ON catalog_options(created_by_account_id);

-- ────────────────────────────────────────────────────────────
-- 4. SEED — Tipos de camión
-- ────────────────────────────────────────────────────────────
INSERT INTO catalog_options (category, name, normalized_name, status, scope) VALUES
  ('truck_type','Fiorino',        'fiorino',        'active','global'),
  ('truck_type','VLC',            'vlc',            'active','global'),
  ('truck_type','Toco',           'toco',           'active','global'),
  ('truck_type','3/4',            '3/4',            'active','global'),
  ('truck_type','Bitruck',        'bitruck',        'active','global'),
  ('truck_type','Truck',          'truck',          'active','global'),
  ('truck_type','Bitrem',         'bitrem',         'active','global'),
  ('truck_type','Carreta',        'carreta',        'active','global'),
  ('truck_type','Carreta LS',     'carreta ls',     'active','global'),
  ('truck_type','Rodotrem',       'rodotrem',       'active','global'),
  ('truck_type','Vanderleia',     'vanderleia',     'active','global')
ON CONFLICT (normalized_name, category) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 5. SEED — Tipos de carrocería
-- ────────────────────────────────────────────────────────────
INSERT INTO catalog_options (category, name, normalized_name, status, scope) VALUES
  ('body_type','Baú',             'bau',             'active','global'),
  ('body_type','Plataforma',      'plataforma',      'active','global'),
  ('body_type','Graneleira',      'graneleira',      'active','global'),
  ('body_type','Basculante',      'basculante',      'active','global'),
  ('body_type','Frigorífica',     'frigorifica',     'active','global'),
  ('body_type','Tanque',          'tanque',          'active','global'),
  ('body_type','Sider',           'sider',           'active','global'),
  ('body_type','Fechada',         'fechada',         'active','global'),
  ('body_type','Porta-contêiner', 'porta-conteiner', 'active','global'),
  ('body_type','Aberta',          'aberta',          'active','global'),
  ('body_type','Caçamba',         'cacamba',         'active','global')
ON CONFLICT (normalized_name, category) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 6. SEED — Productos transportados
-- ────────────────────────────────────────────────────────────
INSERT INTO catalog_options (category, name, normalized_name, status, scope) VALUES
  ('transported_product','Grãos',                  'graos',                  'active','global'),
  ('transported_product','Bebidas',                'bebidas',                'active','global'),
  ('transported_product','Electrónicos',           'electronicos',           'active','global'),
  ('transported_product','Alimentos perecederos',  'alimentos perecederos',  'active','global'),
  ('transported_product','Productos químicos',     'productos quimicos',     'active','global'),
  ('transported_product','Materiales construcción','materiales construccion','active','global'),
  ('transported_product','Textiles',               'textiles',               'active','global'),
  ('transported_product','Maquinaria',             'maquinaria',             'active','global'),
  ('transported_product','Combustibles',           'combustibles',           'active','global'),
  ('transported_product','Mercaderías generales',  'mercaderias generales',  'active','global'),
  ('transported_product','Animales vivos',         'animales vivos',         'active','global'),
  ('transported_product','Productos farmacéuticos','productos farmaceuticos','active','global')
ON CONFLICT (normalized_name, category) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 7. SEED — Tipos de carga
-- ────────────────────────────────────────────────────────────
INSERT INTO catalog_options (category, name, normalized_name, status, scope) VALUES
  ('cargo_type','Carga completa',  'carga completa',  'active','global'),
  ('cargo_type','Fraccionada',     'fraccionada',     'active','global'),
  ('cargo_type','Urgente',         'urgente',         'active','global'),
  ('cargo_type','Peligrosa',       'peligrosa',       'active','global'),
  ('cargo_type','Refrigerada',     'refrigerada',     'active','global')
ON CONFLICT (normalized_name, category) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 8. VERIFICAÇÃO
-- ────────────────────────────────────────────────────────────
SELECT 'catalog_options' AS tabela, COUNT(*) FROM catalog_options;
