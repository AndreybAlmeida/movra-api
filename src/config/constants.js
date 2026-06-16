const VALID_STATUS = [
  'publicado',
  'disponible',
  'desbloqueado',
  'pendiente_aprobacion',
  'aceptado',
  'documentacion_pendiente',
  'documentacion_enviada',
  'retiro_agendado',
  'en_transito',
  'concluido',
  'cancelado',
  'rechazado',
];

const MONEDAS = ['PYG', 'BRL', 'USD'];

const TIPOS_CUENTA = ['transportista', 'agenciador'];

const PACOTES_CREDITOS = [
  { id: 'P1',  nombre: '1 crédito',   creditos: 1,  precio_pyg: 15000  },
  { id: 'P3',  nombre: '3 créditos',  creditos: 3,  precio_pyg: 40000  },
  { id: 'P5',  nombre: '5 créditos',  creditos: 5,  precio_pyg: 65000  },
  { id: 'P10', nombre: '10 créditos', creditos: 10, precio_pyg: 120000 },
];

const CREDITOS_POR_DESBLOQUEO = 1;

const ALLOWED_ORIGINS = [
  'https://movra-mvp.vercel.app',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://localhost:5173',
];

module.exports = {
  VALID_STATUS,
  MONEDAS,
  TIPOS_CUENTA,
  PACOTES_CREDITOS,
  CREDITOS_POR_DESBLOQUEO,
  ALLOWED_ORIGINS,
};
