const express = require('express');
const db = require('../database');
const { autenticar, apenasAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(autenticar, apenasAdmin);

// GET /api/auditoria
router.get('/', (req, res) => {
  const busca = (req.query.busca || '').toString().trim();
  const dataInicio = (req.query.data_inicio || '').toString().trim();
  const dataFim = (req.query.data_fim || '').toString().trim();
  const limite = Math.min(parseInt(req.query.limite) || 200, 1000);

  let query = 'SELECT * FROM log_cartas WHERE 1=1';
  const params = [];

  if (busca) {
    query += ' AND (servidor_nome LIKE ? OR usuario_nome LIKE ? OR escola_nome LIKE ? OR servidor_cpf LIKE ?)';
    params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`, `%${busca}%`);
  }
  if (dataInicio && /^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
    query += ' AND gerada_em >= ?'; params.push(dataInicio + ' 00:00:00');
  }
  if (dataFim && /^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
    query += ' AND gerada_em <= ?'; params.push(dataFim + ' 23:59:59');
  }

  query += ' ORDER BY gerada_em DESC LIMIT ?';
  params.push(limite);

  const lista = db.prepare(query).all(...params);
  res.json(lista);
});

// GET /api/auditoria/estatisticas
router.get('/estatisticas', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM log_cartas').get().c;
  const hoje = db.prepare("SELECT COUNT(*) as c FROM log_cartas WHERE date(gerada_em) = date('now', 'localtime')").get().c;
  const mes = db.prepare("SELECT COUNT(*) as c FROM log_cartas WHERE strftime('%Y-%m', gerada_em) = strftime('%Y-%m', 'now', 'localtime')").get().c;
  res.json({ total, hoje, mes });
});

module.exports = router;
