const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { autenticar, JWT_SECRET } = require('../middleware/auth');
const { limitLogin } = require('../middleware/rateLimit');

const router = express.Router();
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

// POST /api/auth/login
router.post('/login', limitLogin, async (req, res) => {
  try {
    const { usuario, senha } = req.body || {};

    if (!usuario || !senha || typeof usuario !== 'string' || typeof senha !== 'string') {
      return res.status(400).json({ erro: 'Usuário e senha são obrigatórios' });
    }

    if (usuario.length > 100 || senha.length > 200) {
      return res.status(400).json({ erro: 'Dados inválidos' });
    }

    const user = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(usuario.trim().toLowerCase());

    // Delay constante para dificultar enumeração
    await new Promise(r => setTimeout(r, 200));

    if (!user) {
      return res.status(401).json({ erro: 'Usuário ou senha incorretos' });
    }

    if (!user.ativo) {
      return res.status(403).json({ erro: 'Usuário desativado. Contate o administrador.' });
    }

    // Verifica bloqueio
    if (user.bloqueado_ate) {
      const agora = new Date();
      const bloqueio = new Date(user.bloqueado_ate);
      if (agora < bloqueio) {
        const minutos = Math.ceil((bloqueio - agora) / 60000);
        return res.status(429).json({ erro: `Conta bloqueada. Tente novamente em ${minutos} minuto(s).` });
      }
    }

    const senhaValida = await bcrypt.compare(senha, user.senha_hash);

    if (!senhaValida) {
      const novasTentativas = user.tentativas_login + 1;
      let bloqueadoAte = null;
      if (novasTentativas >= MAX_TENTATIVAS) {
        const dt = new Date(Date.now() + BLOQUEIO_MINUTOS * 60000);
        bloqueadoAte = dt.toISOString();
      }
      db.prepare('UPDATE usuarios SET tentativas_login = ?, bloqueado_ate = ? WHERE id = ?')
        .run(novasTentativas, bloqueadoAte, user.id);

      if (bloqueadoAte) {
        return res.status(429).json({ erro: `Muitas tentativas incorretas. Conta bloqueada por ${BLOQUEIO_MINUTOS} minutos.` });
      }
      return res.status(401).json({ erro: 'Usuário ou senha incorretos' });
    }

    // Reset tentativas
    db.prepare('UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL WHERE id = ?').run(user.id);

    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, tipo: user.tipo },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000
    });

    res.json({
      ok: true,
      usuario: {
        id: user.id,
        nome: user.nome,
        usuario: user.usuario,
        tipo: user.tipo,
        trocar_senha: !!user.trocar_senha
      }
    });
  } catch (err) {
    console.error('Erro login:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// POST /api/auth/logout
router.post('/logout', autenticar, (req, res) => {
  // Verifica se há carta em andamento (trava)
  const sessao = db.prepare('SELECT id FROM sessoes_carta WHERE usuario_id = ?').get(req.usuario.id);
  if (sessao) {
    return res.status(409).json({
      erro: 'Você tem uma carta em andamento. Finalize e baixe a carta antes de sair.'
    });
  }
  res.clearCookie('token');
  res.json({ ok: true });
});

// POST /api/auth/logout-forcado (limpa cookie sem verificar trava - usado após baixar carta)
router.post('/logout-forcado', autenticar, (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', autenticar, (req, res) => {
  const sessao = db.prepare('SELECT id, iniciada_em FROM sessoes_carta WHERE usuario_id = ?').get(req.usuario.id);
  res.json({
    usuario: req.usuario,
    carta_em_andamento: !!sessao
  });
});

// POST /api/auth/trocar-senha
router.post('/trocar-senha', autenticar, async (req, res) => {
  try {
    const { senha_atual, senha_nova } = req.body || {};

    if (!senha_atual || !senha_nova || typeof senha_nova !== 'string') {
      return res.status(400).json({ erro: 'Informe senha atual e nova' });
    }

    if (senha_nova.length < 8) {
      return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 8 caracteres' });
    }

    if (senha_nova.length > 200) {
      return res.status(400).json({ erro: 'Senha muito longa' });
    }

    const user = db.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(req.usuario.id);
    const ok = await bcrypt.compare(senha_atual, user.senha_hash);
    if (!ok) {
      return res.status(401).json({ erro: 'Senha atual incorreta' });
    }

    const novaHash = await bcrypt.hash(senha_nova, 12);
    db.prepare('UPDATE usuarios SET senha_hash = ?, trocar_senha = 0, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?')
      .run(novaHash, req.usuario.id);

    res.json({ ok: true });
  } catch (err) {
    console.error('Erro trocar senha:', err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports = router;
