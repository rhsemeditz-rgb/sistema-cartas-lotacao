const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const db = require('../database');

console.log('🔧 Inicializando banco de dados...');

// ============ TABELAS ============

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    usuario TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('admin', 'comum')),
    ativo INTEGER NOT NULL DEFAULT 1,
    trocar_senha INTEGER NOT NULL DEFAULT 0,
    tentativas_login INTEGER NOT NULL DEFAULT 0,
    bloqueado_ate TEXT,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS escolas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    endereco TEXT NOT NULL,
    nome_diretor TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('municipal', 'rural', 'creche', 'setor')),
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessoes_carta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL UNIQUE,
    iniciada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dados_json TEXT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS log_cartas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    usuario_nome TEXT NOT NULL,
    escola_id INTEGER,
    escola_nome TEXT NOT NULL,
    servidor_nome TEXT NOT NULL,
    servidor_cpf TEXT NOT NULL,
    servidor_matricula TEXT,
    cargo TEXT,
    ip_origem TEXT,
    gerada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (escola_id) REFERENCES escolas(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_escolas_nome ON escolas(nome);
  CREATE INDEX IF NOT EXISTS idx_escolas_tipo ON escolas(tipo);
  CREATE INDEX IF NOT EXISTS idx_escolas_ativo ON escolas(ativo);
  CREATE INDEX IF NOT EXISTS idx_log_gerada ON log_cartas(gerada_em);
  CREATE INDEX IF NOT EXISTS idx_usuarios_usuario ON usuarios(usuario);
`);

console.log('✅ Tabelas criadas');

// ============ SEED ADMIN ============

const adminExists = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get('ana.camuca');

if (!adminExists) {
  const senhaHash = bcrypt.hashSync('Anasemed', 12);
  db.prepare(`
    INSERT INTO usuarios (nome, usuario, senha_hash, tipo, trocar_senha)
    VALUES (?, ?, ?, ?, ?)
  `).run('Ana Cleide Matos Camuça', 'ana.camuca', senhaHash, 'admin', 1);
  console.log('✅ Usuário admin criado: ana.camuca / Anasemed (deverá trocar no 1º acesso)');
} else {
  console.log('ℹ️  Usuário admin já existe');
}

// ============ SEED ESCOLAS ============

const escolasCount = db.prepare('SELECT COUNT(*) as c FROM escolas').get().c;

if (escolasCount === 0) {
  const seedPath = path.join(__dirname, 'escolas-seed.json');
  if (fs.existsSync(seedPath)) {
    const escolas = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    const insert = db.prepare(`
      INSERT INTO escolas (nome, endereco, nome_diretor, tipo)
      VALUES (?, ?, ?, ?)
    `);
    const tx = db.transaction((lista) => {
      for (const e of lista) {
        insert.run(e.nome, e.endereco, e.diretor, e.tipo);
      }
    });
    tx(escolas);
    console.log(`✅ ${escolas.length} escolas/creches/setores cadastrados`);
  } else {
    console.log('⚠️  Arquivo escolas-seed.json não encontrado');
  }
} else {
  console.log(`ℹ️  ${escolasCount} escolas já cadastradas`);
}

console.log('🎉 Banco de dados pronto!');
process.exit(0);
