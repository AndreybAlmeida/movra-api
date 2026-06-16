const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');
const { TIPOS_CUENTA } = require('../config/constants');

const router = express.Router();

// POST /auth/register — Registrar Transportista ou Agenciador
router.post('/register', async (req, res) => {
  const {
    nombre, ruc = '', contacto = '', email, senha,
    tipo_cuenta = 'transportista', telefono = '', direccion = '',
  } = req.body;

  if (!nombre || !email || !senha) {
    return res.status(400).json({ error: 'nombre, email y senha son obligatorios' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener mínimo 6 caracteres' });
  }
  if (!TIPOS_CUENTA.includes(tipo_cuenta)) {
    return res.status(400).json({ error: `tipo_cuenta debe ser: ${TIPOS_CUENTA.join(' | ')}` });
  }

  try {
    const senha_hash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
      `INSERT INTO empresas (nombre, ruc, contacto, email, senha_hash, tipo_cuenta, telefono, direccion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, nombre, email, plan, tipo_cuenta, created_at`,
      [nombre, ruc, contacto, email, senha_hash, tipo_cuenta, telefono, direccion]
    );
    const user = rows[0];
    const token = jwt.sign(
      { tipo: 'empresa', id: user.id, nombre: user.nombre, email: user.email, plan: user.plan, tipo_cuenta: user.tipo_cuenta },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.status(201).json({ token, user: { ...user, tipo: 'empresa' } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email ya registrado' });
    console.error('[POST /auth/register]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /auth/register/chofer — Registrar Chofer
router.post('/register/chofer', async (req, res) => {
  const {
    nombre, email, senha,
    telefono = '', ci = '', placa = '',
    tipo_camion = '', tipo_carroceria = '', capacidad = '',
  } = req.body;

  if (!nombre || !email || !senha) {
    return res.status(400).json({ error: 'nombre, email y senha son obligatorios' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener mínimo 6 caracteres' });
  }

  try {
    const senha_hash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
      `INSERT INTO choferes (nombre, email, senha_hash, telefono, ci, placa, tipo_camion, tipo_carroceria, capacidad, creditos, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,3,'pendiente')
       RETURNING id, nombre, email, telefono, ci, placa, tipo_camion, tipo_carroceria, creditos, status, created_at`,
      [nombre, email, senha_hash, telefono, ci, placa, tipo_camion, tipo_carroceria, capacidad]
    );
    const user = rows[0];
    const token = jwt.sign(
      { tipo: 'chofer', id: user.id, nombre: user.nombre, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.status(201).json({ token, user: { ...user, tipo: 'chofer' } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email ya registrado' });
    console.error('[POST /auth/register/chofer]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /auth/login — Login universal (empresa ou chofer)
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ error: 'email y senha son obligatorios' });
  }

  try {
    // Tenta empresa primeiro
    const empRes = await pool.query('SELECT * FROM empresas WHERE email=$1', [email]);
    if (empRes.rows[0]) {
      const empresa = empRes.rows[0];
      const ok = await bcrypt.compare(senha, empresa.senha_hash);
      if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
      const user = {
        id: empresa.id, nombre: empresa.nombre, email: empresa.email,
        plan: empresa.plan, tipo_cuenta: empresa.tipo_cuenta,
      };
      const token = jwt.sign(
        { tipo: 'empresa', ...user },
        JWT_SECRET,
        { expiresIn: '30d' }
      );
      return res.json({ token, user: { ...user, tipo: 'empresa' } });
    }

    // Tenta chofer
    const choferRes = await pool.query('SELECT * FROM choferes WHERE email=$1', [email]);
    if (choferRes.rows[0]) {
      const chofer = choferRes.rows[0];
      const ok = await bcrypt.compare(senha, chofer.senha_hash);
      if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
      const user = {
        id: chofer.id, nombre: chofer.nombre, email: chofer.email,
        creditos: chofer.creditos, status: chofer.status,
      };
      const token = jwt.sign(
        { tipo: 'chofer', ...user },
        JWT_SECRET,
        { expiresIn: '30d' }
      );
      return res.json({ token, user: { ...user, tipo: 'chofer' } });
    }

    res.status(401).json({ error: 'Credenciales inválidas' });
  } catch (err) {
    console.error('[POST /auth/login]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /auth/empresa/perfil
router.get('/empresa/perfil', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token ausente' });
  try {
    const { id, tipo } = jwt.verify(header.slice(7), JWT_SECRET);
    if (tipo !== 'empresa') return res.status(403).json({ error: 'Acceso denegado' });
    const { rows } = await pool.query(
      'SELECT id, nombre, ruc, contacto, email, telefono, direccion, plan, tipo_cuenta FROM empresas WHERE id=$1',
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
});

// PATCH /auth/empresa/senha — alterar senha da empresa
router.patch('/empresa/senha', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token ausente' });
  const { senha_actual, senha_nueva } = req.body;
  if (!senha_actual || !senha_nueva) {
    return res.status(400).json({ error: 'senha_actual y senha_nueva son obligatorias' });
  }
  if (senha_nueva.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener mínimo 6 caracteres' });
  }
  try {
    const { id, tipo } = jwt.verify(header.slice(7), JWT_SECRET);
    if (tipo !== 'empresa') return res.status(403).json({ error: 'Acceso denegado' });
    const { rows } = await pool.query('SELECT senha_hash FROM empresas WHERE id=$1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    const ok = await bcrypt.compare(senha_actual, rows[0].senha_hash);
    if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    const hash = await bcrypt.hash(senha_nueva, 10);
    await pool.query('UPDATE empresas SET senha_hash=$1 WHERE id=$2', [hash, id]);
    res.json({ ok: true });
  } catch { res.status(401).json({ error: 'Token inválido' }); }
});

// PATCH /auth/empresa/perfil
router.patch('/empresa/perfil', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token ausente' });
  try {
    const { id, tipo } = jwt.verify(header.slice(7), JWT_SECRET);
    if (tipo !== 'empresa') return res.status(403).json({ error: 'Acceso denegado' });
    const { nombre, ruc, contacto, telefono, direccion } = req.body;
    const { rows } = await pool.query(
      `UPDATE empresas SET
        nombre    = COALESCE($1, nombre),
        ruc       = COALESCE($2, ruc),
        contacto  = COALESCE($3, contacto),
        telefono  = COALESCE($4, telefono),
        direccion = COALESCE($5, direccion)
       WHERE id=$6
       RETURNING id, nombre, ruc, contacto, email, telefono, direccion, plan, tipo_cuenta`,
      [nombre || null, ruc || null, contacto || null, telefono || null, direccion || null, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
});

module.exports = router;
