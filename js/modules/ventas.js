// Venta rápida por TEMAS, pensada para celular, tablet y computadora:
//  · escritorio: catálogo a la izquierda y ticket fijo a la derecha;
//  · tablet y celular: catálogo a todo el ancho y el ticket sube desde abajo con una barra «Ver venta».
// Vendes por cantidades (tema → Pin/Sticker → tipo); al cobrar, las piezas se descuentan solas de los diseños.
// El precio y el costo se congelan en cada venta; anular regresa el stock. El historial vive en historial.js.
(() => {
  const {db, ui} = CC;
  const E = ui.esc, $ = ui.money, G = CC.grupos;

  // Estado de la pantalla (se conserva al cambiar de pestaña)
  let carrito = {};      // clave del grupo → cantidad
  let temaSel = 'todos'; // 'todos' o nombre de un tema
  let busqueda = '';
  let pago = 'Efectivo';
  let recibido = '';     // efectivo recibido (solo para calcular el cambio; no se guarda)
  let ticketAbierto = false;

  CC.ventasOk = () => db.all('ventas').filter(v => !v.anulada);
  // Ganancia de un conjunto de ventas: piezas (precio − costo) más ajustes (extras o descuentos de pedidos).
  CC.utilidad = vs => vs.reduce((s, v) => s + v.items.reduce((a, i) => a + (i.precio - i.costo) * i.cant, 0) + (v.ajuste || 0), 0);

  // Anula una venta (con confirmación y «Deshacer»): las piezas regresan al inventario.
  CC.anularVenta = (id, despues) => {
    const venta = db.get('ventas', id);
    if (!venta || venta.anulada) return;
    ui.confirm('Las piezas de esta venta regresarán al inventario y dejará de contar en los totales.', 'Anular venta').then(ok => {
      if (!ok) return;
      const copia = JSON.stringify(db.crudo());
      db.update('ventas', venta.id, {anulada: true});
      venta.items.forEach(i => CC.mover(i.varianteId, i.cant, 'anulación', 'Venta anulada', venta.id));
      if (despues) despues(); else CC.router.show();
      ui.deshacer('Venta anulada.', copia);
    });
  };

  // Registra una venta por tema (lo usan Venta y, con otro armado, Modo bazar). Devuelve la venta o null.
  const cobrarCarrito = (grupos, ventaBase) => {
    const claves = Object.keys(carrito).filter(k => carrito[k] > 0), items = [];
    for (const k of claves) {
      const g = grupos.find(x => x.clave === k), n = carrito[k];
      if (!g || n > g.stock) { ui.toast(`No se puede cobrar: "${g ? g.tema + ' · ' + g.etiqueta : 'un producto'}" ya no tiene stock suficiente`); return null; }
      const unitario = G.total(g, n) / n;
      G.repartir(g, n).forEach(({v, cant}) => items.push({varianteId: v.id, nombre: `${g.tema} · ${g.etiqueta}`, cant, precio: unitario, costo: v.costo || 0}));
    }
    const total = items.reduce((s, i) => s + i.precio * i.cant, 0);
    const venta = db.add('ventas', {...ventaBase, items, total, fecha: ui.hoy()});
    if (ventaBase.pago === 'Tarjeta') db.update('ventas', venta.id, {comision: total * ui.cfg.comision() / 100});
    items.forEach(i => CC.mover(i.varianteId, -i.cant, 'venta', '', venta.id));
    return venta;
  };

  // ---------------------------------------------------------------------------------------------
  // Pantalla
  // ---------------------------------------------------------------------------------------------
  CC.router.register('ventas', 'Venta', '🛒', el => {
    const grupos = G.construir(), temas = G.temasDe(grupos), eventos = db.all('eventos');
    if (temaSel !== 'todos' && !temas.includes(temaSel)) temaSel = 'todos';
    Object.keys(carrito).forEach(k => { const g = grupos.find(x => x.clave === k); if (!g || g.stock <= 0) delete carrito[k]; else carrito[k] = Math.min(carrito[k], g.stock); });

    el.innerHTML = `
      <div class="vt">
        <div class="vt-main">
          <div class="vt-cab">
            <input class="inp" id="q" placeholder="🔍 Buscar tema, tipo o diseño…" value="${E(busqueda)}" style="min-height:48px">
            <div class="vt-temas" id="temas"></div>
          </div>
          <div id="catalogo"></div>
          <div class="bar"><button class="btn ghost" id="hv" type="button">📜 Ver historial de ventas</button></div>
        </div>

        <aside class="vt-ticket ${ticketAbierto ? 'abierto' : ''}" id="ticket">
          <div class="vt-ticket-cab"><h3>Venta actual</h3>
            <button class="btn ghost sm" id="vaciar" type="button">Vaciar</button>
            <button class="btn ghost sm vt-cerrar" id="cerrar" type="button" aria-label="Cerrar">✕</button></div>
          <div id="cart"></div>
          <div class="vt-total"><span>Total</span><b id="tot"></b></div>
          <div class="vt-seg" id="pago">
            <button type="button" data-p="Efectivo">💵 Efectivo</button><button type="button" data-p="Tarjeta">💳 Tarjeta</button><button type="button" data-p="Transferencia">🏦 Transf.</button>
          </div>
          <div class="vt-cambio" id="cambio"></div>
          <label>Bazar / evento<select class="inp" id="ev"><option value="">Sin evento</option>${eventos.map(e => `<option value="${e.id}">🎪 ${E(e.nombre)}</option>`).join('')}</select></label>
          <details class="vt-extra"><summary>Cliente (opcional)</summary>
            <select class="inp" id="cl"><option value="">Sin cliente</option>${db.all('clientes').map(c => `<option value="${c.id}">${E(c.nombre)}</option>`).join('')}</select>
            <button class="btn ghost sm" id="nc" type="button" style="margin-top:6px">＋ Cliente nuevo</button>
          </details>
          <button class="btn vt-cobrar" id="ok">Cobrar</button>
        </aside>

        <button class="vt-barra" id="barra" type="button"><span>🛒</span><span id="barra-n"></span><span class="grande" id="barra-t"></span><span>Ver venta ›</span></button>
        <div class="vt-fondo ${ticketAbierto ? 'abierto' : ''}" id="fondo"></div>
      </div>`;
    const q = s => el.querySelector(s);
    q('#ev').value = G.bazarActivo();

    // Recuadro de un tipo: toca para sumar 1, o usa − y + (botones grandes).
    const tile = g => {
      const n = carrito[g.clave] || 0, agotado = g.stock <= 0;
      return `
        <div class="vt-tile ${n ? 'on' : ''} ${agotado ? 'agotado' : ''}" data-k="${E(g.clave)}">
          <div class="vt-tile-nombre">${E(g.etiqueta)}</div>
          <div class="vt-tile-info"><b>${g.precio ? $(g.precio) : '<span class="warn">Sin precio</span>'}</b> · ${agotado ? 'agotado' : 'quedan ' + g.stock}</div>
          ${g.rep.escCant > 1 && g.rep.escTotal ? `<div class="vt-tile-info">${g.rep.escCant} por ${$(g.rep.escTotal)}</div>` : ''}
          <div class="vt-ctr">
            <button class="vt-btn" data-a="menos" data-k="${E(g.clave)}" ${n ? '' : 'disabled'} aria-label="Quitar uno">−</button>
            <b>${n}</b>
            <button class="vt-btn mas" data-a="mas" data-k="${E(g.clave)}" ${agotado ? 'disabled' : ''} aria-label="Agregar uno">+</button>
          </div>
        </div>`;
    };

    const pintarTemas = () => {
      const cuenta = t => grupos.filter(g => g.tema === t).reduce((s, g) => s + g.stock, 0);
      q('#temas').innerHTML = [['todos', '🗂️ Todos', grupos.reduce((s, g) => s + g.stock, 0)], ...temas.map(t => [t, E(t), cuenta(t)])]
        .map(([valor, texto, n]) => `<button class="vt-chip ${temaSel === valor ? 'on' : ''}" data-tema="${E(valor)}">${texto} <small>${n}</small></button>`).join('');
    };

    const pintarCatalogo = () => {
      const visibles = grupos.filter(g => (temaSel === 'todos' || g.tema === temaSel) && G.buscar(g, busqueda));
      q('#catalogo').innerHTML = temas.filter(t => visibles.some(g => g.tema === t)).map(t => {
        const delTema = visibles.filter(g => g.tema === t);
        return `
          <section class="vt-tema">
            <h3>🗂️ ${E(t)} <small class="mute">${delTema.reduce((s, g) => s + g.stock, 0)} pzs</small></h3>
            ${G.seccionesDe(delTema).map(sec => `
              <div class="vt-seccion">${G.icono(sec)} ${E(sec)}</div>
              <div class="vt-grid">${delTema.filter(g => g.seccion === sec).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es')).map(tile).join('')}</div>`).join('')}
          </section>`;
      }).join('') || '<p class="mute">No hay productos que coincidan. Agrega piezas en Inventario → Agregar varios.</p>';
    };

    const totalActual = () => Object.keys(carrito).reduce((s, k) => { const g = grupos.find(x => x.clave === k); return s + (g ? G.total(g, carrito[k]) : 0); }, 0);

    const pintarCambio = () => {
      const total = totalActual(), caja = q('#cambio');
      caja.style.display = pago === 'Efectivo' && total > 0 ? '' : 'none';
      if (caja.style.display === 'none') return;
      const monto = +recibido || 0;
      caja.innerHTML = `
        <div class="mute">¿Con cuánto pagan?</div>
        <div class="vt-rapidos">${['Exacto', 50, 100, 200, 500].map(v => `<button type="button" data-r="${v}">${v === 'Exacto' ? 'Exacto' : '$' + v}</button>`).join('')}</div>
        <input class="inp" id="recibe" type="number" inputmode="decimal" min="0" placeholder="Otro monto" value="${recibido}" style="min-height:46px">
        ${monto ? `<div style="margin-top:6px">Cambio: <span class="resultado ${monto < total ? 'neg' : ''}">${monto < total ? 'faltan ' + $(total - monto) : $(monto - total)}</span></div>` : ''}`;
    };

    const pintarCarrito = () => {
      const claves = Object.keys(carrito).filter(k => carrito[k] > 0);
      q('#cart').innerHTML = claves.map(k => {
        const g = grupos.find(x => x.clave === k), n = carrito[k];
        return `<div class="vt-linea"><span>${g.icono} ${E(g.tema)} · ${E(g.etiqueta)}</span>
          <button class="vt-btn" data-a="menos" data-k="${E(k)}">−</button><b class="n">${n}</b><button class="vt-btn mas" data-a="mas" data-k="${E(k)}">+</button><span class="imp">${$(G.total(g, n))}</span></div>`;
      }).join('') || '<p class="mute">Toca un tipo para agregarlo a la venta.</p>';
      const total = totalActual(), piezas = claves.reduce((s, k) => s + carrito[k], 0);
      q('#tot').textContent = $(total);
      q('#barra-n').textContent = piezas ? `${piezas} pieza${piezas === 1 ? '' : 's'}` : 'Venta vacía';
      q('#barra-t').textContent = piezas ? $(total) : '';
      q('#pago').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.p === pago));
      pintarCambio();
    };

    const pintarTodo = () => { pintarTemas(); pintarCatalogo(); pintarCarrito(); };
    pintarTodo();

    // Suma o resta piezas de un grupo (sin pasarse del stock).
    const cambiar = (clave, delta) => {
      const g = grupos.find(x => x.clave === clave);
      if (!g) return;
      const nuevo = (carrito[clave] || 0) + delta;
      if (delta > 0 && !g.precio) return ui.toast(`"${g.tema} · ${g.etiqueta}" no tiene precio: defínelo en Catálogo o Tipos de producto`);
      if (delta > 0 && nuevo > g.stock) return ui.toast(`No hay más "${g.tema} · ${g.etiqueta}": quedan ${g.stock}`);
      if (nuevo <= 0) delete carrito[clave]; else carrito[clave] = nuevo;
      pintarCatalogo();
      pintarCarrito();
    };

    const mostrarTicket = abrir => {
      ticketAbierto = abrir;
      q('#ticket').classList.toggle('abierto', abrir);
      q('#fondo').classList.toggle('abierto', abrir);
    };

    q('#q').oninput = e => { busqueda = e.target.value; pintarCatalogo(); };
    q('#ev').onchange = e => G.guardarBazarActivo(e.target.value);
    q('#hv').onclick = () => { location.hash = 'historial'; };
    q('#nc').onclick = () => CC.clienteForm();
    q('#barra').onclick = () => mostrarTicket(true);
    q('#fondo').onclick = q('#cerrar').onclick = () => mostrarTicket(false);
    q('#vaciar').onclick = () => { carrito = {}; recibido = ''; pintarCatalogo(); pintarCarrito(); };
    q('#cambio').oninput = e => { if (e.target.id === 'recibe') { recibido = e.target.value; pintarCambioSoloResultado(); } };
    // Mientras escribes el monto no se vuelve a dibujar el campo (para no perder el cursor).
    const pintarCambioSoloResultado = () => {
      const total = totalActual(), monto = +recibido || 0, caja = q('#cambio');
      let r = caja.querySelector('.cambio-res');
      if (!r) { r = document.createElement('div'); r.className = 'cambio-res'; r.style.marginTop = '6px'; caja.appendChild(r); }
      r.innerHTML = monto ? `Cambio: <span class="resultado ${monto < total ? 'neg' : ''}">${monto < total ? 'faltan ' + $(total - monto) : $(monto - total)}</span>` : '';
    };

    el.onclick = e => {
      const tema = e.target.closest('[data-tema]');
      if (tema) { temaSel = tema.dataset.tema; return pintarTodo(); }
      const rapido = e.target.closest('[data-r]');
      if (rapido) { recibido = rapido.dataset.r === 'Exacto' ? String(totalActual()) : rapido.dataset.r; return pintarCambio(); }
      const metodo = e.target.closest('#pago [data-p]');
      if (metodo) { pago = metodo.dataset.p; return pintarCarrito(); }
      const boton = e.target.closest('button[data-a]');
      if (boton) return cambiar(boton.dataset.k, boton.dataset.a === 'mas' ? 1 : -1);
      const recuadro = e.target.closest('.vt-tile');
      if (recuadro) cambiar(recuadro.dataset.k, 1);
    };

    q('#ok').onclick = () => {
      if (!Object.keys(carrito).length) return ui.toast('La venta está vacía');
      const copia = JSON.stringify(db.crudo());
      const venta = cobrarCarrito(grupos, {pago, eventoId: q('#ev').value, clienteId: q('#cl').value});
      if (!venta) return;
      carrito = {};
      recibido = '';
      ticketAbierto = false;
      CC.router.show();
      ui.deshacer(`Cobrado ${$(venta.total)} (${pago.toLowerCase()})`, copia);
    };
  });
})();
