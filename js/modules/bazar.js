// Modo bazar: pantalla completa para vender en el puesto (celular, tablet o computadora).
//   · Vender: eliges el tema, tocas el tipo (mini pin, estándar, sticker…) y cobras. Con descuento por renglón, combos,
//     cambio rápido y cliente opcional. El ticket va en una columna a la derecha (abajo en celular).
//   · Juegos: anotas lo contado y cuántas personas jugaron (solo los juegos que lleva ese bazar).
//   · Caja: cambio inicial, efectivo esperado, conteo y entradas o salidas, sin salir del Modo bazar.
// El bazar elegido se comparte con la pantalla de Venta.
(() => {
  const {db, ui} = CC;
  const E = ui.esc, $ = ui.money, G = CC.grupos, el = id => document.getElementById(id);
  const mb = {t: {}, d: {}, pago: 'Efectivo', tema: 'todos', vista: 'vender', cliente: '', recibido: ''};
  const abierto = () => { const o = el('mbz'); return !!o && o.classList.contains('open'); };
  const TEMA_COMBOS = '🎁 Combos';

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
  const totalActual = () => Object.keys(mb.t).reduce((s, k) => { const p = productos().find(x => x.k === k); return s + (p ? final(p, mb.t[k]) : 0); }, 0);

  // ---------------------------------------------------------------------------------------------
  // Estructura de la pantalla
  // ---------------------------------------------------------------------------------------------
  function crear() {
    if (el('mbz')) return;
    const o = document.createElement('div');
    o.className = 'vt-over';
    o.id = 'mbz';
    o.innerHTML = `
      <div class="vt-over-top">
        <b style="font:700 1.1rem var(--font-display)">🛍️ Modo bazar</b>
        <select class="inp" id="mbe" style="max-width:240px"></select>
        <div class="vt-temas" id="mbv">
          <button type="button" class="vt-chip" data-v="vender">🛒 Vender</button>
          <button type="button" class="vt-chip" data-v="juegos">🎲 Juegos</button>
          <button type="button" class="vt-chip" data-v="caja">💰 Caja</button>
        </div>
        <span class="espacio"></span>
        <input class="inp" id="mbq" placeholder="🔍 Buscar…" style="max-width:200px">
        <button type="button" class="btn ghost" id="mbh" title="Vendido hoy en este lugar">Hoy: <b id="mbhv">$0</b></button>
        <button class="btn ghost" id="mbs">Salir</button>
      </div>
      <div class="vt-over-main" id="mbmain">
        <section class="vt-over-izq">
          <div class="vt-temas" id="mbp"></div>
          <div class="vt-over-cuerpo" id="mbg"></div>
        </section>
        <aside class="vt-over-ticket">
          <div class="vt-ticket-cab"><h3>Venta actual</h3><button class="btn ghost sm" id="mbl" type="button">Limpiar</button></div>
          <div class="vt-over-lista" id="mbi"></div>
          <div class="vt-over-pie">
            <div class="vt-seg" id="mbpay"><button type="button" data-p="Efectivo">💵 Efectivo</button><button type="button" data-p="Tarjeta">💳 Tarjeta</button><button type="button" data-p="Transferencia">🏦 Transf.</button></div>
            <div class="vt-cambio" id="mbcambio"></div>
            <div class="bar" style="margin:0 0 6px;flex-wrap:nowrap"><select class="inp" id="mbcl" style="flex:1"></select><button class="btn ghost sm" id="mbnc" type="button" title="Cliente nuevo">＋</button></div>
            <div class="vt-total"><span>Total</span><b id="mbt">$0.00</b></div>
            <button class="btn vt-cobrar" id="mbc" type="button">Cobrar</button>
          </div>
        </aside>
      </div>`;
    document.body.appendChild(o);

    el('mbs').onclick = cerrar;
    el('mbq').oninput = pintar;
    el('mbe').onchange = () => { G.guardarBazarActivo(el('mbe').value); pintar(); if (mb.vista !== 'vender') pintarPanel(); };
    el('mbl').onclick = limpiar;
    el('mbc').onclick = cobrar;
    el('mbv').onclick = e => { const b = e.target.closest('[data-v]'); if (b) cambiarVista(b.dataset.v); };
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
      if (mb.vista !== 'vender') return panelClick(e);
      if (e.target.closest('[data-empty-reset]')) { mb.tema = 'todos'; el('mbq').value = ''; pintar(); return; }
      const boton = e.target.closest('button[data-a]');
      if (boton) return agregar(boton.dataset.k, boton.dataset.a === 'mas' ? 1 : -1);
      const t = e.target.closest('.vt-tile');
      if (t) agregar(t.dataset.k, 1);
    };
    el('mbg').oninput = panelInput;
    el('mbg').onchange = panelCambio;
    el('mbi').onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.k) agregar(b.dataset.k, +b.dataset.d);
      else if (b.dataset.x) descuento(b.dataset.x);
    };
    // Cambio rápido: se escribe el monto sin volver a dibujar el campo.
    el('mbcambio').onclick = e => { const b = e.target.closest('[data-r]'); if (b) { mb.recibido = b.dataset.r === 'Exacto' ? String(totalActual()) : b.dataset.r; pintarCambio(); } };
    el('mbcambio').oninput = e => { if (e.target.id === 'mbrec') { mb.recibido = e.target.value; resultadoCambio(); } };
    // Cliente: se actualiza la lista si acabas de crear uno.
    el('mbcl').onfocus = el('mbcl').onpointerdown = llenarClientes;
    el('mbcl').onchange = () => { mb.cliente = el('mbcl').value; };
    el('mbnc').onclick = () => CC.clienteForm();
  }

  function llenarClientes() {
    const sel = el('mbcl'), actual = sel.value || mb.cliente;
    sel.innerHTML = '<option value="">👤 Sin cliente</option>' + db.all('clientes').slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(c => `<option value="${c.id}">${E(c.nombre)}</option>`).join('');
    sel.value = db.get('clientes', actual) ? actual : '';
    mb.cliente = sel.value;
  }

  function limpiar() { mb.t = {}; mb.d = {}; mb.recibido = ''; pintar(); }

  function cambiarVista(v) {
    mb.vista = v;
    pintar();
    if (v !== 'vender') pintarPanel();
  }

  // ---------------------------------------------------------------------------------------------
  // Vender
  // ---------------------------------------------------------------------------------------------
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

  function pintarCambio() {
    const caja = el('mbcambio'), total = totalActual();
    caja.style.display = mb.pago === 'Efectivo' && total > 0 ? '' : 'none';
    if (caja.style.display === 'none') return;
    caja.innerHTML = `
      <div class="mute">¿Con cuánto pagan?</div>
      <div class="vt-rapidos">${['Exacto', 50, 100, 200, 500].map(v => `<button type="button" data-r="${v}">${v === 'Exacto' ? 'Exacto' : '$' + v}</button>`).join('')}</div>
      <input class="inp" id="mbrec" type="number" inputmode="decimal" min="0" placeholder="Otro monto" value="${E(mb.recibido)}" style="min-height:44px">
      <div id="mbres" style="margin-top:6px"></div>`;
    resultadoCambio();
  }
  function resultadoCambio() {
    const r = el('mbres');
    if (!r) return;
    const total = totalActual(), monto = +mb.recibido || 0;
    r.innerHTML = monto ? `Cambio: <span class="resultado ${monto < total ? 'neg' : ''}">${monto < total ? 'faltan ' + $(total - monto) : $(monto - total)}</span>` : '';
  }

  function pintar() {
    if (!abierto()) return;
    const todos = productos();
    // Ajusta el carrito si cambió el stock.
    Object.keys(mb.t).forEach(k => { const p = todos.find(x => x.k === k); if (!p) delete mb.t[k]; else if (mb.t[k] > p.max) mb.t[k] = p.max; });
    Object.keys(mb.d).forEach(k => { if (!mb.t[k]) delete mb.d[k]; });

    // Pestañas y qué se ve en cada una
    const vender = mb.vista === 'vender';
    el('mbv').querySelectorAll('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === mb.vista));
    el('mbmain').classList.toggle('sin-ticket', !vender);
    el('mbp').style.display = el('mbq').style.display = vender ? '' : 'none';

    if (vender) {
      const gr = todos.filter(p => p.g).map(p => p.g), combos = todos.filter(p => p.c);
      const temas = G.temasDe(gr), texto = el('mbq').value;
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
      const sinCoincidencias = Boolean(texto) || mb.tema !== 'todos';
      el('mbg').innerHTML =
        temas.filter(t => visibles.some(g => g.tema === t)).map(t => {
          const delTema = visibles.filter(g => g.tema === t);
          return `<section class="vt-tema"><h3>🗂️ ${E(t)}</h3>${G.seccionesDe(delTema).map(sec => `
            <div class="vt-seccion">${G.icono(sec)} ${E(sec)}</div>
            <div class="vt-grid">${delTema.filter(g => g.seccion === sec).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es')).map(g => tile(todos.find(p => p.k === g.clave))).join('')}</div>`).join('')}</section>`;
        }).join('') +
        (combosVisibles.length ? `<section class="vt-tema"><h3>${TEMA_COMBOS}</h3><div class="vt-grid">${combosVisibles.map(tile).join('')}</div></section>` : '') ||
        `<div class="empty-state">
          <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
          <h4>${sinCoincidencias ? 'No encontramos productos' : 'No hay productos disponibles'}</h4>
          <p>${sinCoincidencias ? 'Prueba con otro término o quita el filtro seleccionado.' : 'Cuando haya productos con existencias aparecerán aquí.'}</p>
          ${sinCoincidencias ? '<button class="btn ghost sm" type="button" data-empty-reset>Ver todo el catálogo</button>' : ''}
        </div>`;
    }

    // Ticket (columna derecha)
    let total = 0;
    el('mbi').innerHTML = Object.keys(mb.t).map(k => {
      const p = todos.find(x => x.k === k), n = mb.t[k], f = final(p, n);
      total += f;
      return `<div class="vt-linea"><span>${E(p.nombre)}${mb.d[k] ? ' <span class="chip" style="--c:var(--amarillo-300)">desc.</span>' : ''}</span>
        <button class="vt-btn" data-k="${E(k)}" data-d="-1">−</button><b class="n">${n}</b><button class="vt-btn mas" data-k="${E(k)}" data-d="1">+</button>
        <span class="imp">${$(f)}</span><button class="vt-btn" data-x="${E(k)}" title="Descuento" style="${mb.d[k] ? 'background:var(--amarillo-soft)' : 'opacity:.6'}">🏷️</button></div>`;
    }).join('') || '<p class="mute">Toca un tipo para agregarlo a la venta.</p>';
    el('mbt').textContent = $(total);
    el('mbc').disabled = !Object.keys(mb.t).length;
    el('mbc').classList.toggle('listo', total > 0);
    el('mbpay').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.p === mb.pago));
    el('mbhv').textContent = $(ventasHoy().reduce((s, v) => s + v.total, 0));
    pintarCambio();
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
    const venta = db.add('ventas', {items, total, pago, eventoId: el('mbe').value, clienteId: mb.cliente || '', fecha: ui.hoy(), comision: pago === 'Tarjeta' ? total * ui.cfg.comision() / 100 : 0});
    items.forEach(i => CC.mover(i.varianteId, -i.cant, 'venta', '', venta.id));
    mb.t = {}; mb.d = {}; mb.recibido = ''; mb.cliente = '';
    llenarClientes();
    pintar();
    ui.deshacer(`Cobrado ${$(total)} (${pago.toLowerCase()})`, copia);
  }

  // ---------------------------------------------------------------------------------------------
  // Juegos y Caja (pestañas del Modo bazar)
  // ---------------------------------------------------------------------------------------------
  function pintarPanel() {
    if (mb.vista === 'juegos') pintarJuegos();
    else if (mb.vista === 'caja') pintarCaja();
  }

  function pintarJuegos() {
    const sel = el('mbe').value, bazar = sel ? db.get('eventos', sel) : null, caja = el('mbg');
    if (!bazar) { caja.innerHTML = '<div class="card"><p class="mute">Elige un bazar arriba para anotar lo que se cuenta en sus juegos.</p></div>'; return; }
    const juegos = CC.juegosDeBazar(sel), hoy = (bazar.ingresos || []).filter(x => x.juegoId && x.fecha === ui.hoy());
    const dinero = hoy.reduce((s, x) => s + x.monto, 0), gente = hoy.reduce((s, x) => s + (+x.personas || 0), 0);
    caja.innerHTML = `
      <div class="kpis">
        <div class="kpi"><small>🎲 Contado hoy en juegos</small><b class="pos-n">${$(dinero)}</b></div>
        <div class="kpi"><small>👥 Personas hoy</small><b>${gente}</b></div>
        <div class="kpi"><small>Promedio por persona</small><b>${gente ? $(dinero / gente) : '—'}</b></div>
      </div>
      <div class="card">
        <h3 style="margin:0 0 2px">Anotar lo contado · ${E(bazar.nombre)}</h3>
        <p class="mute" style="margin:0 0 8px">Se guarda con la fecha de hoy. Deja vacíos los juegos que no usaste. Los juegos que lleva el bazar se eligen en Bazares → Juegos.</p>
        ${juegos.map(j => `
          <div class="line" style="gap:8px;flex-wrap:wrap"><span style="flex:1;min-width:140px">${E(j.icono)} ${E(j.nombre)}${j.nota ? `<div class="mute">${E(j.nota)}</div>` : ''}${+j.precioPorJugada > 0 ? `<div class="mute">Por persona/jugada: ${$(j.precioPorJugada)}</div>` : ''}</span>
            <input class="inp mbj-m" data-j="${j.id}" data-precio="${+j.precioPorJugada || 0}" type="number" min="0" step="0.01" inputmode="decimal" placeholder="$ contado" style="width:120px">
            <input class="inp mbj-p" data-j="${j.id}" type="number" min="0" step="1" inputmode="numeric" placeholder="Personas" style="width:100px"></div>`).join('') || '<p class="mute">Aún no tienes tipos de juego: créalos en Bazares → Juegos.</p>'}
        <button class="btn vt-cobrar" data-a="guardarJuegos" type="button" style="margin-top:10px">Guardar lo contado</button>
      </div>`;
  }

  function guardarJuegos() {
    const sel = el('mbe').value, bazar = db.get('eventos', sel);
    if (!bazar) return;
    const nuevos = [...el('mbg').querySelectorAll('.mbj-m')].filter(i => +i.value > 0).map(i => {
      const j = db.get('juegos', i.dataset.j), personas = Math.floor(+el('mbg').querySelector(`.mbj-p[data-j="${i.dataset.j}"]`).value) || 0;
      return {concepto: j.nombre, monto: +i.value, juegoId: j.id, personas, fecha: ui.hoy()};
    });
    if (!nuevos.length) return ui.toast('Escribe al menos un monto');
    const copia = JSON.stringify(db.crudo());
    db.update('eventos', sel, {ingresos: [...(bazar.ingresos || []), ...nuevos]});
    pintarJuegos();
    ui.deshacer(`Guardado: ${$(nuevos.reduce((s, x) => s + x.monto, 0))} en ${nuevos.length} juego(s).`, copia);
  }

  function pintarCaja() {
    const sel = el('mbe').value, d = CC.datosCaja(sel), bloqueada = d.cerrada, off = bloqueada ? 'disabled' : '';
    const kpi = (t, v) => `<div class="kpi"><small>${t}</small><b>${v}</b></div>`;
    el('mbg').innerHTML = `
      <div class="kpis">
        ${kpi('Total vendido', $(d.total))}${kpi('💵 Efectivo', $(d.efectivo))}${kpi('💳 Tarjeta', $(d.tarjeta))}${kpi('🏦 Transferencia', $(d.transf))}${sel ? kpi('🎲 Juegos', $(d.juegos)) : ''}
      </div>
      <div class="card">
        <h3 style="margin:0 0 6px">Cuadre de caja ${bloqueada ? '🔒' : ''}</h3>
        <div class="grid2">
          <label>Cambio inicial<input class="inp" id="mbfondo" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" value="${d.cambio || ''}" ${off}></label>
          <label>Efectivo contado al cierre<input class="inp" id="mbcont" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" value="${d.contado === null ? '' : d.contado}" ${off}></label>
        </div>
        <div class="line"><span>+ Ventas en efectivo</span><b>${$(d.efectivo)}</b></div>
        ${sel ? `<div class="line"><span>+ Juegos e ingresos extra</span><b>${$(d.juegos)}</b></div>` : ''}
        <div class="line"><span>+ Entradas de efectivo</span><b>${$(d.entradas)}</b></div>
        <div class="line"><span>− Salidas de efectivo</span><b>${$(d.salidas)}</b></div>
        <div class="line"><b>Debería haber en caja</b><b id="mbesp" style="font-size:1.15rem">${$(d.esperado)}</b></div>
        <p id="mbdif" style="margin:8px 0 0"></p>
        <div class="bar" style="margin:10px 0 0">
          ${bloqueada ? '' : '<button class="btn sm" data-a="entrada" type="button">⬆️ Entrada</button><button class="btn ghost sm" data-a="salida" type="button">⬇️ Salida</button>'}
          <button class="btn ghost sm" data-a="cajaCompleta" type="button">Abrir caja completa →</button>
        </div>
      </div>`;
    resultadoCaja();
  }

  // Diferencia en vivo mientras se escribe.
  function resultadoCaja() {
    const sel = el('mbe').value, d = CC.datosCaja(sel), fondo = el('mbfondo'), cont = el('mbcont');
    if (!fondo) return;
    const esperado = (+fondo.value || 0) + d.efectivo + d.juegos + d.entradas - d.salidas;
    el('mbesp').textContent = $(esperado);
    const msg = el('mbdif');
    if (cont.value === '') { msg.className = 'mute'; msg.textContent = 'Cuenta tu efectivo al cierre para ver si cuadra la caja.'; return; }
    const dif = +cont.value - esperado;
    msg.className = Math.abs(dif) < 0.01 ? 'pos-n' : dif > 0 ? 'warn' : 'neg';
    msg.textContent = Math.abs(dif) < 0.01 ? '✅ La caja cuadra exacto.' : dif > 0 ? `Sobran ${$(dif)} respecto a lo esperado.` : `⚠️ Faltan ${$(-dif)} respecto a lo esperado.`;
  }

  function panelInput(e) {
    if (e.target.classList.contains('mbj-m')) {
      const precio = +e.target.dataset.precio || 0;
      if (precio > 0) el('mbg').querySelector(`.mbj-p[data-j="${e.target.dataset.j}"]`).value = Math.floor((+e.target.value || 0) / precio);
    } else if (e.target.id === 'mbfondo' || e.target.id === 'mbcont') resultadoCaja();
  }
  function panelCambio(e) {
    const sel = el('mbe').value;
    if (e.target.id === 'mbfondo') CC.cajaGuardar(sel, {fondoCaja: +e.target.value || 0, cambioDesglose: {}});
    else if (e.target.id === 'mbcont') CC.cajaGuardar(sel, {efectivoContado: e.target.value === '' ? null : +e.target.value, conteoDesglose: {}});
    else return;
    pintarCaja();
  }
  function panelClick(e) {
    const b = e.target.closest('button[data-a]');
    if (!b) return;
    const sel = el('mbe').value, a = b.dataset.a;
    if (a === 'guardarJuegos') guardarJuegos();
    else if (a === 'entrada' || a === 'salida') CC.cajaMovimiento(sel, a, pintarCaja);
    else if (a === 'cajaCompleta') { CC.cajaSel = sel; cerrar(); location.hash = 'caja'; }
  }

  // ---------------------------------------------------------------------------------------------
  // Abrir y cerrar
  // ---------------------------------------------------------------------------------------------
  function abrir() {
    crear();
    mb.t = {}; mb.d = {}; mb.pago = 'Efectivo'; mb.tema = 'todos'; mb.vista = 'vender'; mb.cliente = ''; mb.recibido = '';
    el('mbq').value = '';
    el('mbe').innerHTML = '<option value="">Sin bazar (caja general)</option>' + db.all('eventos').map(e => `<option value="${e.id}">🎪 ${E(e.nombre)}</option>`).join('');
    el('mbe').value = G.bazarActivo();
    llenarClientes();
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
