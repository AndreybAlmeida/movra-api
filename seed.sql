-- MOVRA — Transportistas iniciais da rede
-- Rodar após migrations.sql

INSERT INTO transportistas (nombre, vehiculo, placa, ciudad, status, score, viajes, capacidad, zona, respuesta, docs)
VALUES
  ('Carlos Benítez',  'Camión 20t',    'ADC-123', 'Asunción',        'disponible', 4.8, 142, '20 toneladas', 'Central',     '12 min', ARRAY['Cédula','Licencia','RUAT']),
  ('Miguel Ortiz',    'Semi-tráiler',  'XYZ-456', 'Ciudad del Este',  'en_ruta',    4.6,  89, '35 toneladas', 'Alto Paraná', '8 min',  ARRAY['Cédula','Licencia','RUAT','Seguro']),
  ('Juan Villalba',   'Furgón 3.5t',  'MNP-789', 'Encarnación',      'disponible', 4.9, 211, '3.5 toneladas','Itapúa',      '5 min',  ARRAY['Cédula','Licencia','RUAT','Seguro','Habilitación']),
  ('Luis Garay',      'Frigorífico 15t','QRS-321','Concepción',       'inactivo',   4.2,  67, '15 toneladas', 'Concepción',  '—',      ARRAY['Cédula','Licencia']),
  ('Pedro Amarilla',  'Camión 10t',   'LMN-654', 'Villarrica',       'disponible', 4.7, 178, '10 toneladas', 'Guairá',      '10 min', ARRAY['Cédula','Licencia','RUAT','Seguro']),
  ('Roberto Duarte',  'Semi-tráiler', 'PQR-987', 'Coronel Oviedo',   'disponible', 4.5, 134, '30 toneladas', 'Caaguazú',    '18 min', ARRAY['Cédula','Licencia','RUAT'])
ON CONFLICT DO NOTHING;
