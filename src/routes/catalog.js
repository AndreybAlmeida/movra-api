const express = require('express');
const pool    = require('../config/database');
const { auth, authOptional } = require('../middleware/auth');

const router = express.Router();

const VALID_CATEGORIES = ['cargo_type', 'transported_product', 'truck_type', 'body_type'];
const VALID_STATUSES   = ['active', 'pending_review', 'inactive'];

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function sanitize(str) {
  return str.replace(/[<>"'`]/g, '').trim();
}

// GET /catalog-options?category=truck_type
router.get('/', authOptional, async (req, res) => {
  const { category } = req.query;
  if (category && !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Categoría inválida' });
  }

  try {
    const params = [];
    let where = `(status = 'active' AND scope = 'global')`;

    if (req.user?.id) {
      params.push(req.user.id);
      where += ` OR (created_by_account_id = $${params.length} AND status IN ('pending_review','active'))`;
    }

    if (category) {
      params.push(category);
      where = `(${where}) AND category = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT id, category, name, normalized_name, status, scope, created_at
       FROM catalog_options
       WHERE ${where}
       ORDER BY
         CASE status WHEN 'active' THEN 0 ELSE 1 END,
         name ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET /catalog-options]', err);
    res.status(500).json({ error: 'Error al obtener opciones' });
  }
});

// POST /catalog-options — crear nueva opción
router.post('/', auth, async (req, res) => {
  const { category, name } = req.body;

  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Categoría inválida' });
  }
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Nombre requerido' });
  }
  const clean = sanitize(name);
  if (clean.length < 2)  return res.status(400).json({ error: 'Mínimo 2 caracteres' });
  if (clean.length > 80) return res.status(400).json({ error: 'Máximo 80 caracteres' });

  const norm = normalize(clean);

  try {
    // Check duplicate
    const dup = await pool.query(
      `SELECT id, name, status FROM catalog_options
       WHERE normalized_name = $1 AND category = $2`,
      [norm, category]
    );
    if (dup.rows[0]) {
      return res.status(409).json({
        error: 'Esta opción ya existe',
        option: dup.rows[0],
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO catalog_options
         (category, name, normalized_name, status, scope, created_by_account_id)
       VALUES ($1, $2, $3, 'pending_review', 'account', $4)
       RETURNING *`,
      [category, clean, norm, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /catalog-options]', err);
    res.status(500).json({ error: err.message || 'Error al crear opción' });
  }
});

// PATCH /catalog-options/:id — editar nombre
router.patch('/:id', auth, async (req, res) => {
  const { name, status } = req.body;
  const updates = [];
  const params  = [];

  if (name) {
    const clean = sanitize(name);
    if (clean.length < 2 || clean.length > 80) {
      return res.status(400).json({ error: 'Nombre entre 2 y 80 caracteres' });
    }
    params.push(clean, normalize(clean));
    updates.push(`name = $${params.length - 1}`, `normalized_name = $${params.length}`);
  }
  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }
    params.push(status);
    updates.push(`status = $${params.length}`);
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Sin cambios' });

  params.push(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE catalog_options SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Opción no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH /catalog-options/:id]', err);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

// PATCH /catalog-options/:id/approve
router.patch('/:id/approve', auth, async (req, res) => {
  const isAdmin = req.user.email === 'admin@movra.py' || req.user.tipo === 'admin';
  if (!isAdmin) {
    return res.status(403).json({ error: 'Solo administradores pueden aprobar' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE catalog_options
       SET status = 'active', scope = 'global',
           approved_by_user_id = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Opción no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH /catalog-options/:id/approve]', err);
    res.status(500).json({ error: 'Error al aprobar' });
  }
});

// PATCH /catalog-options/:id/inactivate
router.patch('/:id/inactivate', auth, async (req, res) => {
  const isAdmin = req.user.email === 'admin@movra.py' || req.user.tipo === 'admin';
  if (!isAdmin) {
    return res.status(403).json({ error: 'Solo administradores pueden inactivar' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE catalog_options SET status = 'inactive', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Opción no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH /catalog-options/:id/inactivate]', err);
    res.status(500).json({ error: 'Error al inactivar' });
  }
});

module.exports = router;
