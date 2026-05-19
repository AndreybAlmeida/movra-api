const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!roles.includes(req.user.tipo)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
};

const requireEmpresa = requireRole('empresa');
const requireChofer  = requireRole('chofer');
const requireAdmin   = requireRole('admin');

const requireAgenciador = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.tipo !== 'empresa') return res.status(403).json({ error: 'Acceso denegado' });
  if (req.user.tipo_cuenta !== 'agenciador') {
    return res.status(403).json({ error: 'Solo disponible para Agenciadores' });
  }
  next();
};

module.exports = { requireRole, requireEmpresa, requireChofer, requireAdmin, requireAgenciador };
