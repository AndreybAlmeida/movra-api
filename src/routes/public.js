const express = require('express');
const pool    = require('../config/database');
const { auth, authOptional } = require('../middleware/auth');
const { requireChofer } = require('../middleware/roles');
const { CREDITOS_POR_DESBLOQUEO } = require('../config/constants');

const router = express.Router();

// Campos que aparecem SEM desbloqueio (mascarados)
const CAMPOS_PUBLICOS = [
  'c.id', 'c.origen', 'c.destino',
  'c.tipo', 'c.tipo_produto', 'c.tipo_camion', 'c.tipo_carroceria',
  'c.peso', 'c.valor_carga', 'c.moneda',
  'c.fecha_retiro', 'c.fecha_entrega',
  'c.distancia_km', 'c.tiempo_min', 'c.pedagios', 'c.costo_pedagio_pyg',
  'c.status', 'c.carga_peligrosa',
  'c.lat_origen', 'c.lng_origen',
  'c.created_at',
];

// Campos extras após desbloqueio
const CAMPOS_DESBLOQUEADOS = [
  ...CAMPOS_PUBLICOS,
  'c.empresa_nombre',
  'c.observaciones',
  'c.modalidade',
  'c.especializacion',
];

// GET /public/cargas — lista pública mascarada para Choferes
router.get('/cargas', authOptional, async (req, res) => {
  const { lat, lng, tipo_camion, urgente, limit = 30, offset = 0 } = req.query;

  try {
    const params = [];
    const conditions = [`c.status IN ('disponible', 'publicado')`];

    if (tipo_camion) {
      params.push(`%${tipo_camion}%`);
      conditions.push(`c.tipo_camion ILIKE $${params.length}`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // Ordenação: por proximidade se coordenadas fornecidas, senão por data
    let orderBy = 'ORDER BY c.created_at DESC';
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      orderBy = `ORDER BY
        CASE WHEN c.lat_origen IS NOT NULL AND c.lng_origen IS NOT NULL THEN
          6371 * acos(LEAST(1, cos(radians(${parseFloat(lat)})) * cos(radians(c.lat_origen)) *
            cos(radians(c.lng_origen) - radians(${parseFloat(lng)})) +
            sin(radians(${parseFloat(lat)})) * sin(radians(c.lat_origen))))
        ELSE 99999 END ASC,
        c.created_at DESC`;
    }

    params.push(Number(limit), Number(offset));
    const { rows } = await pool.query(
      `SELECT ${CAMPOS_PUBLICOS.join(', ')},
              false AS desbloqueada
       FROM cargas c
       ${where}
       ${orderBy}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // Se chofer autenticado, marcar quais já desbloqueou
    if (req.user?.tipo === 'chofer' && rows.length > 0) {
      const ids = rows.map(r => r.id);
      const debRes = await pool.query(
        `SELECT carga_id FROM desbloqueios WHERE chofer_id=$1 AND carga_id = ANY($2)`,
        [req.user.id, ids]
      );
      const desbloqueadas = new Set(debRes.rows.map(r => r.carga_id));
      rows.forEach(r => { r.desbloqueada = desbloqueadas.has(r.id); });
    }

    res.json(rows);
  } catch (err) {
    console.error('[GET /public/cargas]', err);
    res.status(500).json({ error: 'Error al buscar cargas' });
  }
});

// GET /public/cargas/desbloqueadas — cargas já desbloqueadas pelo Chofer (com dados completos)
router.get('/cargas/desbloqueadas', auth, requireChofer, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${CAMPOS_DESBLOQUEADOS.join(', ')},
              true AS desbloqueada,
              d.desbloqueado_at
       FROM cargas c
       JOIN desbloqueios d ON d.carga_id = c.id AND d.chofer_id = $1
       ORDER BY d.desbloqueado_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET /public/cargas/desbloqueadas]', err);
    res.status(500).json({ error: 'Error al buscar cargas desbloqueadas' });
  }
});

// GET /public/cargas/:id — detalhe de carga (com ou sem desbloqueio)
router.get('/cargas/:id', authOptional, async (req, res) => {
  try {
    const cargaRes = await pool.query(
      `SELECT ${CAMPOS_PUBLICOS.join(', ')} FROM cargas c WHERE c.id=$1`,
      [req.params.id]
    );
    if (!cargaRes.rows[0]) return res.status(404).json({ error: 'Carga no encontrada' });

    const carga = { ...cargaRes.rows[0], desbloqueada: false };

    // Verificar se Chofer já desbloqueou
    if (req.user?.tipo === 'chofer') {
      const debRes = await pool.query(
        'SELECT id FROM desbloqueios WHERE carga_id=$1 AND chofer_id=$2',
        [req.params.id, req.user.id]
      );
      if (debRes.rows[0]) {
        // Retornar dados completos
        const fullRes = await pool.query(
          `SELECT ${CAMPOS_DESBLOQUEADOS.join(', ')} FROM cargas c WHERE c.id=$1`,
          [req.params.id]
        );
        return res.json({ ...fullRes.rows[0], desbloqueada: true });
      }
    }

    res.json(carga);
  } catch (err) {
    console.error('[GET /public/cargas/:id]', err);
    res.status(500).json({ error: 'Error al buscar carga' });
  }
});

// POST /public/cargas/:id/desbloquear — desbloquear carga (débita crédito)
router.post('/cargas/:id/desbloquear', auth, requireChofer, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar saldo de créditos
    const choferRes = await client.query(
      'SELECT creditos FROM choferes WHERE id=$1 FOR UPDATE',
      [req.user.id]
    );
    if (!choferRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Chofer no encontrado' });
    }
    if (choferRes.rows[0].creditos < CREDITOS_POR_DESBLOQUEO) {
      await client.query('ROLLBACK');
      return res.status(402).json({
        error: 'Créditos insuficientes',
        creditos_disponibles: choferRes.rows[0].creditos,
        creditos_necesarios: CREDITOS_POR_DESBLOQUEO,
      });
    }

    // Verificar se carga existe e está disponível
    const cargaRes = await client.query(
      `SELECT id FROM cargas WHERE id=$1 AND status IN ('disponible', 'publicado')`,
      [req.params.id]
    );
    if (!cargaRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Carga no disponible' });
    }

    // Verificar se já desbloqueou
    const existeRes = await client.query(
      'SELECT id FROM desbloqueios WHERE carga_id=$1 AND chofer_id=$2',
      [req.params.id, req.user.id]
    );
    if (existeRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ya desbloqueaste esta carga' });
    }

    // Debitar crédito
    await client.query(
      'UPDATE choferes SET creditos = creditos - $1 WHERE id=$2',
      [CREDITOS_POR_DESBLOQUEO, req.user.id]
    );

    // Registrar desbloqueio
    await client.query(
      `INSERT INTO desbloqueios (carga_id, chofer_id, creditos_usados)
       VALUES ($1, $2, $3)`,
      [req.params.id, req.user.id, CREDITOS_POR_DESBLOQUEO]
    );

    // Registrar transação de crédito
    await client.query(
      `INSERT INTO credito_transacciones (chofer_id, tipo, cantidad, descripcion)
       VALUES ($1, 'uso', $2, $3)`,
      [req.user.id, -CREDITOS_POR_DESBLOQUEO, `Desbloqueo de carga ${req.params.id}`]
    );

    // Retornar dados completos da carga
    const fullRes = await client.query(
      `SELECT ${CAMPOS_DESBLOQUEADOS.join(', ')} FROM cargas c WHERE c.id=$1`,
      [req.params.id]
    );

    const saldoRes = await client.query(
      'SELECT creditos FROM choferes WHERE id=$1',
      [req.user.id]
    );

    await client.query('COMMIT');

    res.json({
      carga: { ...fullRes.rows[0], desbloqueada: true },
      creditos_restantes: saldoRes.rows[0].creditos,
      mensaje: '¡Carga desbloqueada! Ya puedes ver los datos completos.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /public/cargas/:id/desbloquear]', err);
    res.status(500).json({ error: 'Error al desbloquear carga' });
  } finally {
    client.release();
  }
});

// POST /public/cargas/:id/solicitar — solicitar carga (requer desbloqueio prévio)
router.post('/cargas/:id/solicitar', auth, requireChofer, async (req, res) => {
  const { notas = '' } = req.body;
  try {
    // Verificar desbloqueio
    const debRes = await pool.query(
      'SELECT id FROM desbloqueios WHERE carga_id=$1 AND chofer_id=$2',
      [req.params.id, req.user.id]
    );
    if (!debRes.rows[0]) {
      return res.status(403).json({ error: 'Debes desbloquear la carga antes de solicitar' });
    }

    // Verificar carga disponível
    const cargaRes = await pool.query(
      `SELECT id, status FROM cargas WHERE id=$1`,
      [req.params.id]
    );
    if (!cargaRes.rows[0]) {
      return res.status(404).json({ error: 'Carga no encontrada' });
    }
    if (!['disponible', 'publicado', 'desbloqueado'].includes(cargaRes.rows[0].status)) {
      return res.status(409).json({ error: 'Esta carga ya no está disponible' });
    }

    // Criar solicitud (ON CONFLICT: já solicitou)
    const { rows } = await pool.query(
      `INSERT INTO solicitudes (carga_id, chofer_id, notas)
       VALUES ($1, $2, $3)
       ON CONFLICT (carga_id, chofer_id) DO UPDATE SET notas=$3, created_at=NOW()
       RETURNING *`,
      [req.params.id, req.user.id, notas]
    );

    // Atualizar status da carga
    await pool.query(
      `UPDATE cargas SET status='pendiente_aprobacion' WHERE id=$1 AND status IN ('disponible', 'publicado', 'desbloqueado')`,
      [req.params.id]
    );

    res.status(201).json({
      solicitud: rows[0],
      mensaje: 'Solicitud enviada. El transportista revisará tu perfil.',
    });
  } catch (err) {
    console.error('[POST /public/cargas/:id/solicitar]', err);
    res.status(500).json({ error: 'Error al solicitar carga' });
  }
});

module.exports = router;
