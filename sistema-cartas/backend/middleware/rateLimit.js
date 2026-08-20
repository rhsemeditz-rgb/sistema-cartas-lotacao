const rateLimit = require('express-rate-limit');

// Limite geral: 300 requisições por 15 min por IP
const limitGeral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições. Tente novamente em alguns minutos.' }
});

// Limite de login: 5 tentativas por 15 min por IP (proteção contra brute force)
const limitLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.' }
});

// Limite de geração de cartas: 30 por hora por usuário
const limitCartas = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.usuario?.id?.toString() || req.ip,
  message: { erro: 'Limite de cartas por hora atingido. Aguarde um pouco.' }
});

module.exports = { limitGeral, limitLogin, limitCartas };
