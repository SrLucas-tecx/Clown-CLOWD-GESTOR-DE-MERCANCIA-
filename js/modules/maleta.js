// Maleta: lista de lo que llevas a cada bazar (mesa, cambio, bolsas, terminal…), escrita como texto.
// La mercancía (pines y stickers) se asigna dentro de cada bazar. Aquí también vive el Conteo físico.
(() => {
  const {db, ui} = CC, E = ui.esc;
  const norm = s => String(s || '').trim().toLowerCase();
  const BASE = ['Mesa', 'Cambio para la caja', 'Bolsas', 'Terminal', 'Cartelitos', 'Mantel'];
  const bazarVigente = id => { const b = db.get('eventos', id); return b && !b.eliminado ? b : null; };

  // Vuelve a dibujar la pantalla sin perder el lugar donde estabas.
  const refrescar = () => {
    const y = window.scrollY, contenedor = document.querySelector('.page-content'), yc = contenedor ? contenedor.scrollTop : 0;
    CC.router.show();
    window.scrollTo(0, y);
    if (contenedor) contenedor.scrollTop = yc;
  };

  const actualizarLista = (maleta, lista) => db.update('maletas', maleta.id, {lista});

  // Crea la lista de un bazar que todavía no tiene.
  function preparar() {
    const libres = db.all('eventos').filter(e => !db.all('maletas').some(m => m.eventoId === e.id));
    if (!libres.length) return ui.toast(db.all('eventos').length ? 'Todos tus bazares ya tienen su lista' : 'Primero crea un bazar en Negocio → Bazares');
    ui.modal('Preparar lista de maleta', `
      <label>Bazar<select class="inp" name="ev">${libres.map(e => `<option value="${e.id}">${E(e.nombre)}</option>`).join('')}</select></label>
      <label>Empezar con<select class="inp" name="inicio"><option value="base">Lo básico (${E(BASE.join(', '))})</option><option value="vacia">Una lista vacía</option></select></label>`, m => {
      const o = ui.vals(m);
      db.add('maletas', {eventoId: o.ev, items: [], lista: o.inicio === 'base' ? BASE.map(t => ({t, ok: false})) : [], cerrada: false});
      refrescar();
    });
  }

  CC.router.register('maleta', 'Maleta', '🧳', el => {
    const maletas = db.all('maletas').filter(m => bazarVigente(m.eventoId)).slice().reverse();
    el.innerHTML = `
      <div class="bar">
        <button class="btn" id="n">+ Preparar lista</button>
        <span class="mute">Anota lo que llevas a cada bazar y márcalo al empacar. Los pines y stickers se asignan dentro del bazar.</span>
      </div>` + (maletas.map(m => {
        const bazar = bazarVigente(m.eventoId), lista = m.lista || [], listos = lista.filter(x => x.ok).length;
        return `
        <div class="card">
          <div class="bar">
            <div style="flex:1"><h3 style="margin:0">🧳 ${E(bazar.nombre)}</h3>
              <span class="mute">${E(bazar.fecha || '')}${m.cerrada ? ' · 🔒 mercancía cerrada' : ''}</span></div>
            <span class="chip" style="--c:${listos === lista.length && lista.length ? 'var(--color-success)' : 'var(--amarillo-300)'}">${listos}/${lista.length} listo</span>
            <button class="btn ghost sm" data-a="reset" data-m="${m.id}">↺ Desmarcar todo</button>
          </div>
          ${lista.map((x, i) => `
            <div class="line" style="gap:8px">
              <button class="btn ${x.ok ? '' : 'ghost'} sm" data-a="check" data-m="${m.id}" data-i="${i}">${x.ok ? '✅' : '⬜'}</button>
              <span style="flex:1;${x.ok ? 'text-decoration:line-through;opacity:.6' : ''}">${E(x.t)}</span>
              <button class="btn ghost sm" data-a="quitar" data-m="${m.id}" data-i="${i}" title="Quitar">✕</button>
            </div>`).join('') || '<p class="mute">La lista está vacía.</p>'}
          <div class="bar" style="margin-top:8px">
            <input class="inp nuevo-item" data-m="${m.id}" placeholder="Ej. extensión eléctrica, lonas, plumones…" style="flex:1">
            <button class="btn sm" data-a="agregar" data-m="${m.id}">＋ Agregar</button>
          </div>
        </div>`;
      }).join('') || '<p class="mute">Aún no hay listas. Prepara la primera con «+ Preparar lista».</p>');

    const agregar = id => {
      const maleta = db.get('maletas', id), campo = el.querySelector(`.nuevo-item[data-m="${id}"]`), texto = campo.value.trim();
      if (!texto) return;
      const lista = maleta.lista || [];
      if (lista.some(x => norm(x.t) === norm(texto))) return ui.toast('Eso ya está en la lista');
      actualizarLista(maleta, [...lista, {t: texto, ok: false}]);
      refrescar();
    };

    el.querySelector('#n').onclick = preparar;
    el.onkeydown = e => {
      if (e.key === 'Enter' && e.target.classList.contains('nuevo-item')) { e.preventDefault(); agregar(e.target.dataset.m); }
    };
    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b || !b.dataset.a) return;
      const maleta = db.get('maletas', b.dataset.m), lista = maleta ? (maleta.lista || []) : [], i = +b.dataset.i;
      if (b.dataset.a === 'agregar') return agregar(b.dataset.m);
      if (b.dataset.a === 'check') actualizarLista(maleta, lista.map((x, k) => k === i ? {...x, ok: !x.ok} : x));
      else if (b.dataset.a === 'quitar') actualizarLista(maleta, lista.filter((_, k) => k !== i));
      else if (b.dataset.a === 'reset') actualizarLista(maleta, lista.map(x => ({...x, ok: false})));
      refrescar();
    };
  });

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
