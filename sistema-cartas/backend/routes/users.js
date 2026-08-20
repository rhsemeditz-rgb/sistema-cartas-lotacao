const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../database');
const { autenticar, apenasAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(autenticar, apenasAdmin);

// Validador simples
function validaUsuarioNome(s) {
  return typeof s === 'string' && /^[a-z0-9._-]{3,50}$/.test(s);
}

// GET /api/users
router.get('/', (req, res) => {
  const busca = (req.query.busca || '').toString().trim();
  let query = 'SELECT id, nome, usuario, tipo, ativo, trocar_senha, criado_em FROM usuarios';
  let params = [];
  if (busca) {
    query += ' WHERE nome LIKE ? OR usuario LIKE ?';
    params = [`%${busca}%`, `%${busca}%`];
  }
  query += ' ORDER BY nome';
  const lista = db.prepare(query).all(...params);
  res.json(lista);
});

// POST /api/users
router.post('/', async (req, res) => {
  try {
    const { nome, usuario, senha, tipo } = req.body || {};

    if (!nome || !usuario || !senha || !tipo) {
      return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
    }

    if (nome.length < 3 || nome.length > 150) {
      return res.status(400).json({ erro: 'Nome deve ter entre 3 e 150 caracteres' });
    }

    const userNorm = usuario.trim().toLowerCase();
    if (!validaUsuarioNome(userNorm)) {
      return res.status(400).json({ erro: 'Usuário deve ter 3-50 caracteres (letras, números, ponto, hífen, underline)' });
    }

    if (senha.length < 8 || senha.length > 200) {
      return res.status(400).json({ erro: 'Senha deve ter no mínimo 8 caracteres' });
    }

    if (!['admin', 'comum'].includes(tipo)) {
      return res.status(400).json({ erro: 'Tipo inválido' });
    }

    const existe = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(userNorm);
    if (existe) {
      return res.status(409).json({ erro: 'Nome de usuário já cadastrado' });
    }

    const hash = await bcrypt.hash(senha, 12);
    const info = db.prepare(`
      INSERT INTO usuarios (nome, usuario, senha_hash, tipo, trocar_senha)
      VALUES (?, ?, ?, ?, 1)
    `).run(nome.trim(), userNorm, hash, tipo);

    res.status(201).json({ ok: true, id: info.lastInsertRowid });
  } catch (err) {
    console.error('Erro criar usuario:', err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ erro: 'ID inválido' });

    const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' });

    const { nome, tipo, senha, ativo } = req.body || {};
    const updates = [];
    const params = [];

    if (nome !== undefined) {
      if (typeof nome !== 'string' || nome.length < 3 || nome.length > 150) {
        return res.status(400).json({ erro: 'Nome inválido' });
      }
      updates.push('nome = ?'); params.push(nome.trim());
    }
    if (tipo !== undefined) {
      if (!['admin', 'comum'].includes(tipo)) return res.status(400).json({ erro: 'Tipo inválido' });
      // Não permite rebaixar a si mesmo
      if (id === req.usuario.id && tipo !== 'admin') {
        return res.status(400).json({ erro: 'Você não pode rebaixar seu próprio usuário' });
      }
      updates.push('tipo = ?'); params.push(tipo);
    }
    if (ativo !== undefined) {
      if (id === req.usuario.id && !ativo) {
        return res.status(400).json({ erro: 'Você não pode desativar seu próprio usuário' });
      }
      updates.push('ativo = ?'); params.push(ativo ? 1 : 0);
    }
    if (senha !== undefined && senha !== '') {
      if (typeof senha !== 'string' || senha.length < 8 || senha.length > 200) {
        return res.status(400).json({ erro: 'Senha deve ter no mínimo 8 caracteres' });
      }
      const hash = await bcrypt.hash(senha, 12);
      updates.push('senha_hash = ?', 'trocar_senha = 1'); params.push(hash);
    }

    if (updates.length === 0) return res.json({ ok: true });

    updates.push('atualizado_em = CURRENT_TIMESTAMP');
    params.push(id);

    db.prepare(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro editar usuario:', err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ erro: 'ID inválido' });
  if (id === req.usuario.id) {
    return res.status(400).json({ erro: 'Você não pode excluir seu próprio usuário' });
  }
  const user = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' });

  // Encerra sessão de carta em aberto (se houver)
  db.prepare('DELETE FROM sessoes_carta WHERE usuario_id = ?').run(id);
  db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
  res.json({ ok: true });
});

module.exports = router;
