const express = require('express');
const { getRates } = require('../services/exchangeRate');

const router = express.Router();

// GET /cambio — câmbio do dia (BRL→PYG, USD→PYG, USD→BRL)
router.get('/', async (_req, res) => {
  try {
    const rates = await getRates();
    res.json(rates);
  } catch (err) {
    console.error('[GET /cambio]', err);
    res.status(500).json({ error: 'Error al obtener cambio del día' });
  }
});

module.exports = router;
