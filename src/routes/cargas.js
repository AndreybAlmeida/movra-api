const express = require('express');
const pool    = require('../config/database');
const { auth } = require('../middleware/auth');
const { requireEmpresa } = require('../middleware/roles');
const { VALID_STATUS, MONEDAS } = require('../config/constants');

const router = express.Router();

// GET /cargas — cargas da empresa autenticada
router.get('/', auth, requireEmpresa, async (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  try {
    let query = `
      SELECT c.*,
             er.nombre  AS empresa_rep_nombre,
             ch.nombre  AS chofer_nombre,
             ch.telefono AS chofer_telefono,
             ch.ci      AS chofer_ci,
             ch.placa   AS chofer_placa,
             ch.tipo_camion     AS chofer_tipo_camion,
             ch.tipo_carroceria AS chofer_tipo_carroceria
      FROM cargas c
      LEFT JOIN empresas_representadas er ON er.id = c.empresa_representada_id
      LEFT JOIN choferes ch ON ch.id = c.chofer_solicitante_id
      WHERE c.empresa_id = $1
    `;
    const params = [req.user.id];

    if (status && VALID_STATUS.includes(status)) {
      query += ` AND c.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), Number(offset));

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[GET /cargas]', err);
    res.status(500).json({ error: 'Error al buscar cargas' });
  }
});

// POST /cargas — publicar nueva carga
router.post('/', auth, requireEmpresa, async (req, res) => {
  const {
    origen, destino,
    tipo = '', tipo_produto = '', modalidade = '', peso = '',
    valor_gs = 0, valor_carga = 0, moneda = 'PYG',
    fecha_salida, fecha_retiro, fecha_entrega,
    tipo_camion = '', tipo_carroceria = '', especializacion = '',
    carga_peligrosa = false, observaciones = '',
    distancia_km = 0, tiempo_min = 0, pedagios = 0, costo_pedagio_pyg = 0,
    empresa_representada_id = null,
    lat_origen = null, lng_origen = null,
    lat_destino = null, lng_destino = null,
  } = req.body;

  if (!origen || !destino) {
    return res.status(400).json({ error: 'origen y destino son obligatorios' });
  }
  if (origen === destino) {
    return res.status(400).json({ error: 'origen y destino deben ser diferentes' });
  }
  if (!fecha_retiro) {
    return res.status(400).json({ error: 'fecha_retiro es obligatoria' });
  }
  if (!fecha_entrega) {
    return res.status(400).json({ error: 'fecha_entrega es obligatoria' });
  }
  if (moneda && !MONEDAS.includes(moneda)) {
    return res.status(400).json({ error: `moneda debe ser: ${MONEDAS.join(' | ')}` });
  }

  // Agenciador debe informar empresa representada
  if (req.user.tipo_cuenta === 'agenciador' && !empresa_representada_id) {
    return res.status(400).json({ error: 'Agenciadores deben seleccionar una empresa representada' });
  }

  // Verificar que empresa_representada_id pertenece al agenciador
  if (empresa_representada_id) {
    const { rows: erRows } = await pool.query(
      'SELECT id FROM empresas_representadas WHERE id=$1 AND agenciador_id=$2',
      [empresa_representada_id, req.user.id]
    );
    if (!erRows[0]) {
      return res.status(403).json({ error: 'Empresa representada no encontrada' });
    }
  }

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
        distancia_km, tiempo_min, pedagios, costo_pedagio_pyg,
        empresa_representada_id,
        lat_origen, lng_origen, lat_destino, lng_destino,
        status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
      RETURNING *`,
      [
        req.user.id, req.user.nombre, origen, destino,
        tipo, tipo_produto, modalidade, peso,
        valorFinal, valorFinal, moneda,
        fecha_salida || null, fecha_retiro || null, fecha_entrega || null,
        tipo_camion, tipo_carroceria, especializacion,
        !!carga_peligrosa, observaciones,
        Number(distancia_km), Number(tiempo_min), Number(pedagios), Number(costo_pedagio_pyg),
        empresa_representada_id || null,
        lat_origen, lng_origen, lat_destino, lng_destino,
        'disponible',
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /cargas]', err);
    res.status(500).json({ error: err.message || 'Error al crear carga' });
  }
});

// PATCH /cargas/:id — editar carga completa
router.patch('/:id', auth, requireEmpresa, async (req, res) => {
  const {
    origen, destino,
    tipo = '', tipo_produto = '', modalidade = '', peso = '',
    valor_gs, valor_carga, moneda = 'PYG',
    fecha_salida, fecha_retiro, fecha_entrega,
    tipo_camion = '', tipo_carroceria = '', especializacion = '',
    carga_peligrosa = false, observaciones = '',
    distancia_km = 0, tiempo_min = 0, pedagios = 0, costo_pedagio_pyg = 0,
    status,
    lat_origen = null, lng_origen = null,
    lat_destino = null, lng_destino = null,
  } = req.body;

  if (status && !VALID_STATUS.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }
  const valorFinal = Number(valor_carga) || Number(valor_gs) || 0;

  try {
    const { rows } = await pool.query(
      `UPDATE cargas SET
        origen=$1, destino=$2, tipo=$3, tipo_produto=$4, modalidade=$5, peso=$6,
        valor_gs=$7, valor_carga=$8, moneda=$9,
        fecha_salida=$10, fecha_retiro=$11, fecha_entrega=$12,
        tipo_camion=$13, tipo_carroceria=$14, especializacion=$15,
        carga_peligrosa=$16, observaciones=$17,
        distancia_km=$18, tiempo_min=$19, pedagios=$20, costo_pedagio_pyg=$21,
        lat_origen=$22, lng_origen=$23, lat_destino=$24, lng_destino=$25,
        status=COALESCE($26, status)
       WHERE id=$27 AND empresa_id=$28 RETURNING *`,
      [
        origen, destino, tipo, tipo_produto, modalidade, peso,
        valorFinal, valorFinal, moneda,
        fecha_salida || null, fecha_retiro || null, fecha_entrega || null,
        tipo_camion, tipo_carroceria, especializacion,
        !!carga_peligrosa, observaciones,
        Number(distancia_km), Number(tiempo_min), Number(pedagios), Number(costo_pedagio_pyg),
        lat_origen, lng_origen, lat_destino, lng_destino,
        status || null, req.params.id, req.user.id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Carga no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH /cargas/:id]', err);
    res.status(500).json({ error: err.message || 'Error al actualizar carga' });
  }
});

// PATCH /cargas/:id/status — atualizar status
router.patch('/:id/status', auth, requireEmpresa, async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUS.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE cargas SET status=$1 WHERE id=$2 AND empresa_id=$3 RETURNING *`,
      [status, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Carga no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH /cargas/:id/status]', err);
    res.status(500).json({ error: 'Error al actualizar status' });
  }
});

// GET /cargas/:id/solicitudes — ver solicitações de Choferes
router.get('/:id/solicitudes', auth, requireEmpresa, async (req, res) => {
  try {
    const cargaRes = await pool.query(
      'SELECT id FROM cargas WHERE id=$1 AND empresa_id=$2',
      [req.params.id, req.user.id]
    );
    if (!cargaRes.rows[0]) return res.status(404).json({ error: 'Carga no encontrada' });

    const { rows } = await pool.query(
      `SELECT s.*,
              ch.nombre AS chofer_nombre,
              ch.telefono AS chofer_telefono,
              ch.ci AS chofer_ci,
              ch.placa AS chofer_placa,
              ch.tipo_camion AS chofer_tipo_camion,
              ch.score AS chofer_score,
              ch.viajes AS chofer_viajes
       FROM solicitudes s
       JOIN choferes ch ON ch.id = s.chofer_id
       WHERE s.carga_id = $1
       ORDER BY s.created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET /cargas/:id/solicitudes]', err);
    res.status(500).json({ error: 'Error al buscar solicitudes' });
  }
});

