const https = require('https');

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

// Custo estimado de pedágio por km no Paraguai (PYG)
const PEDAGIO_POR_KM_PYG = 250;

const calcularRota = async ({ lat_origen, lng_origen, lat_destino, lng_destino }) => {
  if (!lat_origen || !lng_origen || !lat_destino || !lng_destino) {
    return null;
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lng_origen},${lat_origen};${lng_destino},${lat_destino}?overview=false`;
    const data = await fetchJson(url);

    if (data.code !== 'Ok' || !data.routes?.[0]) return null;

    const route = data.routes[0];
    const distancia_km  = parseFloat((route.distance / 1000).toFixed(1));
    const tiempo_min    = Math.round(route.duration / 60);
    const pedagios      = Math.max(1, Math.round(distancia_km / 150));
    const costo_pedagio_pyg = Math.round(distancia_km * PEDAGIO_POR_KM_PYG);

    return { distancia_km, tiempo_min, pedagios, costo_pedagio_pyg };
  } catch (err) {
    console.warn('[routeCalculator] OSRM indisponível:', err.message);
    return null;
  }
};

module.exports = { calcularRota };
