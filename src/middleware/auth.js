const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'movra_dev_secret_change_in_prod';

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token ausente' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

const authOptional = (req, res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
    } catch {
      // silently ignore invalid token on optional routes
    }
  }
  next();
};

module.exports = { auth, authOptional, JWT_SECRET };
