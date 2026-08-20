require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const { limitGeral } = require('./middleware/rateLimit');

// Rotas
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const escolasRoutes = require('./routes/escolas');
const cartasRoutes = require('./routes/cartas');
const auditoriaRoutes = require('./routes/auditoria');

const app = express();
const PORT = process.env.PORT || 3000;

// Confia no proxy do Render (para pegar IP real)
app.set('trust proxy', 1);

// ============ SEGURANÇA ============

// Helmet - headers de segurança HTTP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false
}));

// CORS - restringe origem em produção
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? true : true,
  credentials: true
}));

// Body parsers com limites baixos (proteção contra payload gigante)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Cookie parser
app.use(cookieParser(process.env.COOKIE_SECRET));

// Rate limit geral em todas as rotas /api
app.use('/api', limitGeral);

// ============ ROTAS API ============

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/escolas', escolasRoutes);
app.use('/api/cartas', cartasRoutes);
app.use('/api/auditoria', auditoriaRoutes);

// Healthcheck
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ============ FRONTEND ESTÁTICO ============

const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir, {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  index: 'index.html'
}));

// Fallback para SPA-like navigation em rotas do frontend
app.get(['/dashboard', '/nova-carta', '/usuarios', '/escolas', '/auditoria', '/trocar-senha'], (req, res) => {
  const page = req.path.replace('/', '') + '.html';
  const filePath = path.join(frontendDir, 'pages', page);
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  res.redirect('/');
});

// 404 API
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

// Handler global de erros
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`   Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Acesse: http://localhost:${PORT}`);
});
