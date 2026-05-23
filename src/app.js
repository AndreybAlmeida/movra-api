require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const { ALLOWED_ORIGINS } = require('./config/constants');

// Rotas
const authRoutes        = require('./routes/auth');
const cargasRoutes      = require('./routes/cargas');
const publicRoutes      = require('./routes/public');
const choferesRoutes    = require('./routes/choferes');
const agenciadorRoutes  = require('./routes/agenciador');
const cambioRoutes      = require('./routes/cambio');
const pagosRoutes       = require('./routes/pagos');
const adminRoutes       = require('./routes/admin');
const catalogRoutes     = require('./routes/catalog');

// Rota legada de transportistas
const pool = require('./config/database');

const app = express();

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS no permitido para ' + origin));
  },
}));

app.use(express.json());

/* ── Health check ─────────────────────────────── */
app.get('/health', (_req, res) =>
  res.json({ ok: true, ts: new Date().toISOString(), version: '2.0.0' })
);

/* ── Rotas ────────────────────────────────────── */
app.use('/auth',       authRoutes);
app.use('/cargas',     cargasRoutes);
app.use('/public',     publicRoutes);
app.use('/chofer',     choferesRoutes);
app.use('/agenciador', agenciadorRoutes);
app.use('/cambio',     cambioRoutes);
app.use('/pagos',      pagosRoutes);
app.use('/admin',      adminRoutes);
app.use('/catalog-options', catalogRoutes);

/* ── Rota legada: /transportistas ─────────────── */
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
    console.error('[GET /transportistas]', err);
    res.status(500).json({ error: 'Error al buscar transportistas' });
  }
});

/* ── 404 handler ──────────────────────────────── */
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

/* ── Error handler ────────────────────────────── */
app.use((err, _req, res, _next) => {
  console.error('[Error global]', err);
  res.status(500).json({ error: err.message || 'Error interno' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MOVRA API v2.0 rodando na porta ${PORT}`));

module.exports = app;
