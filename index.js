require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const app  = express();
const dbUrl = (process.env.DATABASE_URL || '').replace('channel_binding=require', 'sslmode=require').replace('&&', '&').replace('?&', '?');
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
  const { origen, destino, tipo, peso = '', valor_gs = 0, fecha_salida, tipo_camion = '', especializacion = '', carga_peligrosa = false } = req.body;
  if (!origen || !destino || !tipo) return res.status(400).json({ error: 'origen, destino e tipo são obrigatórios' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO cargas (empresa_id, empresa_nombre, origen, destino, tipo, peso, valor_gs, fecha_salida, tipo_camion, especializacion, carga_peligrosa)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.empresa.id, req.empresa.nombre, origen, destino, tipo, peso, valor_gs, fecha_salida || null, tipo_camion, especializacion, carga_peligrosa]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar carga' });
  }
});

// PATCH /cargas/:id  — editar carga completa
app.patch('/cargas/:id', auth, async (req, res) => {
  const { origen, destino, tipo, peso, valor_gs, fecha_salida, tipo_camion, especializacion, carga_peligrosa, status } = req.body;
  const VALID_STATUS = ['pendiente', 'asignada', 'en_transito', 'entregada', 'urgente'];
  if (status && !VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Status inválido' });
  try {
    const { rows } = await pool.query(
      `UPDATE cargas SET
        origen=$1, destino=$2, tipo=$3, peso=$4, valor_gs=$5, fecha_salida=$6,
        tipo_camion=$7, especializacion=$8, carga_peligrosa=$9,
        status=COALESCE($10, status)
       WHERE id=$11 AND empresa_id=$12 RETURNING *`,
      [origen, destino, tipo, peso, valor_gs, fecha_salida || null, tipo_camion || '', especializacion || '', carga_peligrosa || false, status || null, req.params.id, req.empresa.id]
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
  const VALID = ['pendiente', 'asignada', 'en_transito', 'entregada', 'urgente'];
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
