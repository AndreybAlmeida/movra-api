const formatCurrency = (value, moneda) => {
  const num = Number(value) || 0;
  if (moneda === 'PYG') return `G$ ${num.toLocaleString('es-PY')}`;
  if (moneda === 'BRL') return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  if (moneda === 'USD') return `U$ ${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  return String(num);
};

module.exports = { formatCurrency };
