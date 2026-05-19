const express = require('express');
const pool    = require('../config/database');
const { auth } = require('../middleware/auth');
const { requireChofer } = require('../middleware/roles');
const { createOrder, verifyWebhook } = require('../services/payment');
const { PACOTES_CREDITOS } = require('../config/constants');

const router = express.Router();

// GET /pagos/pacotes — listar pacotes de créditos
router.get('/pacotes', (_req, res) => {
  res.json(PACOTES_CREDITOS);
});

// POST /pagos/creditos/iniciar — iniciar compra de créditos
router.post('/creditos/iniciar', auth, requireChofer, async (req, res) => {
  const { pacote_id } = req.body;
  const pacote = PACOTES_CREDITOS.find(p => p.id === pacote_id);
  if (!pacote) {
    return res.status(400).json({ error: `pacote_id inválido. Opciones: ${PACOTES_CREDITOS.map(p => p.id).join(', ')}` });
  }

  try {
    const order = await createOrder({
      amount_pyg: pacote.precio_pyg,
      chofer_id: req.user.id,
      pacote_id: pacote.id,
      descripcion: `${pacote.nombre} - MOVRA`,
    });

    // Se mock/aprovação imediata: creditar direto
    if (order.status === 'approved') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          'UPDATE choferes SET creditos = creditos + $1 WHERE id=$2',
          [pacote.creditos, req.user.id]
        );
        await client.query(
          `INSERT INTO credito_transacciones (chofer_id, tipo, cantidad, descripcion, referencia_pago)
           VALUES ($1, 'compra', $2, $3, $4)`,
          [req.user.id, pacote.creditos, pacote.nombre, order.order_id]
        );

        const saldoRes = await client.query(
          'SELECT creditos FROM choferes WHERE id=$1',
          [req.user.id]
        );

        await client.query('COMMIT');
        return res.json({
          order,
          creditos_acreditados: pacote.creditos,
          creditos_total: saldoRes.rows[0].creditos,
          mensaje: `¡${pacote.nombre} acreditados exitosamente!`,
        });
      } catch (dbErr) {
        await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        client.release();
      }
    }

    // Pagamento pendente: retornar dados para o frontend mostrar QR/Pix
    res.json({
      order,
      mensaje: 'Escanea el QR o usa el Pix para completar el pago',
    });
  } catch (err) {
    console.error('[POST /pagos/creditos/iniciar]', err);
    res.status(500).json({ error: err.message || 'Error al iniciar pago' });
  }
});

// POST /pagos/webhook — callback do provedor (uso futuro)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-movra-signature'] || req.headers['x-webhook-signature'];
    const payload   = JSON.parse(req.body.toString());
    const result    = verifyWebhook(payload, signature);

    if (!result.valid) {
      return res.status(400).json({ error: 'Assinatura inválida' });
    }

    // TODO: processar aprovação e creditar chofer
    console.log('[Webhook pagos]', payload);
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /pagos/webhook]', err);
    res.status(500).json({ error: 'Error no webhook' });
  }
});

module.exports = router;
