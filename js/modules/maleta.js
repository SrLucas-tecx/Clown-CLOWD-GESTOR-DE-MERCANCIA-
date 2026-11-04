// Lista de maleta de cada bazar (mesa, cambio, bolsas, terminal…), escrita como texto y marcada al empacar.
// Ya no es una pestaña: vive dentro del detalle de cada bazar (eventos.js) y arranca con la lista
// predeterminada de Ajustes → General. Aquí también vive el Conteo físico.
(() => {
  const {db, ui} = CC, E = ui.esc;
  const norm = s => String(s || '').trim().toLowerCase();
  const BASE = ['Mesa', 'Cambio para la caja', 'Bolsas', 'Terminal', 'Cartelitos', 'Mantel'];
  const base = () => CC.ajustes ? CC.ajustes.listaMaleta() : BASE;
  const maletaDe = id => db.all('maletas').find(m => m.eventoId === id);

  CC.maletaUI = {
    BASE,

    // La maleta de un bazar; si no existe se crea con la lista predeterminada.
    asegurar(id) {
      return maletaDe(id) || db.add('maletas', {eventoId: id, items: [], lista: base().map(t => ({t, ok: false})), cerrada: false});
    },

    // Tarjeta de la maleta para el detalle del bazar.
    html(bazarId) {
      const maleta = maletaDe(bazarId);
      if (!maleta) return `
        <div class="card"><div class="bar" style="margin:0"><div style="flex:1"><h3 style="margin:0">🧳 Lista de maleta</h3>
          <span class="mute">Este bazar todavía no tiene lista.</span></div>
          <button class="btn sm" data-a="mcrear">Preparar con mi lista básica</button></div></div>`;
      const lista = maleta.lista || [], listos = lista.filter(x => x.ok).length, completa = lista.length && listos === lista.length;
      return `
        <div class="card">
          <div class="bar"><div style="flex:1"><h3 style="margin:0">🧳 Lista de maleta</h3>
            <span class="mute">Márcalo al empacar. La lista básica se cambia en Ajustes → General.</span></div>
            <span class="chip" style="--c:${completa ? 'var(--color-success)' : 'var(--amarillo-300)'}">${listos}/${lista.length} listo</span>
            <button class="btn ghost sm" data-a="mreset">↺ Desmarcar todo</button></div>
          ${lista.map((x, i) => `
            <div class="line" style="gap:8px">
              <button class="btn ${x.ok ? '' : 'ghost'} sm" data-a="mcheck" data-i="${i}" aria-label="Marcar">${x.ok ? '✅' : '⬜'}</button>
              <span style="flex:1;${x.ok ? 'text-decoration:line-through;opacity:.6' : ''}">${E(x.t)}</span>
              <button class="btn ghost sm" data-a="mquitar" data-i="${i}" title="Quitar">✕</button>
            </div>`).join('') || '<p class="mute">La lista está vacía.</p>'}
          <div class="bar" style="margin-top:8px">
            <input class="inp nuevo-item" placeholder="Ej. extensión eléctrica, lonas, plumones…" style="flex:1">
            <button class="btn sm" data-a="magregar">＋ Agregar</button>
          </div>
        </div>`;
    },

    // Botón de la tarjeta (b es el botón). Devuelve true si lo atendió.
    click(b, bazarId, refrescar) {
      const a = b.dataset.a;
      if (a === 'mcrear') { this.asegurar(bazarId); refrescar(); return true; }
      const maleta = maletaDe(bazarId);
      if (!maleta) return false;
      const lista = maleta.lista || [], i = +b.dataset.i, guardar = nueva => { db.update('maletas', maleta.id, {lista: nueva}); refrescar(); };
      if (a === 'mcheck') guardar(lista.map((x, k) => k === i ? {...x, ok: !x.ok} : x));
      else if (a === 'mquitar') guardar(lista.filter((_, k) => k !== i));
      else if (a === 'mreset') guardar(lista.map(x => ({...x, ok: false})));
      else if (a === 'magregar') this.agregar(bazarId, refrescar);
      else return false;
      return true;
    },

    agregar(bazarId, refrescar) {
      const maleta = maletaDe(bazarId), campo = document.querySelector('.nuevo-item');
      if (!maleta || !campo) return;
      const texto = campo.value.trim(), lista = maleta.lista || [];
      if (!texto) return;
      if (lista.some(x => norm(x.t) === norm(texto))) return ui.toast('Eso ya está en la lista');
      db.update('maletas', maleta.id, {lista: [...lista, {t: texto, ok: false}]});
      refrescar();
    },

    // Enter en el campo de la lista agrega el elemento.
    key(e, bazarId, refrescar) {
      if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('nuevo-item')) {
        e.preventDefault();
        this.agregar(bazarId, refrescar);
        return true;
      }
      return false;
    }
  };

  // ---------------------------------------------------------------------------------------------
  // Conteo físico (Inventario)
  // ---------------------------------------------------------------------------------------------
  CC.router.register('conteo', 'Conteo físico', '🧮', el => {
    const vs = db.all('variantes');
    el.innerHTML = `<div class="bar"><span class="mute">Cuenta lo que hay en físico y escribe el número. Lo que dejes en blanco no se toca.</span><div style="flex:1"></div><button class="btn" id="ap">Aplicar ajustes</button></div>
      <div class="card"><table><thead><tr><th>Producto</th><th>Sistema</th><th>Contado ✎</th><th>Diferencia</th></tr></thead><tbody>${vs.map(v => `<tr><td>${E(CC.nombreVar(v))}</td><td>${CC.stock(v.id)}</td><td><input class="inp ed ct" data-v="${v.id}" type="number" min="0"></td><td id="d${v.id}">—</td></tr>`).join('') || '<tr><td colspan="4" class="mute">Sin productos.</td></tr>'}</tbody></table></div>`;
    const cuenta = () => [...el.querySelectorAll('.ct')].filter(i => i.value !== '').map(i => ({
      id: i.dataset.v,
      c: +i.value,
      d: +i.value - CC.stock(i.dataset.v)
    }));
    el.oninput = e => {
      const i = e.target.closest('.ct');
      if (!i)
        return;
      const c = el.querySelector('#d' + i.dataset.v), d = +i.value - CC.stock(i.dataset.v);
      c.textContent = i.value === '' ? '—' : d === 0 ? '✅ cuadra' : (d > 0 ? '+' : '') + d;
      c.className = i.value === '' || d === 0 ? '' : d < 0 ? 'neg' : 'warn';
    };
    el.querySelector('#ap').onclick = () => {
      const c = cuenta();
      if (c.some(x => !(x.c >= 0)))
        return ui.toast('No se puede: el conteo no puede ser negativo');
      const dif = c.filter(x => x.d !== 0);
      if (!c.length)
        return ui.toast('No has contado nada: escribe al menos un número');
      if (!dif.length)
        return ui.toast('Todo cuadra: no hay nada que ajustar');
      ui.confirm(`Se ajustarán ${dif.length} producto(s) al conteo físico.`, 'Aplicar').then(ok => {
        if (!ok)
          return;
        const copia = JSON.stringify(db.crudo());
        dif.forEach(x => CC.mover(x.id, x.d, 'ajuste', 'Conteo físico'));
        CC.router.show();
        ui.deshacer('Inventario ajustado al conteo.', copia);
      });
    };
  });
})();
