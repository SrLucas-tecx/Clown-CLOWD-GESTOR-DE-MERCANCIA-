// Pedidos: lista en tarjetas (contorno por estado de producción) y cotizador en 4 fases
// (Cliente · Productos · Extras y pago · Resumen), con estados, semáforo y PDF con logo.
(() => {
  const {db, ui} = CC, E = ui.esc, $ = ui.money, ESTADOS = [
      'Por hacer',
      'En producción',
      'Listo',
      'Entregado'
    ];
  let fe = 'Todos';
  const dias = f => Math.round((new Date(f + 'T00:00:00') - new Date(ui.hoy() + 'T00:00:00')) / 86400000);
  const r2 = x => Math.round(x * 100) / 100;

  // Total de un pedido = piezas + recargo por urgente − descuento + servicios extra.
  const desglose = p => {
    const subtotal = p.items.reduce((s, i) => s + i.precio * i.cant, 0);
    const recargo = p.urgente ? subtotal * (p.recargoPct || 0) / 100 : 0;
    const descuento = (subtotal + recargo) * (p.descuentoPct || 0) / 100;
    const extras = (p.extras || []).reduce((s, x) => s + x.monto, 0);
    return {subtotal, recargo: r2(recargo), descuento: r2(descuento), extras: r2(extras), total: r2(subtotal + recargo - descuento + extras)};
  };
  const total = p => desglose(p).total;
  CC.pedidoDesglose = desglose;

  // Piezas que faltan en inventario para surtir el pedido (por diseño, o por tema y tipo).
  const falta = p => {
    const grupos = CC.grupos.construir(), pedidoPorGrupo = {}, faltan = [];
    p.items.forEach(i => {
      if (i.grupoClave) { pedidoPorGrupo[i.grupoClave] = (pedidoPorGrupo[i.grupoClave] || {n: 0, nombre: i.nombre}); pedidoPorGrupo[i.grupoClave].n += i.cant; }
      else if (CC.stock(i.varianteId) < i.cant) faltan.push(`${i.nombre} (hay ${Math.max(0, CC.stock(i.varianteId))}, piden ${i.cant})`);
    });
    Object.entries(pedidoPorGrupo).forEach(([clave, x]) => {
      const g = grupos.find(y => y.clave === clave), hay = g ? g.stock : 0;
      if (hay < x.n) faltan.push(`${x.nombre} (hay ${hay}, piden ${x.n})`);
    });
    return faltan;
  };
  CC.pedidoTotal = total;
  CC.semaforoPedido = p => {
    if (p.estado === 'Entregado')
      return [
        '🟢',
        'Entregado'
      ];
    const d = dias(p.entrega);
    return d < 0 ? [
      '🔴',
      `vencido hace ${-d} día(s)`
    ] : d === 0 ? [
      '🔴',
      'entrega hoy'
    ] : d <= 2 ? [
      '🟡',
      `entrega en ${d} día(s)`
    ] : [
      '🟢',
      `entrega en ${d} días`
    ];
  };
  // ---------------------------------------------------------------------------------------------
  // Piezas de un pedido por tema: se reparten entre los diseños al momento de entregar
  // ---------------------------------------------------------------------------------------------
  const expandirItems = p => {
    const grupos = CC.grupos.construir();
    return p.items.flatMap(i => {
      const g = i.grupoClave ? grupos.find(x => x.clave === i.grupoClave) : null;
      if (!g) return [{...i}];
      return CC.grupos.repartir(g, i.cant).map(({v, cant}) => ({varianteId: v.id, nombre: i.nombre, cant, precio: i.precio, costo: v.costo || 0}));
    });
  };

  // ---------------------------------------------------------------------------------------------
  // Cotizador de pedidos en 4 fases: Cliente · Productos · Extras y pago · Resumen
  // ---------------------------------------------------------------------------------------------
  const NUEVO_CLIENTE = '__nuevo__';
  const CLAVE_RECARGO = 'clowncloud:recargoUrgente';
  const recargoGuardado = () => { const v = parseFloat(localStorage.getItem(CLAVE_RECARGO)); return isFinite(v) ? v : 15; };
  let wiz = null; // estado del cotizador (null = se ve la lista de pedidos)

  const nuevoWiz = () => {
    const entrega = new Date();
    entrega.setDate(entrega.getDate() + 7);
    return {paso: 1, cliente: '', nombreNuevo: '', contactoNuevo: '', entrega: entrega.toLocaleDateString('sv'), items: {}, tema: 'todos', q: '',
      pago: 'Efectivo', anticipo: '', descuento: '', urgente: false, recargo: recargoGuardado(), extras: [], notas: ''};
  };

  // Convierte el estado del cotizador en un pedido (sin guardar) para calcular totales y vista previa.
  const borrador = (w, grupos) => ({
    clienteId: w.cliente && w.cliente !== NUEVO_CLIENTE ? w.cliente : '',
    entrega: w.entrega, pago: w.pago, notas: w.notas, anticipo: +w.anticipo || 0,
    urgente: w.urgente, recargoPct: +w.recargo || 0, descuentoPct: Math.min(100, Math.max(0, +w.descuento || 0)),
    items: Object.entries(w.items).filter(([, x]) => x.n > 0).map(([clave, x]) => {
      const g = grupos.find(y => y.clave === clave);
      return {grupoClave: clave, varianteId: g ? g.rep.id : '', nombre: g ? `${g.tema} · ${g.etiqueta}` : clave, cant: x.n, precio: +x.precio || 0, costo: g ? Math.round(g.costo * 100) / 100 : 0};
    }),
    extras: w.extras.filter(x => +x.monto > 0).map(x => ({concepto: (x.concepto || '').trim() || 'Servicio extra', monto: +x.monto}))
  });

  function cotizador(el) {
    const w = wiz, G = CC.grupos, grupos = G.construir(), clientes = db.all('clientes').slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const PASOS = ['Cliente', 'Productos', 'Extras y pago', 'Resumen'];
    const quitar = (o, clave) => { delete o[clave]; };

    el.innerHTML = `
      <div class="bar"><button class="btn ghost" data-a="salir">← Volver a pedidos</button><h3 style="margin:0">Nuevo pedido</h3></div>
      <div class="cz-pasos" id="cz-pasos"></div>
      <div id="cz-cuerpo"></div>
      <div class="cz-pie" id="cz-pie"></div>`;
    const q = s => el.querySelector(s);

    // ----- Validación de cada fase (devuelve el mensaje de error o '') -----
    const validar = paso => {
      const b = borrador(w, grupos);
      if (paso === 1) {
        if (w.cliente === NUEVO_CLIENTE) {
          if (!w.nombreNuevo.trim()) return 'Escribe el nombre del cliente nuevo.';
          if (clientes.some(c => normal(c.nombre) === normal(w.nombreNuevo))) return 'Ya existe un cliente con ese nombre: elígelo en la lista.';
        }
        if (!w.entrega) return 'Falta la fecha de entrega.';
        if (dias(w.entrega) < 0) return 'La fecha de entrega no puede ser anterior a hoy.';
      }
      if (paso === 2) {
        if (!b.items.length) return 'Agrega al menos un producto.';
        if (b.items.some(i => i.precio <= 0)) return 'Todos los productos necesitan precio mayor a 0.';
      }
      if (paso === 3) {
        if ((+w.descuento || 0) < 0 || (+w.descuento || 0) > 100) return 'El descuento debe estar entre 0 y 100 %.';
        if ((+w.anticipo || 0) < 0) return 'El anticipo no puede ser negativo.';
        if ((+w.anticipo || 0) > total(b)) return `El anticipo no puede ser mayor al total (${$(total(b))}).`;
        if (w.extras.some(x => +x.monto < 0)) return 'Los servicios extra no pueden tener montos negativos.';
      }
      return '';
    };

    // ----- Pie fijo: total, ganancia y navegación -----
    const pintarPie = () => {
      const b = borrador(w, grupos);
      q('#cz-pie').innerHTML = `
        <div class="cifras"><div><small>Total</small><b>${$(total(b))}</b></div><div><small>Ganancia</small><b>${$(ganancia(b))}</b></div></div>
        <div class="acciones">
          ${w.paso > 1 ? '<button class="btn ghost" data-a="atras">← Atrás</button>' : ''}
          ${w.paso < 4 ? '<button class="btn" data-a="sig">Siguiente →</button>' : ''}
        </div>`;
    };
    const pintarPasos = () => {
      q('#cz-pasos').innerHTML = PASOS.map((t, i) => `<button class="cz-paso ${w.paso === i + 1 ? 'on' : ''} ${w.paso > i + 1 ? 'hecho' : ''}" data-a="ir" data-i="${i + 1}"><span class="num">${w.paso > i + 1 ? '✓' : i + 1}</span>${t}</button>`).join('');
    };

    // ----- Fase 1: cliente y entrega -----
    const faseCliente = () => `
      <div class="card"><h3>Cliente y pedido</h3>
        <div class="grid2">
          <label>Cliente guardado
            <select class="inp" name="cliente"><option value="">Sin cliente</option>
              ${clientes.map(c => `<option value="${c.id}" ${c.id === w.cliente ? 'selected' : ''}>${E(c.nombre)}</option>`).join('')}
              <option value="${NUEVO_CLIENTE}" ${w.cliente === NUEVO_CLIENTE ? 'selected' : ''}>➕ Cliente nuevo…</option></select></label>
          <label>Fecha de entrega<input class="inp" type="date" name="entrega" value="${E(w.entrega)}"></label>
        </div>
        ${w.cliente === NUEVO_CLIENTE ? `<div class="grid2">
          <label>Nombre del cliente<input class="inp" name="nombreNuevo" value="${E(w.nombreNuevo)}"></label>
          <label>WhatsApp o Instagram (opcional)<input class="inp" name="contactoNuevo" value="${E(w.contactoNuevo)}" placeholder="Ej. 7221234567"></label></div>` : ''}
      </div>`;

    // ----- Fase 2: productos por tema -----
    const faseProductos = () => {
      const temas = G.temasDe(grupos), visibles = grupos.filter(g => (w.tema === 'todos' || g.tema === w.tema) && G.buscar(g, w.q));
      const tile = g => {
        const n = (w.items[g.clave] || {}).n || 0;
        return `<div class="vt-tile ${n ? 'on' : ''}" data-k="${E(g.clave)}">
          <div class="vt-tile-nombre">${E(g.etiqueta)}</div>
          <div class="vt-tile-info"><b>${g.precio ? $(g.precio) : '<span class="warn">Sin precio</span>'}</b> · ${g.stock ? 'hay ' + g.stock : 'sin stock'}</div>
          <div class="vt-ctr"><button class="vt-btn" data-a="menos" data-k="${E(g.clave)}" ${n ? '' : 'disabled'}>−</button><b>${n}</b><button class="vt-btn mas" data-a="mas" data-k="${E(g.clave)}">+</button></div></div>`;
      };
      const lineas = Object.keys(w.items).filter(k => w.items[k].n > 0).map(k => {
        const g = grupos.find(x => x.clave === k), x = w.items[k];
        return `<div class="vt-linea" style="flex-wrap:wrap"><span>${g.icono} ${E(g.tema)} · ${E(g.etiqueta)}${x.n > g.stock ? `<div class="warn" style="font-size:.78rem">Hoy hay ${g.stock}: se tendrá que producir</div>` : ''}</span>
          <button class="vt-btn" data-a="menos" data-k="${E(k)}">−</button><b class="n">${x.n}</b><button class="vt-btn mas" data-a="mas" data-k="${E(k)}">+</button>
          <input class="inp cz-precio" data-k="${E(k)}" type="number" min="0" step="0.01" value="${x.precio}" style="width:92px" aria-label="Precio unitario">
          <span class="imp">${$((+x.precio || 0) * x.n)}</span></div>`;
      }).join('');
      return `
        <input class="inp" id="cz-q" placeholder="🔍 Buscar tema, tipo o diseño…" value="${E(w.q)}" style="min-height:48px;width:100%;box-sizing:border-box">
        <div class="vt-temas" style="margin-top:6px">${[['todos', '🗂️ Todos'], ...temas.map(t => [t, E(t)])].map(([v, t]) => `<button class="vt-chip ${w.tema === v ? 'on' : ''}" data-a="tema" data-tema="${E(v)}">${t}</button>`).join('')}</div>
        ${temas.filter(t => visibles.some(g => g.tema === t)).map(t => {
          const delTema = visibles.filter(g => g.tema === t);
          return `<section class="vt-tema"><h3>🗂️ ${E(t)}</h3>${G.seccionesDe(delTema).map(sec => `<div class="vt-seccion">${G.icono(sec)} ${E(sec)}</div><div class="vt-grid">${delTema.filter(g => g.seccion === sec).map(tile).join('')}</div>`).join('')}</section>`;
        }).join('') || '<p class="mute">No hay productos que coincidan.</p>'}
        <div class="card"><h3>Productos del pedido</h3>${lineas || '<p class="mute">Toca un tipo para agregarlo. Puedes pedir más de lo que hay: avisa que se tendrá que producir.</p>'}</div>`;
    };

    // ----- Fase 3: pago, ajustes y servicios extra -----
    const faseExtras = () => `
      <div class="card"><h3>Pago y ajustes</h3>
        <div class="grid2">
          <div><small class="mute">MÉTODO DE PAGO</small><div class="vt-seg" id="cz-pago">${['Efectivo', 'Tarjeta', 'Transferencia'].map(p => `<button type="button" class="${w.pago === p ? 'on' : ''}" data-a="pago" data-p="${p}">${p === 'Efectivo' ? '💵' : p === 'Tarjeta' ? '💳' : '🏦'} ${p}</button>`).join('')}</div></div>
          <label>Anticipo del cliente ($)<input class="inp" type="number" min="0" step="0.01" name="anticipo" value="${E(w.anticipo)}" placeholder="0"><span class="mute">Para pedidos grandes con anticipo + liquidación (ej. 60/40).</span></label>
        </div>
        <div class="grid2">
          <label>Descuento (%)<input class="inp" type="number" min="0" max="100" step="0.5" name="descuento" value="${E(w.descuento)}" placeholder="0"></label>
          <div><label style="display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0;min-height:44px"><input type="checkbox" name="urgente" ${w.urgente ? 'checked' : ''}> 🚀 Pedido urgente (con recargo)</label>
            ${w.urgente ? `<label>Recargo por urgente (%)<input class="inp" type="number" min="0" step="1" name="recargo" value="${E(w.recargo)}"></label>` : ''}</div>
        </div>
      </div>
      <div class="bar"><h3 style="margin:0;flex:1">Servicios extra</h3><button class="btn ghost" data-a="extra">+ Agregar servicio extra</button></div>
      <div class="card">${w.extras.map((x, i) => `
        <div class="grid2 cr" style="align-items:center;grid-template-columns:1fr 130px 44px"><input class="inp cz-ex-c" data-i="${i}" placeholder="Concepto (empaque, envío…)" value="${E(x.concepto)}">
          <input class="inp cz-ex-m" data-i="${i}" type="number" min="0" step="0.01" placeholder="$ Monto" value="${E(x.monto)}"><button class="btn ghost sm" data-a="quitarExtra" data-i="${i}">✕</button></div>`).join('') || '<p class="mute">Sin servicios extra en este pedido (planchado especial, empaque, envío, etc.).</p>'}</div>`;

    // ----- Fase 4: resumen -----
    const faseResumen = () => {
      const b = borrador(w, grupos), d = desglose(b), costo = b.items.reduce((s, i) => s + i.costo * i.cant, 0);
      const kpi = (t, v, c = '') => `<div class="kpi"><small>${t}</small><b class="${c}">${v}</b></div>`;
      const cliente = w.cliente === NUEVO_CLIENTE ? w.nombreNuevo : ((db.get('clientes', w.cliente) || {}).nombre || 'Sin cliente');
      return `
        <h3 style="margin:0 0 8px">Resumen</h3>
        <div class="mute" style="margin-bottom:8px">👤 ${E(cliente)} · entrega ${E(w.entrega)} · ${b.items.reduce((s, i) => s + i.cant, 0)} pieza(s) · pago ${w.pago}</div>
        <div class="kpis">
          ${kpi('Total de venta', $(d.total))}
          ${kpi('Costo de producción', $(costo))}
          ${kpi('Servicios extra', $(d.extras))}
          ${d.recargo ? kpi('Recargo urgente', '+ ' + $(d.recargo)) : ''}
          ${kpi('Descuento', '− ' + $(d.descuento))}
          ${kpi('Ganancia real', $(ganancia(b)), ganancia(b) < 0 ? 'neg' : 'pos-n')}
        </div>
        <label>Notas del pedido<textarea class="inp" name="notas" rows="3" placeholder="Ej. entregar el viernes, incluye bolsa sorpresa…">${E(w.notas)}</textarea></label>
        <div class="bar" style="margin-top:10px">
          <button class="btn ghost" data-a="nuevaCot">🗑️ Nueva cotización</button><div style="flex:1"></div>
          <button class="btn ghost" data-a="vista">📤 Vista previa / Compartir</button>
          <button class="btn" data-a="guardar">💾 Guardar pedido</button>
        </div>`;
    };

    const pintarCuerpo = () => {
      q('#cz-cuerpo').innerHTML = [faseCliente, faseProductos, faseExtras, faseResumen][w.paso - 1]();
      pintarPasos();
      pintarPie();
    };

    // ----- Acciones -----
    const cambiarPieza = (clave, delta) => {
      const g = grupos.find(x => x.clave === clave);
      if (!g) return;
      const actual = w.items[clave] ? w.items[clave].n : 0, nuevo = actual + delta;
      if (delta > 0 && !g.precio && !w.items[clave]) ui.toast(`"${g.tema} · ${g.etiqueta}" no tiene precio: escríbelo en la lista de abajo`);
      if (nuevo <= 0) quitar(w.items, clave);
      else w.items[clave] = {n: nuevo, precio: w.items[clave] ? w.items[clave].precio : (g.precio || '')};
      pintarCuerpo();
    };
    const ir = paso => {
      for (let p = w.paso; p < paso; p++) { const error = validar(p); if (error) return ui.toast(error); }
      w.paso = paso;
      pintarCuerpo();
      window.scrollTo(0, 0);
    };

    function guardarPedido() {
      for (let p = 1; p <= 3; p++) { const error = validar(p); if (error) { w.paso = p; pintarCuerpo(); return ui.toast(error); } }
      const b = borrador(w, grupos);
      let clienteId = b.clienteId;
      if (w.cliente === NUEVO_CLIENTE) clienteId = db.add('clientes', {nombre: w.nombreNuevo.trim(), contacto: w.contactoNuevo.trim(), notas: '', etiquetas: []}).id;
      localStorage.setItem(CLAVE_RECARGO, +w.recargo || 0);
      const folio = 'CC-' + (1001 + db.crudo().pedidos.length);
      db.add('pedidos', {...b, folio, clienteId, fecha: ui.hoy(), estado: 'Por hacer'});
      wiz = null;
      ui.toast('Pedido ' + folio + ' creado');
      CC.router.show();
    }

    el.onclick = e => {
      const b = e.target.closest('[data-a]');
      if (!b) { const t = e.target.closest('.vt-tile'); if (t) cambiarPieza(t.dataset.k, 1); return; }
      const d = b.dataset;
      switch (d.a) {
        case 'salir': wiz = null; return CC.router.show();
        case 'ir': return d.i < w.paso ? (w.paso = +d.i, pintarCuerpo()) : ir(+d.i);
        case 'sig': return ir(w.paso + 1);
        case 'atras': w.paso--; pintarCuerpo(); return window.scrollTo(0, 0);
        case 'mas': return cambiarPieza(d.k, 1);
        case 'menos': return cambiarPieza(d.k, -1);
        case 'tema': w.tema = d.tema; return pintarCuerpo();
        case 'pago': w.pago = d.p; return pintarCuerpo();
        case 'extra': w.extras.push({concepto: '', monto: ''}); return pintarCuerpo();
        case 'quitarExtra': w.extras.splice(+d.i, 1); return pintarCuerpo();
        case 'nuevaCot': return ui.confirm('Se borrará todo lo capturado en esta cotización.', 'Empezar de nuevo').then(ok => { if (ok) { wiz = nuevoWiz(); CC.router.show(); } });
        case 'vista': {
          const b2 = {...borrador(w, grupos), folio: 'BORRADOR', fecha: ui.hoy(), estado: 'Por hacer'};
          return CC.pdf.render(CC.pdf.htmlPedido(b2), 'cotizacion-' + ui.hoy());
        }
        case 'guardar': return guardarPedido();
      }
    };

    // Cambios en campos: se guardan en el estado; solo lo que cambia la estructura vuelve a dibujar la fase.
    el.onchange = e => {
      const n = e.target.name;
      if (n === 'cliente') { w.cliente = e.target.value; return pintarCuerpo(); }
      if (n === 'urgente') { w.urgente = e.target.checked; return pintarCuerpo(); }
    };
    el.oninput = e => {
      const t = e.target, n = t.name;
      if (t.id === 'cz-q') { w.q = t.value; const pos = t.selectionStart; pintarCuerpo(); const c = q('#cz-q'); c.focus(); c.setSelectionRange(pos, pos); return; }
      if (t.classList.contains('cz-precio')) { w.items[t.dataset.k].precio = t.value; return pintarPie(); }
      if (t.classList.contains('cz-ex-c')) { w.extras[+t.dataset.i].concepto = t.value; return; }
      if (t.classList.contains('cz-ex-m')) { w.extras[+t.dataset.i].monto = t.value; return pintarPie(); }
      if (n && n in w) { w[n] = t.value; pintarPie(); }
    };

    pintarCuerpo();
  }

  function entregar(p) {
    const f = falta(p);
    if (f.length)
      return ui.toast('No se puede entregar: falta stock de ' + f.join('; '));
    ui.modal('Entregar pedido ' + p.folio, `<p class="mute">Saldo por cobrar: <b>${$(total(p) - p.anticipo)}</b>. Se registrará la venta por ${$(total(p))} y se descontará el stock.</p><label>Cómo se pagó<select class="inp" name="pago"><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option></select></label>`, m => {
      const pago = ui.vals(m).pago, copia = JSON.stringify(db.crudo()), t = total(p);
      const itemsVenta = expandirItems(p), ajuste = r2(t - itemsVenta.reduce((acc, i) => acc + i.precio * i.cant, 0));
      const v = db.add('ventas', {
        items: itemsVenta,
        total: t,
        ajuste,
        pago,
        eventoId: '',
        clienteId: p.clienteId,
        fecha: ui.hoy(),
        pedidoId: p.id,
        comision: pago === 'Tarjeta' ? t * ui.cfg.comision() / 100 : 0
      });
      itemsVenta.forEach(i => CC.mover(i.varianteId, -i.cant, 'venta', 'Pedido ' + p.folio, v.id));
      db.update('pedidos', p.id, { estado: 'Entregado' });
      CC.router.show();
      ui.deshacer(`Pedido ${p.folio} entregado.`, copia);
    });
    const selectorPago = document.querySelector('#modal [name=pago]');
    if (selectorPago && p.pago) selectorPago.value = p.pago;
  }
  // Color del contorno de cada tarjeta según el estado de producción.
  const COLOR_ESTADO = {
    'Por hacer': 'var(--azul-300)',
    'En producción': 'var(--amarillo)',
    'Listo': 'var(--color-success, #3fd08f)',
    'Entregado': 'var(--azul-600)'
  };
  const ganancia = p => r2(p.items.reduce((s, i) => s + (i.precio - (i.costo || 0)) * i.cant, 0) + (desglose(p).total - desglose(p).subtotal));
  const normal = x => String(x || '').trim().toLowerCase();
  let filtroCliente = 'all'; // 'all' | 'none' | id de cliente

  // Asigna (o cambia) el cliente de un pedido; también permite crear uno nuevo al momento.
  function asignarCliente(p) {
    const clientes = db.all('clientes').slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    ui.modal((p.clienteId ? 'Cambiar cliente · ' : 'Asignar cliente · ') + E(p.folio), `
      <label>Cliente
        <select class="inp" name="cliente">
          <option value="">Sin cliente</option>
          ${clientes.map(c => `<option value="${c.id}" ${c.id === p.clienteId ? 'selected' : ''}>${E(c.nombre)}</option>`).join('')}
          <option value="__nuevo__">➕ Cliente nuevo…</option>
        </select>
      </label>
      <div id="pc-nuevo" style="display:none">
        ${ui.inp('nombre', 'Nombre del cliente')}
        ${ui.inp('contacto', 'Teléfono o Instagram (opcional)')}
      </div>`, m => {
      const o = ui.vals(m);
      let clienteId = o.cliente;
      if (clienteId === '__nuevo__') {
        const nombre = o.nombre.trim();
        if (!nombre) { ui.toast('Escribe el nombre del cliente nuevo'); return false; }
        if (clientes.some(c => normal(c.nombre) === normal(nombre))) { ui.toast('Ya existe un cliente con ese nombre: elígelo en la lista'); return false; }
        clienteId = db.add('clientes', {nombre, contacto: o.contacto.trim(), notas: '', etiquetas: []}).id;
      }
      db.update('pedidos', p.id, {clienteId});
      ui.toast(clienteId ? 'Cliente asignado' : 'Pedido sin cliente');
      CC.router.show();
    });
    const raiz = document.getElementById('modal');
    raiz.onchange = () => { raiz.querySelector('#pc-nuevo').style.display = raiz.querySelector('[name=cliente]').value === '__nuevo__' ? '' : 'none'; };
  }

  // Copia un pedido (mismos productos y cliente) como un pedido nuevo por hacer.
  function duplicar(p) {
    const entrega = new Date();
    entrega.setDate(entrega.getDate() + 7);
    const folio = 'CC-' + (1001 + db.crudo().pedidos.length);
    db.add('pedidos', {folio, clienteId: p.clienteId, fecha: ui.hoy(), entrega: entrega.toLocaleDateString('sv'), estado: 'Por hacer', anticipo: 0, notas: p.notas || '', pago: p.pago, urgente: p.urgente, recargoPct: p.recargoPct, descuentoPct: p.descuentoPct, extras: (p.extras || []).map(x => ({...x})), items: p.items.map(i => ({...i}))});
    ui.toast(`Pedido duplicado: ${folio}`);
    CC.router.show();
  }

  const avanzar = p => {
    const s = ESTADOS[ESTADOS.indexOf(p.estado) + 1];
    if (!s)
      return;
    if (s === 'Entregado')
      return entregar(p);
    db.update('pedidos', p.id, { estado: s });
    CC.router.show();
  };
  function ver(p) {
    const c = db.get('clientes', p.clienteId) || {}, s = CC.semaforoPedido(p), i = ESTADOS.indexOf(p.estado), ac = [
        {
          label: '📄 PDF',
          fn: () => CC.pdf.pedido(p)
        },
        {
          label: '💬 WhatsApp',
          ghost: 1,
          fn: () => CC.pdf.whatsapp(p)
        }
      ];
    if (i > 0 && p.estado !== 'Entregado')
      ac.push({
        label: '↩️ Estado anterior',
        ghost: 1,
        fn: () => {
          db.update('pedidos', p.id, { estado: ESTADOS[i - 1] });
          CC.router.show();
        }
      });
    ac.push({
      label: '👤 ' + (p.clienteId ? 'Cambiar cliente' : 'Asignar cliente'),
      ghost: 1,
      fn: () => asignarCliente(p)
    });
    ac.push({
      label: '🗑️ Eliminar',
      ghost: 1,
      fn: () => {
        if (p.estado === 'Entregado')
          return ui.toast('No se puede eliminar un pedido entregado: ya generó una venta');
        ui.confirm(`¿Eliminar el pedido ${p.folio}?`).then(ok => {
          if (ok) {
            const copia = JSON.stringify(db.crudo());
            db.remove('pedidos', p.id);
            CC.router.show();
            ui.deshacer('Pedido eliminado.', copia);
          }
        });
      }
    });
    ui.detalle({
      icon: '📋',
      title: `Pedido ${p.folio}`,
      sub: `${c.nombre || 'Sin cliente'} · ${s[0]} ${s[1]}`,
      secciones: [
        {
          t: 'Pedido',
          f: [
            [
              'Estado',
              p.estado
            ],
            [
              'Fecha',
              p.fecha
            ],
            [
              'Entrega',
              p.entrega
            ]
          ]
        },
        {
          t: 'Productos',
          f: p.items.map(x => [
            `${x.cant} × ${x.nombre}`,
            $(x.precio * x.cant)
          ])
        },
        {
          t: 'Pagos',
          f: [
            ...(desglose(p).extras || desglose(p).recargo || desglose(p).descuento ? [
              ['Piezas', $(desglose(p).subtotal)],
              ...(desglose(p).recargo ? [['Recargo urgente', '+ ' + $(desglose(p).recargo)]] : []),
              ...(desglose(p).extras ? [['Servicios extra', '+ ' + $(desglose(p).extras)]] : []),
              ...(desglose(p).descuento ? [['Descuento', '− ' + $(desglose(p).descuento)]] : [])
            ] : []),
            [
              'Total',
              $(total(p))
            ],
            [
              'Anticipo',
              $(p.anticipo || 0)
            ],
            [
              'Saldo pendiente',
              $(Math.max(0, total(p) - (p.anticipo || 0))),
              p.estado === 'Entregado' ? 'good' : 'bad'
            ]
          ]
        },
        ...p.notas ? [{
            t: 'Notas',
            html: `<p class="mute">${E(p.notas)}</p>`
          }] : []
      ],
      acciones: ac
    });
  }
  // Tarjeta de un pedido: el contorno y la barra de avance siguen el estado de producción.
  const tarjeta = p => {
    const c = p.clienteId ? db.get('clientes', p.clienteId) : null, s = CC.semaforoPedido(p), idx = ESTADOS.indexOf(p.estado);
    const color = COLOR_ESTADO[p.estado], sig = ESTADOS[idx + 1], sinStock = p.estado === 'Entregado' ? [] : falta(p);
    const tot = total(p), saldo = Math.max(0, tot - (p.anticipo || 0));
    return `
      <div class="card" style="border:2px solid ${color};margin:0;${p.estado === 'Entregado' ? 'opacity:.85' : ''}">
        <div class="bar" style="margin:0 0 4px;align-items:flex-start">
          <b style="flex:1;font-size:1.1rem">${s[0]} ${E(p.folio)}</b>
          <span class="chip" style="--c:${color}">${p.estado}</span>
        </div>
        <div class="mute">${c ? '👤 ' + E(c.nombre) : '<b class="warn">Sin cliente</b>'} · ${E(p.fecha)} · ${p.items.length} artículo(s)</div>
        <div class="mute">🚦 ${s[1]} (${E(p.entrega)})</div>
        <div style="display:flex;gap:4px;margin:8px 0" title="Avance de producción">
          ${ESTADOS.map((e, i) => `<i style="flex:1;height:5px;border-radius:3px;background:${i <= idx ? color : 'var(--azul-700)'}"></i>`).join('')}
        </div>
        ${sinStock.length ? '<span class="chip" style="--c:var(--amarillo-300)">Falta stock</span>' : ''}
        <div class="line"><span>Total de venta</span><b>${$(tot)}</b></div>
        ${p.anticipo ? `<div class="line"><span>Anticipo</span><span>${$(p.anticipo)}</span></div>` : ''}
        <div class="line"><span>Saldo por cobrar</span><b class="${p.estado === 'Entregado' ? 'pos-n' : saldo ? 'neg' : ''}">${$(p.estado === 'Entregado' ? 0 : saldo)}</b></div>
        <div class="line"><span>Ganancia</span><b class="pos-n">${$(ganancia(p))}</b></div>
        <div class="bar" style="margin:10px 0 0">
          <button class="btn sm" data-v="${p.id}">👁 Ver</button>
          ${sig ? `<button class="btn ghost sm" data-a="${p.id}">→ ${sig}</button>` : ''}
          <button class="btn ghost sm" data-c="${p.id}">👤 ${c ? 'Cliente' : 'Asignar cliente'}</button>
          <button class="btn ghost sm" data-p="${p.id}">📄 PDF</button>
          <button class="btn ghost sm" data-d="${p.id}">⧉ Duplicar</button>
        </div>
      </div>`;
  };

  CC.router.register('pedidos', 'Pedidos', '📋', el => {
    if (wiz) return cotizador(el);
    const clientes = db.all('clientes').slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    if (filtroCliente !== 'all' && filtroCliente !== 'none' && !clientes.some(c => c.id === filtroCliente)) filtroCliente = 'all';
    const deCliente = p => filtroCliente === 'all' || (filtroCliente === 'none' ? !p.clienteId : p.clienteId === filtroCliente);
    const todos = db.all('pedidos').slice().reverse().filter(deCliente);
    const abiertos = todos.filter(p => p.estado !== 'Entregado');
    const lista = fe === 'Todos' ? todos : todos.filter(p => p.estado === fe);
    const vencidos = abiertos.filter(p => CC.semaforoPedido(p)[0] === '🔴').length;
    const kpi = (titulo, valor, clase = '') => `<div class="kpi"><small>${titulo}</small><b class="${clase}">${valor}</b></div>`;

    el.innerHTML = `
      <div class="kpis">
        ${kpi('Pedidos abiertos', abiertos.length)}
        ${kpi('Por cobrar (saldos)', $(abiertos.reduce((s, p) => s + Math.max(0, total(p) - (p.anticipo || 0)), 0)))}
        ${kpi('Entregas hoy o vencidas', vencidos, vencidos ? 'neg' : '')}
      </div>
      <div class="bar">
        <div class="seg" style="margin:0">${['Todos', ...ESTADOS].map(st => `<button class="${fe === st ? 'on' : ''}" data-s="${st}">${st} · ${st === 'Todos' ? todos.length : todos.filter(p => p.estado === st).length}</button>`).join('')}</div>
        <div style="flex:1"></div>
        <select class="inp" id="fc" style="max-width:220px">
          <option value="all">Todos los clientes</option>
          <option value="none" ${filtroCliente === 'none' ? 'selected' : ''}>Sin cliente</option>
          ${clientes.map(c => `<option value="${c.id}" ${filtroCliente === c.id ? 'selected' : ''}>${E(c.nombre)}</option>`).join('')}
        </select>
        <button class="btn" id="n">+ Pedido</button>
      </div>
      <div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${lista.map(tarjeta).join('') || '<p class="mute">No hay pedidos aquí. Crea el primero con «+ Pedido».</p>'}</div>`;

    el.querySelector('#n').onclick = () => { wiz = nuevoWiz(); CC.router.show(); };
    el.querySelector('#fc').onchange = e => { filtroCliente = e.target.value; CC.router.show(); };
    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      const g = clave => db.get('pedidos', b.dataset[clave]);
      if (b.dataset.s) { fe = b.dataset.s; CC.router.show(); }
      else if (b.dataset.v) ver(g('v'));
      else if (b.dataset.a) avanzar(g('a'));
      else if (b.dataset.c) asignarCliente(g('c'));
      else if (b.dataset.p) CC.pdf.pedido(g('p'));
      else if (b.dataset.d) duplicar(g('d'));
    };
  });
})();
