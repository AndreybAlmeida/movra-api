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
              status, creditos, score, viajes, docs,
              foto_perfil, foto_camion,
              created_at
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
    foto_perfil, foto_camion,
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
        capacidad       = COALESCE($7, capacidad),
        foto_perfil     = COALESCE($8, foto_perfil),
        foto_camion     = COALESCE($9, foto_camion)
       WHERE id=$10
       RETURNING id, nombre, email, telefono, ci, placa, tipo_camion, tipo_carroceria, capacidad, status, creditos, foto_perfil, foto_camion`,
      [nombre, telefono, ci, placa, tipo_camion, tipo_carroceria, capacidad, foto_perfil||null, foto_camion||null, req.user.id]
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

// GET /chofer/fletes/en_curso — inclui concluido sem avaliação para mostrar botão de rating
router.get('/fletes/en_curso', auth, requireChofer, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*
       FROM cargas c
       WHERE c.chofer_solicitante_id=$1
         AND (
           c.status IN ('retiro_agendado', 'en_transito')
           OR (c.status = 'concluido' AND c.rating_empresa IS NULL)
         )
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
              c.tipo_camion, c.tipo_carroceria, c.empresa_nombre,
              c.rating_empresa, c.rating_chofer
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

// PATCH /chofer/senha — alterar senha
router.patch('/senha', auth, requireChofer, async (req, res) => {
  const { senha_actual, senha_nueva } = req.body;
  if (!senha_actual || !senha_nueva) {
    return res.status(400).json({ error: 'senha_actual y senha_nueva son obligatorias' });
  }
  if (senha_nueva.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener mínimo 6 caracteres' });
  }
  const bcrypt = require('bcryptjs');
  try {
    const { rows } = await pool.query('SELECT senha_hash FROM choferes WHERE id=$1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Chofer no encontrado' });
    const ok = await bcrypt.compare(senha_actual, rows[0].senha_hash);
    if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    const hash = await bcrypt.hash(senha_nueva, 10);
    await pool.query('UPDATE choferes SET senha_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /chofer/senha]', err);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// PATCH /chofer/foto — atualizar foto de perfil (base64)
router.patch('/foto', auth, requireChofer, async (req, res) => {
  const { foto_perfil } = req.body;
  if (!foto_perfil) return res.status(400).json({ error: 'foto_perfil obligatoria' });
  try {
    const { rows } = await pool.query(
      'UPDATE choferes SET foto_perfil=$1 WHERE id=$2 RETURNING id, foto_perfil',
      [foto_perfil, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Chofer no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH /chofer/foto]', err);
    res.status(500).json({ error: 'Error al guardar foto' });
  }
});

// PATCH /chofer/foto-camion — atualizar foto do caminhão (base64)
router.patch('/foto-camion', auth, requireChofer, async (req, res) => {
  const { foto_camion } = req.body;
  if (!foto_camion) return res.status(400).json({ error: 'foto_camion obligatoria' });
  try {
    const { rows } = await pool.query(
      'UPDATE choferes SET foto_camion=$1 WHERE id=$2 RETURNING id, foto_camion',
      [foto_camion, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Chofer no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH /chofer/foto-camion]', err);
    res.status(500).json({ error: 'Error al guardar foto' });
  }
});

module.exports = router;
