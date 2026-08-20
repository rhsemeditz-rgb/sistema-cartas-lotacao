const jwt = require('jsonwebtoken');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-CHANGE-IN-PRODUCTION';

function autenticar(req, res, next) {
  const token = req.cookies?.token || (req.headers.authorization || '').replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const usuario = db.prepare('SELECT id, nome, usuario, tipo, ativo, trocar_senha FROM usuarios WHERE id = ?').get(payload.id);

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: 'Usuário inválido ou inativo' });
    }

    req.usuario = usuario;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

function apenasAdmin(req, res, next) {
  if (!req.usuario || req.usuario.tipo !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores' });
  }
  next();
}

module.exports = { autenticar, apenasAdmin, JWT_SECRET };
