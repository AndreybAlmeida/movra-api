const express = require('express');
const pool    = require('../config/database');
const { auth } = require('../middleware/auth');
const { requireAgenciador } = require('../middleware/roles');

const router = express.Router();

// GET /agenciador/empresas — listar empresas representadas
router.get('/empresas', auth, requireAgenciador, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM empresas_representadas
       WHERE agenciador_id=$1
       ORDER BY nombre ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET /agenciador/empresas]', err);
    res.status(500).json({ error: 'Error al buscar empresas representadas' });
  }
});

// POST /agenciador/empresas — adicionar empresa representada
router.post('/empresas', auth, requireAgenciador, async (req, res) => {
  const { nombre, ruc = '', telefono = '', direccion = '', responsable = '' } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO empresas_representadas (agenciador_id, nombre, ruc, telefono, direccion, responsable)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, nombre, ruc, telefono, direccion, responsable]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /agenciador/empresas]', err);
    res.status(500).json({ error: 'Error al crear empresa representada' });
  }
});

// PATCH /agenciador/empresas/:id — editar empresa representada
router.patch('/empresas/:id', auth, requireAgenciador, async (req, res) => {
  const { nombre, ruc, telefono, direccion, responsable } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE empresas_representadas SET
        nombre      = COALESCE($1, nombre),
        ruc         = COALESCE($2, ruc),
        telefono    = COALESCE($3, telefono),
        direccion   = COALESCE($4, direccion),
        responsable = COALESCE($5, responsable)
       WHERE id=$6 AND agenciador_id=$7 RETURNING *`,
      [nombre, ruc, telefono, direccion, responsable, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Empresa representada no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH /agenciador/empresas/:id]', err);
    res.status(500).json({ error: 'Error al actualizar empresa representada' });
  }
});

// DELETE /agenciador/empresas/:id — remover empresa representada
router.delete('/empresas/:id', auth, requireAgenciador, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM empresas_representadas WHERE id=$1 AND agenciador_id=$2 RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Empresa representada no encontrada' });
    res.json({ ok: true, mensaje: 'Empresa representada eliminada' });
  } catch (err) {
    console.error('[DELETE /agenciador/empresas/:id]', err);
    res.status(500).json({ error: 'Error al eliminar empresa representada' });
  }
});

module.exports = router;
