require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const app  = express();
const dbUrl = (process.env.DATABASE_URL || '')
  .replace(/[?&]channel_binding=[^&]*/g, '')
  .replace(/&&/g, '&')
  .replace(/\?&/g, '?')
  .replace(/[?&]$/, '');
const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const JWT_SECRET = process.env.JWT_SECRET || 'movra_dev_secret_change_in_prod';
const ALLOWED_ORIGINS = [
  'https://movra-mvp.vercel.app',
  'http://localhost:8080',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS não permitido para ' + origin));
  },
}));
app.use(express.json());

/* ── Auth middleware ───────────────────────────────── */
const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token ausente' });
  try {
    req.empresa = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

/* ── Health check ──────────────────────────────────── */
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

/* ════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════ */

// POST /auth/register
app.post('/auth/register', async (req, res) => {
  const { nombre, ruc = '', contacto = '', email, senha } = req.body;
  if (!nombre || !email || !senha) return res.status(400).json({ error: 'nombre, email e senha são obrigatórios' });
  if (senha.length < 6) return res.status(400).json({ error: 'Senha mínima de 6 caracteres' });
  try {
    const senha_hash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
      `INSERT INTO empresas (nombre, ruc, contacto, email, senha_hash)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, nombre, email, plan, created_at`,
      [nombre, ruc, contacto, email, senha_hash]
    );
    const user = rows[0];
    const token = jwt.sign({ id: user.id, nombre: user.nombre, email: user.email, plan: user.plan }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email já cadastrado' });
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: 'email e senha são obrigatórios' });
  try {
    const { rows } = await pool.query('SELECT * FROM empresas WHERE email=$1', [email]);
    if (!rows[0]) return res.status(401).json({ error: 'Credenciais inválidas' });
    const ok = await bcrypt.compare(senha, rows[0].senha_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
    const user = { id: rows[0].id, nombre: rows[0].nombre, email: rows[0].email, plan: rows[0].plan };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

/* ════════════════════════════════════════════════════
   CARGAS
════════════════════════════════════════════════════ */

// GET /cargas  — cargas da empresa logada
app.get('/cargas', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM cargas WHERE empresa_id=$1 ORDER BY created_at DESC`,
      [req.empresa.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar cargas' });
  }
});

// POST /cargas  — publicar nova carga
app.post('/cargas', auth, async (req, res) => {
  const {
    origen, destino,
    tipo = '', tipo_produto = '', modalidade = '', peso = '',
    valor_gs = 0, valor_carga = 0, moneda = 'PYG',
    fecha_salida, fecha_retiro, fecha_entrega,
    tipo_camion = '', tipo_carroceria = '', especializacion = '',
    carga_peligrosa = false, observaciones = '',
    distancia_km = 0, tiempo_min = 0, pedagios = 0, costo_pedagio_pyg = 0,
  } = req.body;
  if (!origen || !destino) return res.status(400).json({ error: 'origen y destino son obligatorios' });
  if (origen === destino) return res.status(400).json({ error: 'origen y destino deben ser diferentes' });
  const valorFinal = Number(valor_carga) || Number(valor_gs) || 0;
  try {
    const { rows } = await pool.query(
      `INSERT INTO cargas (
        empresa_id, empresa_nombre, origen, destino,
        tipo, tipo_produto, modalidade, peso,
        valor_gs, valor_carga, moneda,
        fecha_salida, fecha_retiro, fecha_entrega,
        tipo_camion, tipo_carroceria, especializacion,
        carga_peligrosa, observaciones,
        distancia_km, tiempo_min, pedagios, costo_pedagio_pyg
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING *`,
      [
        req.empresa.id, req.empresa.nombre, origen, destino,
        tipo, tipo_produto, modalidade, peso,
        valorFinal, valorFinal, moneda,
        fecha_salida || null, fecha_retiro || null, fecha_entrega || null,
        tipo_camion, tipo_carroceria, especializacion,
        !!carga_peligrosa, observaciones,
        Number(distancia_km), Number(tiempo_min), Number(pedagios), Number(costo_pedagio_pyg),
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /cargas]', err);
    res.status(500).json({ error: err.message || 'Erro ao criar carga' });
  }
});

// PATCH /cargas/:id  — editar carga completa
app.patch('/cargas/:id', auth, async (req, res) => {
  const {
    origen, destino,
    tipo = '', tipo_produto = '', modalidade = '', peso = '',
    valor_gs, valor_carga, moneda = 'PYG',
    fecha_salida, fecha_retiro, fecha_entrega,
    tipo_camion = '', tipo_carroceria = '', especializacion = '',
    carga_peligrosa = false, observaciones = '',
    distancia_km = 0, tiempo_min = 0, pedagios = 0, costo_pedagio_pyg = 0,
    status,
  } = req.body;
  const VALID_STATUS = ['pendiente','publicada','visualizada','desbloqueada','aceptada','asignada','agendada','en_transito','entregada','urgente','cancelada'];
  if (status && !VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Status inválido' });
  const valorFinal = Number(valor_carga) || Number(valor_gs) || 0;
  try {
    const { rows } = await pool.query(
      `UPDATE cargas SET
        origen=$1, destino=$2, tipo=$3, tipo_produto=$4, modalidade=$5, peso=$6,
        valor_gs=$7, valor_carga=$7, moneda=$8,
        fecha_salida=$9, fecha_retiro=$10, fecha_entrega=$11,
        tipo_camion=$12, tipo_carroceria=$13, especializacion=$14,
        carga_peligrosa=$15, observaciones=$16,
        distancia_km=$17, tiempo_min=$18, pedagios=$19, costo_pedagio_pyg=$20,
        status=COALESCE($21, status)
       WHERE id=$22 AND empresa_id=$23 RETURNING *`,
      [
        origen, destino, tipo, tipo_produto, modalidade, peso,
        valorFinal, moneda,
        fecha_salida || null, fecha_retiro || null, fecha_entrega || null,
        tipo_camion, tipo_carroceria, especializacion,
        !!carga_peligrosa, observaciones,
        Number(distancia_km), Number(tiempo_min), Number(pedagios), Number(costo_pedagio_pyg),
        status || null, req.params.id, req.empresa.id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Carga não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar carga' });
  }
});

// PATCH /cargas/:id/status  — atualizar só o status
app.patch('/cargas/:id/status', auth, async (req, res) => {
  const { status } = req.body;
  const VALID = ['pendiente','publicada','visualizada','desbloqueada','aceptada','asignada','agendada','en_transito','entregada','urgente','cancelada'];
  if (!VALID.includes(status)) return res.status(400).json({ error: 'Status inválido' });
  try {
    const { rows } = await pool.query(
      `UPDATE cargas SET status=$1 WHERE id=$2 AND empresa_id=$3 RETURNING *`,
      [status, req.params.id, req.empresa.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Carga não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

/* ════════════════════════════════════════════════════
   TRANSPORTISTAS
════════════════════════════════════════════════════ */

// GET /transportistas  — rede pública
app.get('/transportistas', async (req, res) => {
  const { status } = req.query;
  try {
    const { rows } = await pool.query(
      status
        ? 'SELECT * FROM transportistas WHERE status=$1 ORDER BY score DESC'
        : 'SELECT * FROM transportistas ORDER BY score DESC',
      status ? [status] : []
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar transportistas' });
  }
});

/* ── Start ─────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MOVRA API rodando na porta ${PORT}`));
