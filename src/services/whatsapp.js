// Abstração WhatsApp — pronto para Twilio / 360Dialog / Meta
// Trocar a implementação de sendMessage quando tiver chave de API

const PROVIDER = process.env.WHATSAPP_PROVIDER || 'log';

const templates = {
  NUEVA_CARGA: (vars) =>
    `🚛 *Nueva carga disponible*\n📍 ${vars.origen} → ${vars.destino}\n💰 ${vars.valor}\n📦 ${vars.tipo_camion}\n\n¿Te interesa?\nDesbloquear: ${vars.link}`,

  CARGA_APROBADA: (vars) =>
    `✅ *¡Carga aprobada!*\nHola ${vars.chofer_nombre}, fuiste aprobado para la carga ${vars.carga_id}.\n\n📍 Retiro: ${vars.fecha_retiro}\n📞 Contacto: ${vars.contacto}\n\nBuen viaje! 🚚`,

  SOLICITUD_RECIBIDA: (vars) =>
    `📋 *Nueva solicitud de chofer*\nCarga: ${vars.carga_id}\nChofer: ${vars.chofer_nombre}\nPlaca: ${vars.placa}\nCI: ${vars.ci}\n\nRevisa en MOVRA para aprobar o rechazar.`,

  CARGA_RECHAZADA: (vars) =>
    `❌ *Solicitud rechazada*\nHola ${vars.chofer_nombre}, tu solicitud para la carga ${vars.carga_id} fue rechazada.\n\nSigue buscando otras cargas en MOVRA.`,
};

const sendMessage = async ({ to, template, vars }) => {
  const text = templates[template]?.(vars) ?? JSON.stringify(vars);

  if (PROVIDER === 'log' || !process.env.WHATSAPP_TOKEN) {
    console.log(`[WhatsApp → ${to}]\n${text}\n`);
    return { ok: true, provider: 'log' };
  }

  // TODO: implementar com Twilio ou 360Dialog quando tiver credenciais
  // Exemplo Twilio:
  // const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  // await client.messages.create({ from: 'whatsapp:+1...', to: `whatsapp:${to}`, body: text });

  console.warn('[WhatsApp] Provider configurado mas não implementado:', PROVIDER);
  return { ok: false, provider: PROVIDER };
};

module.exports = { sendMessage, templates };
