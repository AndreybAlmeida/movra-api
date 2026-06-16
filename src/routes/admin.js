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

// PATCH /admin/choferes/:id/status — aprovar ou bloquear chofer
router.patch('/choferes/:id/status', auth, requireAdmin, async (req, res) => {
  const { status } = req.body;
  const VALID = ['disponible', 'pendiente', 'bloqueado', 'inactivo'];
  if (!VALID.includes(status)) {
    return res.status(400).json({ error: `status deve ser: ${VALID.join(' | ')}` });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE choferes SET status=$1 WHERE id=$2 RETURNING id, nombre, email, status`,
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Chofer no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH /admin/choferes/:id/status]', err);
    res.status(500).json({ error: 'Error al actualizar status' });
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

// [REMOVIDO] endpoint temporário reset-and-seed
router.post('/reset-and-seed-disabled', async (req, res) => {
  if (req.body.secret !== 'movra_seed_2026') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const bcrypt = require('bcryptjs');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Limpar todas as tabelas em cascata ──
    await client.query('DELETE FROM desbloqueios');
    await client.query('DELETE FROM credito_transacciones');
    await client.query('DELETE FROM solicitudes');
    await client.query('DELETE FROM cargas');
    await client.query('DELETE FROM choferes');
    await client.query('DELETE FROM empresas');

    // ── 2. Criar empresa seed ──
    const senhaHash = await bcrypt.hash('movra2026', 10);
    const empRes = await client.query(
      `INSERT INTO empresas (nombre, ruc, contacto, email, senha_hash, tipo_cuenta, telefono, direccion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      ['MOVRA Demo Transportes', '80000001-1', 'Operaciones MOVRA', 'demo@movra.py',
       senhaHash, 'transportista', '+595 21 000-0001', 'Av. Mcal. López 1234, Asunción']
    );
    const empresaId = empRes.rows[0].id;

    // ── 3. Inserir 10 cargas realistas ──
    const cargas = [
      { origen:'Asunción', destino:'Ciudad del Este', tipo_produto:'Electrodomésticos', tipo_camion:'Camión Baú', tipo_carroceria:'Baú', peso:'12t', valor_carga:2800000, moneda:'PYG', modalidade:'Completa', fecha_retiro:'2026-06-03T08:00', fecha_entrega:'2026-06-04T18:00', observaciones:'Carga frágil, manejo cuidadoso.', distancia_km:327 },
      { origen:'Ciudad del Este', destino:'Asunción', tipo_produto:'Mercaderías generales', tipo_camion:'Semi-tráiler', tipo_carroceria:'Baú', peso:'25t', valor_carga:3500000, moneda:'PYG', modalidade:'Completa', fecha_retiro:'2026-06-03T07:00', fecha_entrega:'2026-06-03T20:00', observaciones:'Retiro en Depósito Zona Franca.', distancia_km:327 },
      { origen:'Encarnación', destino:'Asunción', tipo_produto:'Productos agrícolas', tipo_camion:'Camión Granelero', tipo_carroceria:'Granelera', peso:'20t', valor_carga:2200000, moneda:'PYG', modalidade:'Completa', fecha_retiro:'2026-06-04T06:00', fecha_entrega:'2026-06-04T16:00', observaciones:'Soja a granel, requiere lona.', distancia_km:371 },
      { origen:'Asunción', destino:'Encarnación', tipo_produto:'Materiales de construcción', tipo_camion:'Camión Volcador', tipo_carroceria:'Volcador', peso:'18t', valor_carga:2400000, moneda:'PYG', modalidade:'Completa', fecha_retiro:'2026-06-05T07:00', fecha_entrega:'2026-06-05T18:00', observaciones:'Arena y gravilla. Requiere volcador.', distancia_km:371 },
      { origen:'Coronel Oviedo', destino:'Ciudad del Este', tipo_produto:'Alimentos secos', tipo_camion:'Furgón', tipo_carroceria:'Baú', peso:'4t', valor_carga:980000, moneda:'PYG', modalidade:'Fracionada', fecha_retiro:'2026-06-03T09:00', fecha_entrega:'2026-06-03T15:00', observaciones:'Entrega en supermercado. Acceso restringido.', distancia_km:128 },
      { origen:'Concepción', destino:'Asunción', tipo_produto:'Ganado bovino', tipo_camion:'Camión Jaula', tipo_carroceria:'Jaula', peso:'15t', valor_carga:3100000, moneda:'PYG', modalidade:'Completa', fecha_retiro:'2026-06-04T04:00', fecha_entrega:'2026-06-04T14:00', observaciones:'Transporte de hacienda. Madrugada.', distancia_km:294 },
      { origen:'Asunción', destino:'Pedro Juan Caballero', tipo_produto:'Insumos médicos', tipo_camion:'Furgón Refrigerado', tipo_carroceria:'Frigorífica', peso:'2t', valor_carga:4500000, moneda:'PYG', modalidade:'Completa', fecha_retiro:'2026-06-05T06:00', fecha_entrega:'2026-06-06T12:00', observaciones:'Temperatura +2°C a +8°C. Cadena de frío obligatoria.', distancia_km:459 },
      { origen:'Ciudad del Este', destino:'Encarnación', tipo_produto:'Electrónica', tipo_camion:'Camión Baú', tipo_carroceria:'Baú', peso:'8t', valor_carga:1800000, moneda:'PYG', modalidade:'Completa', fecha_retiro:'2026-06-04T10:00', fecha_entrega:'2026-06-04T18:00', observaciones:'Mercadería importada. Acompañar con DUA.', distancia_km:192 },
      { origen:'Villarrica', destino:'Asunción', tipo_produto:'Maderas y tablones', tipo_camion:'Camión Plataforma', tipo_carroceria:'Plataforma', peso:'22t', valor_carga:1950000, moneda:'PYG', modalidade:'Completa', fecha_retiro:'2026-06-06T07:00', fecha_entrega:'2026-06-06T14:00', observaciones:'Madera aserrada. Carga sobredimensionada posible.', distancia_km:157 },
      { origen:'Asunción', destino:'Salto del Guairá', tipo_produto:'Combustible', tipo_camion:'Camión Cisterna', tipo_carroceria:'Cisterna', peso:'20t', valor_carga:5200000, moneda:'PYG', modalidade:'Completa', fecha_retiro:'2026-06-07T05:00', fecha_entrega:'2026-06-08T10:00', observaciones:'ADR requerido. Habilitación transporte de combustible.', distancia_km:410, carga_peligrosa:true },
    ];

    for (const c of cargas) {
      await client.query(
        `INSERT INTO cargas
           (empresa_id, empresa_nombre, origen, destino, tipo, tipo_produto, tipo_camion, tipo_carroceria,
            peso, valor_gs, valor_carga, moneda, modalidade,
            fecha_retiro, fecha_entrega, observaciones, distancia_km,
            carga_peligrosa, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'publicado')`,
        [
          empresaId, 'MOVRA Demo Transportes',
          c.origen, c.destino, c.tipo_produto, c.tipo_produto, c.tipo_camion, c.tipo_carroceria,
          c.peso, c.valor_carga, c.valor_carga, c.moneda, c.modalidade,
          c.fecha_retiro, c.fecha_entrega, c.observaciones, c.distancia_km || 0,
          c.carga_peligrosa || false,
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true, empresa_seed: 'demo@movra.py', senha: 'movra2026', cargas_criadas: cargas.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /admin/reset-and-seed]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
