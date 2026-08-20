(async function () {
  await App.carregarSessao();
  App.montarSidebar('nova-carta');
  App.ativarTravaSaida();

  const telaIniciar = document.getElementById('tela-iniciar');
  const telaForm = document.getElementById('tela-form');
  const telaSucesso = document.getElementById('tela-sucesso');
  const alertaForm = document.getElementById('alerta-form');

  let escolaSel = null;

  // Máscaras
  Mascaras.cpf(document.getElementById('f-cpf'));
  Mascaras.telefone(document.getElementById('f-telefone'));
  Mascaras.numero(document.getElementById('f-carga'));

  function mostrarAlerta(msg, tipo = 'erro') {
    alertaForm.innerHTML = `<div class="alerta alerta-${tipo}">${App.esc(msg)}</div>`;
    alertaForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => { alertaForm.innerHTML = ''; }, 6000);
  }

  function irParaPasso(n) {
    document.querySelectorAll('.passo-conteudo').forEach(p => p.classList.remove('ativo'));
    document.querySelector(`.passo-conteudo[data-passo="${n}"]`).classList.add('ativo');
    document.querySelectorAll('.step').forEach(s => {
      const num = parseInt(s.dataset.step);
      s.classList.toggle('ativa', num === n);
      s.classList.toggle('completa', num < n);
    });
    if (n === 4) montarResumo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Estado inicial baseado na sessão
  if (App.cartaEmAndamento) {
    telaIniciar.style.display = 'none';
    telaForm.style.display = 'block';
    document.getElementById('banner-trava').innerHTML =
      '<div class="trava-banner">🔒 Carta em andamento — finalize e baixe antes de sair.</div>';
  }

  // Cancelar (só admin)
  if (App.usuario.tipo === 'admin') {
    document.getElementById('btn-cancelar').style.display = 'inline-block';
  }

  // ============ INICIAR ============
  document.getElementById('btn-iniciar').addEventListener('click', async () => {
    const res = await App.api('/api/cartas/iniciar', { method: 'POST' });
    const d = await res.json();
    if (!res.ok) { alert(d.erro); return; }
    App.cartaEmAndamento = true;
    telaIniciar.style.display = 'none';
    telaForm.style.display = 'block';
    document.getElementById('banner-trava').innerHTML =
      '<div class="trava-banner">🔒 Carta em andamento — finalize e baixe antes de sair.</div>';
  });

  // ============ AUTOCOMPLETE ESCOLA ============
  const buscaInput = document.getElementById('busca-escola');
  const listaEl = document.getElementById('lista-escolas');
  let debounce = null;

  buscaInput.addEventListener('input', () => {
    clearTimeout(debounce);
    const termo = buscaInput.value.trim();
    if (termo.length < 2) { listaEl.classList.remove('ativo'); return; }
    debounce = setTimeout(async () => {
      const res = await App.api(`/api/escolas?busca=${encodeURIComponent(termo)}`);
      const escolas = await res.json();
      if (!escolas.length) {
        listaEl.innerHTML = '<div class="autocomplete-item">Nenhuma unidade encontrada</div>';
      } else {
        listaEl.innerHTML = escolas.slice(0, 30).map(e => `
          <div class="autocomplete-item" data-id="${e.id}">
            <strong>${App.esc(e.nome)}</strong>
            <span class="tipo-tag">${App.tipoLabel(e.tipo)}</span><br>
            <small style="color:var(--cinza-texto);">${App.esc(e.endereco)}</small>
          </div>
        `).join('');
        listaEl.querySelectorAll('[data-id]').forEach(item => {
          item.addEventListener('click', () => selecionarEscola(escolas.find(e => e.id == item.dataset.id)));
        });
      }
      listaEl.classList.add('ativo');
    }, 250);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete')) listaEl.classList.remove('ativo');
  });

  function selecionarEscola(e) {
    escolaSel = e;
    buscaInput.value = e.nome;
    listaEl.classList.remove('ativo');
    document.getElementById('f-diretor').value = e.nome_diretor;
    document.getElementById('f-escola').value = e.nome;
    document.getElementById('f-endereco').value = e.endereco;
    document.getElementById('escola-selecionada').style.display = 'block';
    document.getElementById('btn-p1').disabled = false;
  }

  // ============ NAVEGAÇÃO PASSOS ============
  document.getElementById('btn-p1').addEventListener('click', () => irParaPasso(2));

  document.querySelectorAll('[data-volta]').forEach(b =>
    b.addEventListener('click', () => irParaPasso(parseInt(b.dataset.volta))));

  document.querySelectorAll('[data-avanca]').forEach(b =>
    b.addEventListener('click', () => {
      const destino = parseInt(b.dataset.avanca);
      if (destino === 3 && !validaPasso2()) return;
      if (destino === 4 && !validaPasso3()) return;
      irParaPasso(destino);
    }));

  function validaPasso2() {
    const nome = document.getElementById('f-nome').value.trim();
    const cpf = document.getElementById('f-cpf').value.trim();
    const rg = document.getElementById('f-rg').value.trim();
    const mat = document.getElementById('f-matricula').value.trim();
    const tel = document.getElementById('f-telefone').value.trim();
    if (!nome || nome.length < 5) { mostrarAlerta('Informe o nome completo do servidor.'); return false; }
    if (cpf.replace(/\D/g, '').length !== 11) { mostrarAlerta('CPF inválido — deve ter 11 dígitos.'); return false; }
    if (!rg) { mostrarAlerta('Informe o RG do servidor.'); return false; }
    if (!mat) { mostrarAlerta('Informe a matrícula.'); return false; }
    if (tel.replace(/\D/g, '').length < 10) { mostrarAlerta('Telefone inválido.'); return false; }
    return true;
  }

  function validaPasso3() {
    const cargo = document.getElementById('f-cargo').value.trim();
    const carga = document.getElementById('f-carga').value.trim();
    const ano = document.getElementById('f-ano').value.trim();
    const turno = document.getElementById('f-turno').value;
    if (!cargo) { mostrarAlerta('Informe o cargo de concurso.'); return false; }
    if (!carga || parseInt(carga) < 1) { mostrarAlerta('Informe a carga horária.'); return false; }
    if (!ano) { mostrarAlerta('Informe a sala/ano/série.'); return false; }
    if (!turno) { mostrarAlerta('Selecione o turno.'); return false; }
    return true;
  }

  function coletar() {
    return {
      escola_id: escolaSel?.id,
      servidor_nome: document.getElementById('f-nome').value.trim().toUpperCase(),
      servidor_cpf: document.getElementById('f-cpf').value.trim(),
      servidor_rg: document.getElementById('f-rg').value.trim(),
      servidor_matricula: document.getElementById('f-matricula').value.trim(),
      servidor_telefone: document.getElementById('f-telefone').value.trim(),
      cargo: document.getElementById('f-cargo').value.trim().toUpperCase(),
      carga_horaria: document.getElementById('f-carga').value.trim(),
      ano_serie: document.getElementById('f-ano').value.trim().toUpperCase(),
      turno: document.getElementById('f-turno').value,
      observacao: document.getElementById('f-obs').value.trim().toUpperCase()
    };
  }

  function montarResumo() {
    const d = coletar();
    const linha = (rot, val) => val ? `<p style="margin-bottom:6px;"><strong style="color:var(--azul-imperial);">${rot}:</strong> ${App.esc(val)}</p>` : '';
    document.getElementById('resumo').innerHTML = `
      ${linha('Escola/Creche', escolaSel?.nome)}
      ${linha('Diretor(a)', escolaSel?.nome_diretor)}
      ${linha('Endereço', escolaSel?.endereco)}
      <hr style="margin:10px 0;border:none;border-top:1px solid var(--cinza-borda);">
      ${linha('Servidor', d.servidor_nome)}
      ${linha('CPF', d.servidor_cpf)}
      ${linha('RG', d.servidor_rg)}
      ${linha('Matrícula', d.servidor_matricula)}
      ${linha('Telefone', d.servidor_telefone)}
      <hr style="margin:10px 0;border:none;border-top:1px solid var(--cinza-borda);">
      ${linha('Cargo', d.cargo)}
      ${linha('Carga horária', d.carga_horaria + ' horas semanais')}
      ${linha('Ano/Série', d.ano_serie)}
      ${linha('Turno', d.turno)}
      ${linha('Observação', d.observacao)}
    `;
  }

  // ============ GERAR ============
  document.getElementById('btn-gerar').addEventListener('click', async () => {
    const btn = document.getElementById('btn-gerar');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Gerando...';

    try {
      const res = await App.api('/api/cartas/gerar', { method: 'POST', body: coletar() });

      if (!res.ok) {
        const d = await res.json();
        mostrarAlerta(d.erro || 'Erro ao gerar a carta.');
        btn.disabled = false;
        btn.textContent = '⬇️ Gerar e baixar carta (.docx)';
        return;
      }

      // Download do blob
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      const nome = match ? match[1] : 'carta_lotacao.docx';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Libera trava
      App.cartaEmAndamento = false;
      document.getElementById('banner-trava').innerHTML = '';
      telaForm.style.display = 'none';
      telaSucesso.style.display = 'block';
      window.scrollTo({ top: 0 });
    } catch (err) {
      mostrarAlerta('Erro de conexão ao gerar a carta.');
      btn.disabled = false;
      btn.textContent = '⬇️ Gerar e baixar carta (.docx)';
    }
  });

  // ============ CANCELAR (admin) ============
  document.getElementById('btn-cancelar').addEventListener('click', async () => {
    if (!confirm('Cancelar esta carta? Os dados preenchidos serão perdidos.')) return;
    const res = await App.api('/api/cartas/cancelar', { method: 'POST' });
    if (res.ok) {
      App.cartaEmAndamento = false;
      location.reload();
    } else {
      const d = await res.json();
      alert(d.erro);
    }
  });

  // ============ OUTRA CARTA ============
  document.getElementById('btn-outra').addEventListener('click', () => location.reload());
})();
