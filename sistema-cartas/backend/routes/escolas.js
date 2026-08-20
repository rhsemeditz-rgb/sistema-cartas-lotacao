const express = require('express');
const db = require('../database');
const { autenticar, apenasAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/escolas - listagem (qualquer usuário logado)
router.get('/', autenticar, (req, res) => {
  const busca = (req.query.busca || '').toString().trim();
  const tipo = (req.query.tipo || '').toString().trim();
  const incluirInativas = req.query.incluir_inativas === '1' && req.usuario.tipo === 'admin';

  let query = 'SELECT id, nome, endereco, nome_diretor, tipo, ativo FROM escolas WHERE 1=1';
  const params = [];

  if (!incluirInativas) {
    query += ' AND ativo = 1';
  }

  if (busca) {
    query += ' AND (nome LIKE ? OR endereco LIKE ? OR nome_diretor LIKE ?)';
    params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
  }

  if (tipo && ['municipal', 'rural', 'creche', 'setor'].includes(tipo)) {
    query += ' AND tipo = ?';
    params.push(tipo);
  }

  query += ' ORDER BY nome LIMIT 500';
  const lista = db.prepare(query).all(...params);
  res.json(lista);
});

// GET /api/escolas/:id
router.get('/:id', autenticar, (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ erro: 'ID inválido' });
  const escola = db.prepare('SELECT * FROM escolas WHERE id = ?').get(id);
  if (!escola) return res.status(404).json({ erro: 'Escola não encontrada' });
  res.json(escola);
});

// POST /api/escolas - só admin
router.post('/', autenticar, apenasAdmin, (req, res) => {
  const { nome, endereco, nome_diretor, tipo } = req.body || {};

  if (!nome || !endereco || !nome_diretor || !tipo) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
  }

  if (!['municipal', 'rural', 'creche', 'setor'].includes(tipo)) {
    return res.status(400).json({ erro: 'Tipo inválido' });
  }

  if (nome.length > 250 || endereco.length > 300 || nome_diretor.length > 200) {
    return res.status(400).json({ erro: 'Campos muito longos' });
  }

  const info = db.prepare(`
    INSERT INTO escolas (nome, endereco, nome_diretor, tipo)
    VALUES (?, ?, ?, ?)
  `).run(nome.trim().toUpperCase(), endereco.trim().toUpperCase(), nome_diretor.trim().toUpperCase(), tipo);

  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

// PUT /api/escolas/:id - só admin
router.put('/:id', autenticar, apenasAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ erro: 'ID inválido' });

  const escola = db.prepare('SELECT id FROM escolas WHERE id = ?').get(id);
  if (!escola) return res.status(404).json({ erro: 'Escola não encontrada' });

  const { nome, endereco, nome_diretor, tipo, ativo } = req.body || {};
  const updates = [];
  const params = [];

  if (nome !== undefined) {
    if (typeof nome !== 'string' || nome.length < 2 || nome.length > 250) return res.status(400).json({ erro: 'Nome inválido' });
    updates.push('nome = ?'); params.push(nome.trim().toUpperCase());
  }
  if (endereco !== undefined) {
    if (typeof endereco !== 'string' || endereco.length > 300) return res.status(400).json({ erro: 'Endereço inválido' });
    updates.push('endereco = ?'); params.push(endereco.trim().toUpperCase());
  }
  if (nome_diretor !== undefined) {
    if (typeof nome_diretor !== 'string' || nome_diretor.length > 200) return res.status(400).json({ erro: 'Nome do diretor inválido' });
    updates.push('nome_diretor = ?'); params.push(nome_diretor.trim().toUpperCase());
  }
  if (tipo !== undefined) {
    if (!['municipal', 'rural', 'creche', 'setor'].includes(tipo)) return res.status(400).json({ erro: 'Tipo inválido' });
    updates.push('tipo = ?'); params.push(tipo);
  }
  if (ativo !== undefined) {
    updates.push('ativo = ?'); params.push(ativo ? 1 : 0);
  }

  if (updates.length === 0) return res.json({ ok: true });

  updates.push('atualizado_em = CURRENT_TIMESTAMP');
  params.push(id);

  db.prepare(`UPDATE escolas SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ ok: true });
});

module.exports = router;
