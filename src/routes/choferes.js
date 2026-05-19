const express = require('express');
const pool    = require('../config/database');
const { auth } = require('../middleware/auth');
const { requireChofer } = require('../middleware/roles');

const router = express.Router();

// GET /chofer/perfil
router.get('/perfil', auth, requireChofer, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, email, telefono, ci, placa,
              tipo_camion, tipo_carroceria, capacidad,
              lat, lng, location_updated_at,
              status, creditos, score, viajes, docs, created_at
       FROM choferes WHERE id=$1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Chofer no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[GET /chofer/perfil]', err);
    res.status(500).json({ error: 'Error al buscar perfil' });
  }
});

// PATCH /chofer/perfil — atualizar perfil
router.patch('/perfil', auth, requireChofer, async (req, res) => {
  const {
    nombre, telefono, ci, placa,
    tipo_camion, tipo_carroceria, capacidad,
  } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE choferes SET
        nombre   = COALESCE($1, nombre),
        telefono = COALESCE($2, telefono),
        ci       = COALESCE($3, ci),
        placa    = COALESCE($4, placa),
        tipo_camion     = COALESCE($5, tipo_camion),
        tipo_carroceria = COALESCE($6, tipo_carroceria),
        capacidad       = COALESCE($7, capacidad)
       WHERE id=$8
       RETURNING id, nombre, email, telefono, ci, placa, tipo_camion, tipo_carroceria, capacidad, status, creditos`,
      [nombre, telefono, ci, placa, tipo_camion, tipo_carroceria, capacidad, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Chofer no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH /chofer/perfil]', err);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// PATCH /chofer/location — atualizar localização GPS
router.patch('/location', auth, requireChofer, async (req, res) => {
  const { lat, lng } = req.body;
  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'lat y lng son obligatorios' });
  }
  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat y lng deben ser numéricos' });
  }
  try {
    await pool.query(
      `UPDATE choferes SET lat=$1, lng=$2, location_updated_at=NOW() WHERE id=$3`,
      [parseFloat(lat), parseFloat(lng), req.user.id]
    );
    res.json({ ok: true, lat: parseFloat(lat), lng: parseFloat(lng) });
  } catch (err) {
    console.error('[PATCH /chofer/location]', err);
    res.status(500).json({ error: 'Error al actualizar ubicación' });
  }
});

// GET /chofer/creditos — saldo + histórico
router.get('/creditos', auth, requireChofer, async (req, res) => {
  try {
    const saldoRes = await pool.query(
      'SELECT creditos FROM choferes WHERE id=$1',
      [req.user.id]
    );
    const histRes = await pool.query(
      `SELECT id, tipo, cantidad, descripcion, referencia_pago, created_at
       FROM credito_transacciones
       WHERE chofer_id=$1
       ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({
      creditos: saldoRes.rows[0]?.creditos ?? 0,
      historico: histRes.rows,
    });
  } catch (err) {
    console.error('[GET /chofer/creditos]', err);
    res.status(500).json({ error: 'Error al buscar créditos' });
  }
});

// GET /chofer/solicitudes — solicitudes enviadas pelo Chofer
router.get('/solicitudes', auth, requireChofer, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*,
              c.origen, c.destino, c.valor_carga, c.moneda,
              c.fecha_retiro, c.fecha_entrega,
              c.tipo_camion, c.tipo_carroceria
       FROM solicitudes s
       JOIN cargas c ON c.id = s.carga_id
       WHERE s.chofer_id = $1
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET /chofer/solicitudes]', err);
    res.status(500).json({ error: 'Error al buscar solicitudes' });
  }
});

// GET /chofer/fletes/aceptados
router.get('/fletes/aceptados', auth, requireChofer, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*
       FROM cargas c
       WHERE c.chofer_solicitante_id=$1 AND c.status='aceptado'
       ORDER BY c.chofer_aceptado_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET /chofer/fletes/aceptados]', err);
    res.status(500).json({ error: 'Error al buscar fletes' });
  }
});

// GET /chofer/fletes/en_curso
router.get('/fletes/en_curso', auth, requireChofer, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*
       FROM cargas c
       WHERE c.chofer_solicitante_id=$1
         AND c.status IN ('retiro_agendado', 'en_transito')
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET /chofer/fletes/en_curso]', err);
    res.status(500).json({ error: 'Error al buscar fletes en curso' });
  }
});

// GET /chofer/historial — histórico completo
router.get('/historial', auth, requireChofer, async (req, res) => {
  const { limit = 30, offset = 0 } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.origen, c.destino, c.valor_carga, c.moneda,
              c.fecha_retiro, c.fecha_entrega, c.status,
              c.tipo_camion, c.tipo_carroceria, c.empresa_nombre
       FROM cargas c
       WHERE c.chofer_solicitante_id=$1
         AND c.status IN ('concluido', 'cancelado', 'rechazado')
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, Number(limit), Number(offset)]
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET /chofer/historial]', err);
    res.status(500).json({ error: 'Error al buscar historial' });
  }
});

module.exports = router;
