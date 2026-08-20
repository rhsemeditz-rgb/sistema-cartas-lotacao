// ============ Helpers globais ============
const App = {
  usuario: null,
  cartaEmAndamento: false,

  async api(url, opts = {}) {
    const res = await fetch(url, {
      credentials: 'include',
      headers: opts.body && !(opts.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {},
      ...opts,
      body: opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)
        ? JSON.stringify(opts.body)
        : opts.body
    });
    if (res.status === 401) {
      window.location.href = '/';
      throw new Error('Não autenticado');
    }
    return res;
  },

  async carregarSessao() {
    const res = await this.api('/api/auth/me');
    const data = await res.json();
    this.usuario = data.usuario;
    this.cartaEmAndamento = data.carta_em_andamento;

    if (this.usuario.trocar_senha && !location.pathname.includes('trocar-senha')) {
      window.location.href = '/trocar-senha';
      return;
    }
    return data;
  },

  montarSidebar(paginaAtiva) {
    const isAdmin = this.usuario.tipo === 'admin';
    const el = document.getElementById('sidebar');
    if (!el) return;

    const menuAdmin = isAdmin ? `
      <a href="/usuarios" data-pg="usuarios">👥 Gerenciar Usuários</a>
      <a href="/escolas" data-pg="escolas">🏫 Gerenciar Escolas</a>
      <a href="/auditoria" data-pg="auditoria">📋 Auditoria</a>
    ` : '';

    el.innerHTML = `
      <div class="sidebar-header">
        <img src="/assets/brasao.png" alt="Brasão">
        <h1>Cartas de Lotação</h1>
        <p>SEMED — Imperatriz/MA</p>
      </div>
      <nav class="sidebar-menu">
        <a href="/dashboard" data-pg="dashboard">🏠 Início</a>
        <a href="/nova-carta" data-pg="nova-carta">📄 Nova Carta de Lotação</a>
        ${menuAdmin}
      </nav>
      <div class="sidebar-footer">
        <div class="usuario-tipo">${isAdmin ? 'Administrador' : 'Usuário'}</div>
        <div class="usuario-nome">${this.esc(this.usuario.nome)}</div>
        <button class="btn" id="btn-trocar-senha-menu">Trocar senha</button>
        <button class="btn" id="btn-sair">Sair</button>
      </div>
    `;

    const ativo = el.querySelector(`[data-pg="${paginaAtiva}"]`);
    if (ativo) ativo.classList.add('ativo');

    document.getElementById('btn-sair').addEventListener('click', () => this.sair());
    document.getElementById('btn-trocar-senha-menu').addEventListener('click', () => {
      if (this.cartaEmAndamento) {
        alert('Você tem uma carta em andamento. Finalize e baixe a carta antes de navegar.');
        return;
      }
      window.location.href = '/trocar-senha';
    });

    // Trava de navegação: intercepta cliques no menu se houver carta em andamento
    el.querySelectorAll('.sidebar-menu a').forEach(a => {
      a.addEventListener('click', (e) => {
        if (this.cartaEmAndamento && a.dataset.pg !== 'nova-carta') {
          e.preventDefault();
          alert('⚠️ Você tem uma carta em andamento.\n\nFinalize e baixe a carta antes de sair desta tela.');
          if (!location.pathname.includes('nova-carta')) {
            window.location.href = '/nova-carta';
          }
        }
      });
    });
  },

  async sair() {
    try {
      const res = await this.api('/api/auth/logout', { method: 'POST' });
      if (res.status === 409) {
        const d = await res.json();
        alert('⚠️ ' + d.erro);
        window.location.href = '/nova-carta';
        return;
      }
      window.location.href = '/';
    } catch (e) {
      window.location.href = '/';
    }
  },

  // Trava beforeunload
  ativarTravaSaida() {
    window.addEventListener('beforeunload', (e) => {
      if (App.cartaEmAndamento) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  },

  esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  },

  fmtData(iso) {
    if (!iso) return '';
    const d = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'));
    if (isNaN(d)) return iso;
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  toast(msg, tipo = 'sucesso') {
    const el = document.createElement('div');
    el.className = `alerta alerta-${tipo}`;
    el.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999;box-shadow:var(--sombra-forte);max-width:360px;';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  },

  tipoLabel(t) {
    return { municipal: 'Municipal', rural: 'Zona Rural', creche: 'Creche', setor: 'Setor/Depto' }[t] || t;
  },

  tipoTagClass(t) {
    return { municipal: 'tag-azul', rural: 'tag-verde', creche: 'tag-amarelo', setor: 'tag-cinza' }[t] || 'tag-cinza';
  }
};

// Máscaras de input
const Mascaras = {
  cpf(input) {
    input.addEventListener('input', () => {
      let v = input.value.replace(/\D/g, '').slice(0, 11);
      v = v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      input.value = v;
    });
  },
  telefone(input) {
    input.addEventListener('input', () => {
      let v = input.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
      else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
      input.value = v;
    });
  },
  numero(input) {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 3);
    });
  }
};
