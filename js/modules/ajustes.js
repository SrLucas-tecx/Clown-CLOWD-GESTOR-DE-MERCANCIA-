// Ajustes → General: comisión de terminal, lista básica de maleta y etiquetas.
(() => {
  const {ui} = CC, E = ui.esc;
  const CLAVE_MALETA = 'clowncloud:maletaBase';
  const CLAVE_COMISION = 'clowncloud:comision';
  const norm = s => String(s || '').trim().toLowerCase();

  const leerLista = () => {
    try {
      const l = JSON.parse(localStorage.getItem(CLAVE_MALETA));
      return Array.isArray(l) ? l.map(String).filter(Boolean) : null;
    } catch (e) {
      return null;
    }
  };
  const guardarLista = l => localStorage.setItem(CLAVE_MALETA, JSON.stringify(l));

  CC.ajustes = {
    // Lista que se copia a cada bazar nuevo.
    listaMaleta: () => leerLista() || CC.maletaUI.BASE.slice()
  };

  CC.router.register('general', 'General', '⚙️', el => {
    const lista = CC.ajustes.listaMaleta();

    el.innerHTML = `
      <div class="grid2" style="align-items:start">
        <div>
          <div class="card">
            <h3 style="margin:0 0 4px">💳 Comisión de terminal</h3>
            <p class="mute" style="margin:0 0 8px">Porcentaje que cobra la terminal en pagos con tarjeta. Aplica a las ventas nuevas.</p>
            ${ui.inp('com', 'Comisión (%)', ui.cfg.comision(), 'number', 'step="0.1" min="0" max="100"')}
          </div>
          <div class="card">
            <h3 style="margin:0 0 4px">🏷️ Etiquetas</h3>
            <p class="mute" style="margin:0 0 8px">Crea, renombra, cambia el color o elimina las etiquetas que usas.</p>
            <div class="bar" style="margin:0">
              <button class="btn ghost" data-t="cliente">👥 De clientes</button>
              <button class="btn ghost" data-t="producto">📦 De productos</button>
              <button class="btn ghost" data-t="consulta">❓ De consultas</button>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 4px">🧳 Lista básica de maleta</h3>
          <p class="mute" style="margin:0 0 8px">Se copia a cada bazar nuevo. Cada bazar puede cambiar su propia lista sin afectar esta.</p>
          ${lista.map((t, i) => `
            <div class="line" style="gap:8px"><span style="flex:1">${E(t)}</span>
              <button class="btn ghost sm" data-a="quitar" data-i="${i}" title="Quitar">✕</button></div>`).join('') || '<p class="mute">La lista está vacía.</p>'}
          <div class="bar" style="margin-top:8px">
            <input class="inp" id="nuevo" placeholder="Ej. extensión eléctrica" style="flex:1">
            <button class="btn sm" data-a="agregar">＋ Agregar</button>
          </div>
          <button class="btn ghost sm" data-a="restaurar">↺ Restaurar lista inicial</button>
        </div>
      </div>`;

    const agregar = () => {
      const campo = el.querySelector('#nuevo'), texto = campo.value.trim();
      if (!texto) return;
      if (lista.some(t => norm(t) === norm(texto))) return ui.toast('Eso ya está en la lista');
      guardarLista([...lista, texto]);
      CC.router.show();
    };

    el.onchange = e => {
      if (e.target.name !== 'com') return;
      const n = +e.target.value;
      if (!(n >= 0 && n <= 100)) {
        ui.toast('No se puede: la comisión debe estar entre 0 y 100 %');
        return CC.router.show();
      }
      localStorage.setItem(CLAVE_COMISION, n);
      ui.toast('Comisión guardada: aplica a ventas nuevas');
    };
    el.onkeydown = e => {
      if (e.key === 'Enter' && e.target.id === 'nuevo') { e.preventDefault(); agregar(); }
    };
    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.t) return CC.tags.gestionar(b.dataset.t, () => CC.router.show());
      const a = b.dataset.a;
      if (a === 'agregar') agregar();
      else if (a === 'quitar') { guardarLista(lista.filter((_, i) => i !== +b.dataset.i)); CC.router.show(); }
      else if (a === 'restaurar') {
        ui.confirm('La lista básica volverá a la inicial.', 'Restaurar').then(ok => {
          if (!ok) return;
          localStorage.removeItem(CLAVE_MALETA);
          CC.router.show();
        });
      }
    };
  });
})();