// POST /cargas/:id/solicitudes/:sol_id/aprobar — aprovar Chofer
router.post('/:id/solicitudes/:sol_id/aprobar', auth, requireEmpresa, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar carga pertence à empresa
    const cargaRes = await client.query(
      'SELECT * FROM cargas WHERE id=$1 AND empresa_id=$2',
      [req.params.id, req.user.id]
    );
    if (!cargaRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Carga no encontrada' });
    }

    // Verificar solicitud existe e está pendente
    const solRes = await client.query(
      'SELECT * FROM solicitudes WHERE id=$1 AND carga_id=$2 AND status=$3',
      [req.params.sol_id, req.params.id, 'pendiente']
    );
    if (!solRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' });
    }

    const chofer_id = solRes.rows[0].chofer_id;

    // Aprovar esta solicitud
    await client.query(
      `UPDATE solicitudes SET status='aprobado', respondido_at=NOW() WHERE id=$1`,
      [req.params.sol_id]
    );

    // Rejeitar outras solicitudes pendentes da mesma carga
    await client.query(
      `UPDATE solicitudes SET status='rechazado', respondido_at=NOW()
       WHERE carga_id=$1 AND id != $2 AND status='pendiente'`,
      [req.params.id, req.params.sol_id]
    );

    // Atualizar carga
    const { rows } = await client.query(
      `UPDATE cargas SET status='aceptado', chofer_solicitante_id=$1, chofer_aceptado_at=NOW()
       WHERE id=$2 RETURNING *`,
      [chofer_id, req.params.id]
    );

    await client.query('COMMIT');
    res.json({ carga: rows[0], mensaje: 'Chofer aprobado con éxito' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /cargas/:id/solicitudes/:sol_id/aprobar]', err);
    res.status(500).json({ error: 'Error al aprobar chofer' });
  } finally {
    client.release();
  }
});

// POST /cargas/:id/solicitudes/:sol_id/rechazar — rejeitar Chofer
router.post('/:id/solicitudes/:sol_id/rechazar', auth, requireEmpresa, async (req, res) => {
  const { motivo = '' } = req.body;
  try {
    const cargaRes = await pool.query(
      'SELECT id FROM cargas WHERE id=$1 AND empresa_id=$2',
      [req.params.id, req.user.id]
    );
    if (!cargaRes.rows[0]) return res.status(404).json({ error: 'Carga no encontrada' });

    const { rows } = await pool.query(
      `UPDATE solicitudes SET status='rechazado', notas=$1, respondido_at=NOW()
       WHERE id=$2 AND carga_id=$3 AND status='pendiente' RETURNING *`,
      [motivo, req.params.sol_id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' });

    res.json({ solicitud: rows[0], mensaje: 'Solicitud rechazada' });
  } catch (err) {
    console.error('[POST /cargas/:id/solicitudes/:sol_id/rechazar]', err);
    res.status(500).json({ error: 'Error al rechazar solicitud' });
  }
});

module.exports = router;
