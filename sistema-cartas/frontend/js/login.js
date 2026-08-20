(function () {
  const form = document.getElementById('form-login');
  const alerta = document.getElementById('alerta');
  const btn = document.getElementById('btn-entrar');

  function mostrarErro(msg) {
    alerta.textContent = msg;
    alerta.style.display = 'block';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alerta.style.display = 'none';

    const usuario = document.getElementById('usuario').value.trim();
    const senha = document.getElementById('senha').value;

    if (!usuario || !senha) {
      mostrarErro('Preencha usuário e senha.');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span>';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ usuario, senha })
      });
      const data = await res.json();

      if (!res.ok) {
        mostrarErro(data.erro || 'Erro ao entrar.');
        btn.disabled = false;
        btn.textContent = 'Entrar';
        return;
      }

      if (data.usuario.trocar_senha) {
        window.location.href = '/trocar-senha';
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err) {
      mostrarErro('Erro de conexão. Tente novamente.');
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  });
})();
