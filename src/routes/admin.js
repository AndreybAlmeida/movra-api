const express = require('express');
const pool    = require('../config/database');
const { auth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');

const router = express.Router();

// GET /admin/cargas — todas as cargas (Torre de Control)
router.get('/cargas', auth, requireAdmin, async (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  try {
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE c.status = $1`;
    }
    params.push(Number(limit), Number(offset));

    const { rows } = await pool.query(
      `SELECT c.*,
              er.nombre AS empresa_rep_nombre,
              ch.nombre AS chofer_nombre_actual,
              ch.placa  AS chofer_placa_atual
       FROM cargas c
       LEFT JOIN empresas_representadas er ON er.id = c.empresa_representada_id
       LEFT JOIN choferes ch ON ch.id = c.chofer_solicitante_id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET /admin/cargas]', err);
    res.status(500).json({ error: 'Error al buscar cargas' });
  }
});

// GET /admin/choferes — todos os Choferes
router.get('/choferes', auth, requireAdmin, async (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  try {
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE status = $1`;
    }
    params.push(Number(limit), Number(offset));

    const { rows } = await pool.query(
      `SELECT id, nombre, email, telefono, ci, placa,
              tipo_camion, tipo_carroceria, status,
              creditos, score, viajes, created_at
       FROM choferes
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET /admin/choferes]', err);
    res.status(500).json({ error: 'Error al buscar choferes' });
  }
});

// GET /admin/empresas — todas as empresas
router.get('/empresas', auth, requireAdmin, async (req, res) => {
  const { tipo_cuenta, limit = 50, offset = 0 } = req.query;
  try {
    const params = [];
    let where = '';
    if (tipo_cuenta) {
      params.push(tipo_cuenta);
      where = `WHERE tipo_cuenta = $1`;
    }
    params.push(Number(limit), Number(offset));

    const { rows } = await pool.query(
      `SELECT id, nombre, email, ruc, contacto, telefono, direccion,
              tipo_cuenta, plan, created_at
       FROM empresas
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET /admin/empresas]', err);
    res.status(500).json({ error: 'Error al buscar empresas' });
  }
});

// GET /admin/stats — estatísticas gerais
router.get('/stats', auth, requireAdmin, async (req, res) => {
  try {
    const [cargas, choferes, empresas, solicitudes, desbloqueios] = await Promise.all([
      pool.query(`
        SELECT status, COUNT(*) AS total
        FROM cargas GROUP BY status ORDER BY total DESC
      `),
      pool.query(`SELECT COUNT(*) AS total, COUNT(CASE WHEN status='disponible' THEN 1 END) AS disponibles FROM choferes`),
      pool.query(`SELECT COUNT(*) AS total, COUNT(CASE WHEN tipo_cuenta='agenciador' THEN 1 END) AS agenciadores FROM empresas`),
      pool.query(`SELECT COUNT(*) AS total, COUNT(CASE WHEN status='aprobado' THEN 1 END) AS aprobadas FROM solicitudes`),
      pool.query(`SELECT COUNT(*) AS total, SUM(creditos_usados) AS creditos_consumidos FROM desbloqueios`),
    ]);

    res.json({
      cargas: cargas.rows,
      choferes: choferes.rows[0],
      empresas: empresas.rows[0],
      solicitudes: solicitudes.rows[0],
      desbloqueios: desbloqueios.rows[0],
    });
  } catch (err) {
    console.error('[GET /admin/stats]', err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

module.exports = router;
