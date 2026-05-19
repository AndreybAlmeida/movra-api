// Abstração PaymentProvider — pronto para Pix / QR Code / Bancard (Paraguai)
// Trocar a implementação de createOrder quando tiver chave de API

const PROVIDER = process.env.PAYMENT_PROVIDER || 'mock';

const createOrder = async ({ amount_pyg, chofer_id, pacote_id, descripcion }) => {
  if (PROVIDER === 'mock') {
    // Mock: aprovação imediata para desenvolvimento
    return {
      provider: 'mock',
      order_id: `MOCK-${Date.now()}`,
      status: 'approved',
      amount_pyg,
      chofer_id,
      pacote_id,
      qr_code: null,
      pix_key: null,
      expires_at: null,
    };
  }

  // TODO: implementar com Bancard (Paraguai) ou Pix quando tiver credenciais
  // Exemplo Bancard:
  // const response = await fetch('https://vpos.infonet.com.py/api/...', {
  //   method: 'POST',
  //   headers: { Authorization: `Bearer ${process.env.BANCARD_TOKEN}` },
  //   body: JSON.stringify({ amount: amount_pyg, ... }),
  // });

  throw new Error(`Payment provider '${PROVIDER}' não implementado`);
};

const verifyWebhook = (payload, signature) => {
  if (PROVIDER === 'mock') return { valid: true, order_id: payload.order_id };
  throw new Error(`Webhook verification não implementada para '${PROVIDER}'`);
};

module.exports = { createOrder, verifyWebhook };
