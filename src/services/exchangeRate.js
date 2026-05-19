const https = require('https');

const FALLBACK = { BRL_PYG: 1050, USD_PYG: 7500, USD_BRL: 5.80 };
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

let cache = { rates: null, updatedAt: null };

const fetchJson = (url) => new Promise((resolve, reject) => {
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { reject(new Error('JSON inválido')); }
    });
  }).on('error', reject);
});

const getRates = async () => {
  if (cache.rates && cache.updatedAt && (Date.now() - cache.updatedAt) < CACHE_TTL) {
    return cache.rates;
  }

  try {
    const data = await fetchJson('https://api.exchangerate-api.com/v4/latest/USD');
    const rates = data.rates;
    if (!rates?.PYG || !rates?.BRL) throw new Error('Rates incompletos');

    const result = {
      BRL_PYG: parseFloat((rates.PYG / rates.BRL).toFixed(2)),
      USD_PYG: parseFloat(rates.PYG.toFixed(2)),
      USD_BRL: parseFloat(rates.BRL.toFixed(2)),
      source: 'api',
      updatedAt: new Date().toISOString(),
    };

    cache = { rates: result, updatedAt: Date.now() };
    return result;
  } catch (err) {
    console.warn('[exchangeRate] Usando fallback:', err.message);
    return { ...FALLBACK, source: 'fallback', updatedAt: new Date().toISOString() };
  }
};

module.exports = { getRates };
