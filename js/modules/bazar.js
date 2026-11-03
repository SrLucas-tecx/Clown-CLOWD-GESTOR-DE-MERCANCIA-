// Modo bazar: pantalla completa para vender en el puesto (celular, tablet o computadora).
// Vendes POR TEMAS: eliges el tema, tocas el tipo (mini pin, estándar, sticker…) y cobras. Incluye descuento
// por renglón y combos. El bazar elegido se comparte con la pantalla de Venta.
(() => {
  const {db, ui} = CC;
  const E = ui.esc, $ = ui.money, G = CC.grupos, el = id => document.getElementById(id);
  const mb = {t: {}, d: {}, pago: 'Efectivo', tema: 'todos'};
  const abierto = () => { const o = el('mbz'); return !!o && o.classList.contains('open'); };

  // Todo lo que se puede vender ahora: grupos (tema + tipo) con stock, y combos que se pueden armar.
  const productos = () => [
    ...G.construir().filter(g => g.stock > 0).map(g => ({k: g.clave, g, nombre: `${g.tema} · ${g.etiqueta}`, max: g.stock})),
    ...db.all('combos').filter(c => CC.comboMax(c) > 0).map(c => ({k: 'c:' + c.id, c, nombre: '🎁 ' + c.nombre, max: CC.comboMax(c)}))
  ];
  const subtotal = (p, n) => p.g ? G.total(p.g, n) : p.c.precio * n;
  // Total del renglón con su descuento (en % o en $).
  const final = (p, n) => {
    const s = subtotal(p, n), d = mb.d[p.k];
    return !d || !(d.valor > 0) ? s : Math.max(0, d.tipo === 'pct' ? s * (1 - Math.min(100, d.valor) / 100) : s - d.valor);
  };
  const ventasHoy = () => CC.ventasOk().filter(v => v.fecha === ui.hoy() && (v.eventoId || '') === el('mbe').value);

  function crear() {
    if (el('mbz')) return;
    const o = document.createElement('div');
    o.className = 'vt-over';
    o.id = 'mbz';
    o.innerHTML = `
      <div class="vt-over-top">
        <b style="font:700 1.1rem var(--font-display)">🛍️ Modo bazar</b>
        <select class="inp" id="mbe"></select>
        <button type="button" class="btn ghost" id="mbh" title="Vendido hoy en este lugar">Vendido hoy: <b id="mbhv">$0</b></button>
        <span class="espacio"></span>
        <input class="inp" id="mbq" placeholder="🔍 Buscar…" style="max-width:220px">
        <button class="btn ghost" id="mbs">Salir</button>
      </div>
      <div class="vt-temas" id="mbp" style="padding:6px 12px 0"></div>
      <div class="vt-over-cuerpo" id="mbg"></div>
      <div class="vt-over-ticket">
        <div class="vt-over-items" id="mbi"></div>
        <div class="vt-over-pago">
          <div class="vt-seg" id="mbpay"><button type="button" data-p="Efectivo">💵 Efectivo</button><button type="button" data-p="Tarjeta">💳 Tarjeta</button><button type="button" data-p="Transferencia">🏦 Transf.</button></div>
          <div class="vt-total"><span>Total</span><b id="mbt">$0.00</b></div>
          <button class="btn ghost" id="mbl">Limpiar</button>
          <button class="btn vt-cobrar" id="mbc" style="width:auto;padding:0 32px;margin:0">Cobrar</button>
        </div>
      </div>`;
    document.body.appendChild(o);

    el('mbs').onclick = cerrar;
    el('mbq').oninput = pintar;
    el('mbe').onchange = () => { G.guardarBazarActivo(el('mbe').value); pintar(); };
    el('mbl').onclick = () => { mb.t = {}; mb.d = {}; pintar(); };
    el('mbc').onclick = cobrar;
    el('mbh').onclick = () => {
      const vs = ventasHoy();
      ui.detalle({icon: '🧾', title: 'Vendido hoy', sub: 'En el lugar elegido', secciones: [{f: [
        ['Ventas', vs.length], ['Total', $(vs.reduce((s, v) => s + v.total, 0)), 'good'],
        ['Efectivo', $(vs.filter(v => v.pago === 'Efectivo').reduce((s, v) => s + v.total, 0))],
        ['Tarjeta', $(vs.filter(v => v.pago === 'Tarjeta').reduce((s, v) => s + v.total, 0))],
        ['Transferencia', $(vs.filter(v => v.pago === 'Transferencia').reduce((s, v) => s + v.total, 0))]
      ]}]});
    };
    el('mbpay').onclick = e => { const b = e.target.closest('[data-p]'); if (b) { mb.pago = b.dataset.p; pintar(); } };
    el('mbp').onclick = e => { const b = e.target.closest('[data-tema]'); if (b) { mb.tema = b.dataset.tema; pintar(); } };
    el('mbg').onclick = e => {
      const boton = e.target.closest('button[data-a]');
      if (boton) return agregar(boton.dataset.k, boton.dataset.a === 'mas' ? 1 : -1);
      const t = e.target.closest('.vt-tile');
      if (t) agregar(t.dataset.k, 1);
    };
    el('mbi').onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.k) agregar(b.dataset.k, +b.dataset.d);
      else if (b.dataset.x) descuento(b.dataset.x);
    };
  }

  function agregar(k, delta) {
    const p = productos().find(x => x.k === k);
    if (!p) return;
    const actual = mb.t[k] || 0;
    if (delta > 0 && p.g && !p.g.precio) return ui.toast(`"${p.nombre}" no tiene precio: defínelo en Catálogo`);
    if (delta > 0 && actual + delta > p.max) return ui.toast(`No hay más "${p.nombre}": quedan ${p.max}`);
    const n = Math.max(0, actual + delta);
    if (n) mb.t[k] = n; else delete mb.t[k];
    pintar();
  }

  // Descuento de un renglón: en % o en $ (vacío = quitar).
  function descuento(k) {
    const p = productos().find(x => x.k === k), d = mb.d[k] || {tipo: 'pct', valor: ''};
    if (!p) return;
    ui.modal('Descuento · ' + E(p.nombre), `
      <label>Tipo<select class="inp" name="tipo"><option value="pct" ${d.tipo === 'pct' ? 'selected' : ''}>% del renglón</option><option value="monto" ${d.tipo === 'monto' ? 'selected' : ''}>$ de descuento al renglón</option></select></label>
      ${ui.inp('valor', 'Descuento (vacío = quitar)', d.valor, 'number', 'step="any"')}`, m => {
      const o = ui.vals(m), valor = +o.valor || 0, s = subtotal(p, mb.t[k]);
      if (valor < 0 || (o.tipo === 'pct' && valor > 100) || (o.tipo === 'monto' && valor > s)) {
        ui.toast(o.tipo === 'pct' ? 'No se puede: el porcentaje debe estar entre 0 y 100' : `No se puede: el descuento no puede ser mayor al renglón (${$(s)})`);
        return false;
      }
      if (valor > 0) mb.d[k] = {tipo: o.tipo, valor}; else delete mb.d[k];
      pintar();
    });
  }

  function pintar() {
    if (!abierto()) return;
    const todos = productos();
    // Ajusta el carrito si cambió el stock.
    Object.keys(mb.t).forEach(k => { const p = todos.find(x => x.k === k); if (!p) delete mb.t[k]; else if (mb.t[k] > p.max) mb.t[k] = p.max; });
    Object.keys(mb.d).forEach(k => { if (!mb.t[k]) delete mb.d[k]; });

    const gr = todos.filter(p => p.g).map(p => p.g), combos = todos.filter(p => p.c);
    const temas = G.temasDe(gr), TEMA_COMBOS = '🎁 Combos', texto = el('mbq').value;
    const chips = ['todos', ...temas, ...(combos.length ? [TEMA_COMBOS] : [])];
    if (!chips.includes(mb.tema)) mb.tema = 'todos';
    el('mbp').innerHTML = chips.map(t => `<button class="vt-chip ${mb.tema === t ? 'on' : ''}" data-tema="${E(t)}">${t === 'todos' ? '🗂️ Todos' : E(t)}</button>`).join('');

    const tile = p => {
      const n = mb.t[p.k] || 0, g = p.g;
      return `
        <div class="vt-tile ${n ? 'on' : ''}" data-k="${E(p.k)}">
          <div class="vt-tile-nombre">${E(g ? g.etiqueta : p.nombre)}</div>
          <div class="vt-tile-info"><b>${$(g ? g.precio : p.c.precio)}</b> · quedan ${p.max}</div>
          ${g && g.rep.escCant > 1 && g.rep.escTotal ? `<div class="vt-tile-info">${g.rep.escCant} por ${$(g.rep.escTotal)}</div>` : ''}
          <div class="vt-ctr">
            <button class="vt-btn" data-a="menos" data-k="${E(p.k)}" ${n ? '' : 'disabled'} aria-label="Quitar uno">−</button><b>${n}</b>
            <button class="vt-btn mas" data-a="mas" data-k="${E(p.k)}" aria-label="Agregar uno">+</button>
          </div>
        </div>`;
    };

    const visibles = gr.filter(g => (mb.tema === 'todos' || g.tema === mb.tema) && G.buscar(g, texto));
    const combosVisibles = combos.filter(p => (mb.tema === 'todos' || mb.tema === TEMA_COMBOS) && (!texto || p.nombre.toLowerCase().includes(texto.toLowerCase())));
    el('mbg').innerHTML =
      temas.filter(t => visibles.some(g => g.tema === t)).map(t => {
        const delTema = visibles.filter(g => g.tema === t);
        return `<section class="vt-tema"><h3>🗂️ ${E(t)}</h3>${G.seccionesDe(delTema).map(sec => `
          <div class="vt-seccion">${G.icono(sec)} ${E(sec)}</div>
          <div class="vt-grid">${delTema.filter(g => g.seccion === sec).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es')).map(g => tile(todos.find(p => p.k === g.clave))).join('')}</div>`).join('')}</section>`;
      }).join('') +
      (combosVisibles.length ? `<section class="vt-tema"><h3>${TEMA_COMBOS}</h3><div class="vt-grid">${combosVisibles.map(tile).join('')}</div></section>` : '') ||
      '<p class="mute">Nada con stock coincide.</p>';

    let total = 0;
    el('mbi').innerHTML = Object.keys(mb.t).map(k => {
      const p = todos.find(x => x.k === k), n = mb.t[k], f = final(p, n);
      total += f;
      return `<span class="vt-over-item"><button class="vt-btn" data-k="${E(k)}" data-d="-1">−</button><span class="t">${n} × ${E(p.nombre)} · ${$(f)}</span><button class="vt-btn mas" data-k="${E(k)}" data-d="1">+</button><button class="vt-btn" data-x="${E(k)}" title="Descuento" style="${mb.d[k] ? 'background:var(--amarillo-soft)' : 'opacity:.6'}">🏷️</button></span>`;
    }).join('') || '<span class="mute">Toca un tipo para agregarlo</span>';
    el('mbt').textContent = $(total);
    el('mbc').disabled = !Object.keys(mb.t).length;
    el('mbpay').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.p === mb.pago));
    el('mbhv').textContent = $(ventasHoy().reduce((s, v) => s + v.total, 0));
  }

  function cobrar() {
    const claves = Object.keys(mb.t);
    if (!claves.length) return;
    const todos = productos(), items = [];
    for (const k of claves) {
      const p = todos.find(x => x.k === k), n = mb.t[k];
      if (!p || n > p.max) return ui.toast('Cambió el stock: revisa la venta');
      const f = final(p, n);
      if (p.g) {
        const unitario = f / n;
        G.repartir(p.g, n).forEach(({v, cant}) => items.push({varianteId: v.id, nombre: p.nombre, cant, precio: unitario, precioLista: v.precio || 0, costo: v.costo || 0}));
      } else {
        // Combo: el precio se reparte entre sus piezas en proporción a su precio de lista.
        const suma = CC.comboSuma(p.c) || 1;
        p.c.items.forEach(i => {
          const v = db.get('variantes', i.varianteId), cant = i.cant * n;
          items.push({varianteId: v.id, nombre: `${CC.nombreVar(v)} (${p.c.nombre})`, cant, precio: f * ((v.precio || 0) * i.cant / suma) / cant, precioLista: v.precio || 0, costo: v.costo || 0});
        });
      }
    }
    // Revisa que, juntando todo, alcance el inventario de cada pieza.
    const demanda = {};
    items.forEach(i => { demanda[i.varianteId] = (demanda[i.varianteId] || 0) + i.cant; });
    const mal = Object.keys(demanda).find(id => demanda[id] > CC.stock(id));
    if (mal) return ui.toast(`No se puede cobrar: no hay suficiente "${CC.nombreVar(db.get('variantes', mal))}" (quedan ${Math.max(0, CC.stock(mal))})`);

    const total = items.reduce((s, i) => s + i.precio * i.cant, 0), copia = JSON.stringify(db.crudo()), pago = mb.pago;
    const venta = db.add('ventas', {items, total, pago, eventoId: el('mbe').value, clienteId: '', fecha: ui.hoy(), comision: pago === 'Tarjeta' ? total * ui.cfg.comision() / 100 : 0});
    items.forEach(i => CC.mover(i.varianteId, -i.cant, 'venta', '', venta.id));
    mb.t = {};
    mb.d = {};
    pintar();
    ui.deshacer(`Cobrado ${$(total)} (${pago.toLowerCase()})`, copia);
  }

  function abrir() {
    crear();
    mb.t = {}; mb.d = {}; mb.pago = 'Efectivo'; mb.tema = 'todos';
    el('mbq').value = '';
    el('mbe').innerHTML = '<option value="">Sin bazar (caja general)</option>' + db.all('eventos').map(e => `<option value="${e.id}">🎪 ${E(e.nombre)}</option>`).join('');
    el('mbe').value = G.bazarActivo();
    el('mbz').classList.add('open');
    document.body.classList.add('mb-activo');
    pintar();
  }

  function cerrar() {
    const o = el('mbz');
    if (o) o.classList.remove('open');
    document.body.classList.remove('mb-activo');
  }

  CC.bazar = {abrir, cerrar};
})();
