const express = require('express');
const db = require('../database');
const { autenticar, apenasAdmin } = require('../middleware/auth');
const { limitCartas } = require('../middleware/rateLimit');
const { gerarCartaDocx } = require('../templates/carta-template');

const router = express.Router();

// Sanitiza texto (remove caracteres de controle)
function limpar(s, maxLen = 300) {
  if (typeof s !== 'string') return '';
  return s.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLen);
}

// GET /api/cartas/sessao - verifica se há carta em andamento
router.get('/sessao', autenticar, (req, res) => {
  const sessao = db.prepare('SELECT id, iniciada_em, dados_json FROM sessoes_carta WHERE usuario_id = ?').get(req.usuario.id);
  if (!sessao) return res.json({ ativa: false });
  res.json({
    ativa: true,
    iniciada_em: sessao.iniciada_em,
    dados: sessao.dados_json ? JSON.parse(sessao.dados_json) : null
  });
});

// POST /api/cartas/iniciar - abre uma sessão (trava)
router.post('/iniciar', autenticar, (req, res) => {
  const existe = db.prepare('SELECT id FROM sessoes_carta WHERE usuario_id = ?').get(req.usuario.id);
  if (existe) {
    return res.status(409).json({
      erro: 'Você já possui uma carta em andamento. Finalize a atual antes de iniciar outra.'
    });
  }
  db.prepare('INSERT INTO sessoes_carta (usuario_id, dados_json) VALUES (?, ?)').run(req.usuario.id, null);
  res.json({ ok: true });
});

// PUT /api/cartas/rascunho - salva rascunho (opcional)
router.put('/rascunho', autenticar, (req, res) => {
  const sessao = db.prepare('SELECT id FROM sessoes_carta WHERE usuario_id = ?').get(req.usuario.id);
  if (!sessao) return res.status(404).json({ erro: 'Nenhuma carta em andamento' });
  const dados = req.body || {};
  db.prepare('UPDATE sessoes_carta SET dados_json = ? WHERE id = ?').run(JSON.stringify(dados), sessao.id);
  res.json({ ok: true });
});

// POST /api/cartas/cancelar - cancela sessão (só admin pode cancelar sem baixar)
router.post('/cancelar', autenticar, (req, res) => {
  if (req.usuario.tipo !== 'admin') {
    return res.status(403).json({ erro: 'Apenas administradores podem cancelar uma carta sem baixá-la.' });
  }
  db.prepare('DELETE FROM sessoes_carta WHERE usuario_id = ?').run(req.usuario.id);
  res.json({ ok: true });
});

// POST /api/cartas/gerar - valida, gera .docx, registra log, encerra sessão
router.post('/gerar', autenticar, limitCartas, async (req, res) => {
  try {
    const sessao = db.prepare('SELECT id FROM sessoes_carta WHERE usuario_id = ?').get(req.usuario.id);
    if (!sessao) {
      return res.status(400).json({ erro: 'Inicie uma nova carta antes de gerar.' });
    }

    const b = req.body || {};

    // Escola
    const escolaId = parseInt(b.escola_id);
    if (!escolaId) return res.status(400).json({ erro: 'Selecione a escola/creche/setor' });
    const escola = db.prepare('SELECT * FROM escolas WHERE id = ? AND ativo = 1').get(escolaId);
    if (!escola) return res.status(400).json({ erro: 'Escola não encontrada ou inativa' });

    // Dados do servidor
    const dados = {
      diretor_nome: limpar(escola.nome_diretor, 200),
      escola_nome: limpar(escola.nome, 250),
      escola_endereco: limpar(escola.endereco, 300),
      servidor_nome: limpar(b.servidor_nome, 200).toUpperCase(),
      servidor_cpf: limpar(b.servidor_cpf, 20),
      servidor_rg: limpar(b.servidor_rg, 20),
      servidor_matricula: limpar(b.servidor_matricula, 30),
      servidor_telefone: limpar(b.servidor_telefone, 20),
      cargo: limpar(b.cargo, 200).toUpperCase(),
      carga_horaria: limpar(b.carga_horaria, 10),
      ano_serie: limpar(b.ano_serie, 100).toUpperCase(),
      turno: limpar(b.turno, 100).toUpperCase(),
      observacao: limpar(b.observacao, 1000)
    };

    // Validação obrigatórios
    const obrigatorios = ['servidor_nome', 'servidor_cpf', 'servidor_matricula', 'servidor_telefone', 'cargo', 'carga_horaria', 'ano_serie', 'turno'];
    for (const campo of obrigatorios) {
      if (!dados[campo]) {
        return res.status(400).json({ erro: `Campo obrigatório vazio: ${campo}` });
      }
    }

    // Gera o Word
    const buffer = await gerarCartaDocx(dados);

    // Registra log
    db.prepare(`
      INSERT INTO log_cartas (usuario_id, usuario_nome, escola_id, escola_nome, servidor_nome, servidor_cpf, servidor_matricula, cargo, ip_origem)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.usuario.id, req.usuario.nome,
      escola.id, escola.nome,
      dados.servidor_nome, dados.servidor_cpf, dados.servidor_matricula, dados.cargo,
      req.ip
    );

    // Encerra sessão (libera trava)
    db.prepare('DELETE FROM sessoes_carta WHERE usuario_id = ?').run(req.usuario.id);

    // Nome do arquivo
    const nomeArquivo = `carta_lotacao_${dados.servidor_nome.replace(/[^A-Z0-9]+/gi, '_').slice(0, 60)}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('Erro gerar carta:', err);
    res.status(500).json({ erro: 'Erro ao gerar a carta' });
  }
});

module.exports = router;
