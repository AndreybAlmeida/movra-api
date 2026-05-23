-- Migration: catalog_options table
-- Run this in the Neon PostgreSQL console

CREATE TABLE IF NOT EXISTS catalog_options (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category             VARCHAR(50)  NOT NULL,  -- cargo_type | transported_product | truck_type | body_type
  name                 VARCHAR(80)  NOT NULL,
  normalized_name      VARCHAR(80)  NOT NULL,
  status               VARCHAR(20)  NOT NULL DEFAULT 'pending_review', -- active | pending_review | inactive
  scope                VARCHAR(20)  NOT NULL DEFAULT 'global',          -- global | account
  created_by_user_id   INTEGER,
  created_by_account_id INTEGER,
  approved_by_user_id  INTEGER,
  approved_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (normalized_name, category)
);

CREATE INDEX IF NOT EXISTS idx_catalog_options_category ON catalog_options(category);
CREATE INDEX IF NOT EXISTS idx_catalog_options_status   ON catalog_options(status);
CREATE INDEX IF NOT EXISTS idx_catalog_options_account  ON catalog_options(created_by_account_id);

-- Seed: tipos de camión
INSERT INTO catalog_options (category, name, normalized_name, status, scope) VALUES
  ('truck_type','Fiorino',       'fiorino',        'active','global'),
  ('truck_type','VLC',           'vlc',            'active','global'),
  ('truck_type','Toco',          'toco',           'active','global'),
  ('truck_type','3/4',           '3/4',            'active','global'),
  ('truck_type','Bitruck',       'bitruck',        'active','global'),
  ('truck_type','Truck',         'truck',          'active','global'),
  ('truck_type','Bitrem',        'bitrem',         'active','global'),
  ('truck_type','Carreta',       'carreta',        'active','global'),
  ('truck_type','Carreta LS',    'carreta ls',     'active','global'),
  ('truck_type','Rodotrem',      'rodotrem',       'active','global'),
  ('truck_type','Vanderleia',    'vanderleia',     'active','global')
ON CONFLICT (normalized_name, category) DO NOTHING;

-- Seed: tipos de carrocería
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

-- Seed: productos transportados
INSERT INTO catalog_options (category, name, normalized_name, status, scope) VALUES
  ('transported_product','Grãos',                      'graos',                      'active','global'),
  ('transported_product','Bebidas',                    'bebidas',                    'active','global'),
  ('transported_product','Electrónicos',               'electronicos',               'active','global'),
  ('transported_product','Alimentos perecederos',      'alimentos perecederos',      'active','global'),
  ('transported_product','Productos químicos',         'productos quimicos',         'active','global'),
  ('transported_product','Materiales de construcción', 'materiales de construccion', 'active','global'),
  ('transported_product','Animales vivos',             'animales vivos',             'active','global'),
  ('transported_product','Electrodomésticos',          'electrodomesticos',          'active','global'),
  ('transported_product','Sobredimensionado',          'sobredimensionado',          'active','global'),
  ('transported_product','Medicamentos',               'medicamentos',               'active','global'),
  ('transported_product','Textiles',                   'textiles',                   'active','global'),
  ('transported_product','Sacas',                      'sacas',                      'active','global')
ON CONFLICT (normalized_name, category) DO NOTHING;

-- Seed: tipos de carga
INSERT INTO catalog_options (category, name, normalized_name, status, scope) VALUES
  ('cargo_type','Carga general',      'carga general',     'active','global'),
  ('cargo_type','Carga refrigerada',  'carga refrigerada', 'active','global'),
  ('cargo_type','Carga peligrosa',    'carga peligrosa',   'active','global'),
  ('cargo_type','Carga a granel',     'carga a granel',    'active','global'),
  ('cargo_type','Carga especial',     'carga especial',    'active','global'),
  ('cargo_type','Mudanza',            'mudanza',           'active','global'),
  ('cargo_type','Contenedor',         'contenedor',        'active','global')
ON CONFLICT (normalized_name, category) DO NOTHING;
