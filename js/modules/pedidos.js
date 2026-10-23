// Pedidos: cliente, productos, anticipo y fecha de entrega, con estados, semáforo y PDF con logo.
(() => {
  const {db, ui} = CC, E = ui.esc, $ = ui.money, ESTADOS = [
      'Por hacer',
      'En producción',
      'Listo',
      'Entregado'
    ];
  let fe = 'Todos';
  const total = p => p.items.reduce((s, i) => s + i.precio * i.cant, 0), dias = f => Math.round((new Date(f + 'T00:00:00') - new Date(ui.hoy() + 'T00:00:00')) / 86400000);
  const falta = p => p.items.filter(i => CC.stock(i.varianteId) < i.cant).map(i => `${i.nombre} (hay ${Math.max(0, CC.stock(i.varianteId))}, piden ${i.cant})`);
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
  function form() {
    const vs = db.all('variantes'), cs = db.all('clientes'), f7 = new Date();
    f7.setDate(f7.getDate() + 7);
    const linea = () => `<div class="cl2" style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-bottom:8px"><select class="inp lv">${vs.map(v => `<option value="${v.id}" data-p="${v.precio || ''}">${E(CC.nombreVar(v))}</option>`).join('')}</select><input class="inp lq" type="number" min="1" placeholder="Cant."><input class="inp lp" type="number" step="0.01" placeholder="Precio"></div>`;
    if (!vs.length)
      return ui.toast('Primero agrega productos al catálogo');
    ui.modal('Nuevo pedido', `<label>Cliente<select class="inp" name="cliente"><option value="">Sin cliente</option>${cs.map(c => `<option value="${c.id}">${E(c.nombre)}</option>`).join('')}</select></label>
      <div class="grid2">${ui.inp('entrega', 'Fecha de entrega', f7.toLocaleDateString('sv'), 'date')}${ui.inp('anticipo', 'Anticipo recibido', '', 'number', 'step="0.01"')}</div>
      <label>Productos</label><div id="ls">${linea()}</div><button type="button" class="btn ghost sm" id="al">＋ Agregar producto</button>${ui.inp('notas', 'Notas')}<div class="card" id="cp" style="margin:12px 0 0;font-size:.85rem"></div>`, m => {
      const e = est();
      if (e.error) {
        ui.toast(e.error);
        return false;
      }
      const o = ui.vals(m), folio = 'CC-' + (1001 + db.crudo().pedidos.length);
      db.add('pedidos', {
        folio,
        clienteId: o.cliente,
        fecha: ui.hoy(),
        entrega: e.ent,
        estado: 'Por hacer',
        anticipo: e.ant,
        notas: o.notas,
        items: e.lin.map(l => {
          const v = db.get('variantes', l.varianteId);
          return {
            varianteId: v.id,
            nombre: CC.nombreVar(v),
            cant: l.cant,
            precio: l.precio,
            costo: v.costo || 0
          };
        })
      });
      ui.toast('Pedido ' + folio + ' creado');
      CC.router.show();
    });
    const root = document.getElementById('modal'), q = s => root.querySelector(s), pon = r => {
        const o = r.querySelector('.lv').selectedOptions[0];
        if (o)
          r.querySelector('.lp').value = o.dataset.p;
      };
    const est = () => {
      const lin = [...root.querySelectorAll('.cl2')].map(r => ({
        varianteId: r.querySelector('.lv').value,
        cant: +r.querySelector('.lq').value || 0,
        precio: +r.querySelector('.lp').value || 0
      })).filter(l => l.cant || l.precio);
      const tot = lin.reduce((s, l) => s + l.cant * l.precio, 0), ant = +q('[name=anticipo]').value || 0, ent = q('[name=entrega]').value;
      let error = '';
      if (!lin.length)
        error = 'Agrega al menos un producto con cantidad.';
      else if (lin.some(l => l.cant <= 0 || l.precio <= 0))
        error = 'Cada producto necesita cantidad y precio.';
      else if (new Set(lin.map(l => l.varianteId)).size < lin.length)
        error = 'Hay un producto repetido: junta sus cantidades en una sola línea.';
      else if (!ent)
        error = 'Falta la fecha de entrega.';
      else if (dias(ent) < 0)
        error = 'La fecha de entrega no puede ser anterior a hoy.';
      else if (ant < 0 || ant > tot)
        error = `El anticipo no puede ser negativo ni mayor al total (${$(tot)}).`;
      return {
        lin,
        tot,
        ant,
        ent,
        error
      };
    };
    const calc = () => {
      if (!q('#cp'))
        return;
      const e = est(), sin = e.error ? [] : falta({
          items: e.lin.map(l => ({
            ...l,
            nombre: CC.nombreVar(db.get('variantes', l.varianteId))
          }))
        });
      q('#cp').innerHTML = e.error ? `<span class="neg">${E(e.error)}</span>` : `Total <b>${$(e.tot)}</b> · Anticipo <b>${$(e.ant)}</b> · Saldo <b>${$(e.tot - e.ant)}</b>${sin.length ? `<br><span class="warn">Hoy no hay stock suficiente de: ${E(sin.join('; '))}. Se tendrá que producir.</span>` : ''}`;
    };
    root.onchange = e => {
      if (e.target.classList.contains('lv'))
        pon(e.target.closest('.cl2'));
      calc();
    };
    root.oninput = calc;
    q('#al').onclick = () => {
      q('#ls').insertAdjacentHTML('beforeend', linea());
      pon(root.querySelector('.cl2:last-child'));
    };
    pon(q('.cl2'));
    calc();
  }
  function entregar(p) {
    const f = falta(p);
    if (f.length)
      return ui.toast('No se puede entregar: falta stock de ' + f.join('; '));
    ui.modal('Entregar pedido ' + p.folio, `<p class="mute">Saldo por cobrar: <b>${$(total(p) - p.anticipo)}</b>. Se registrará la venta por ${$(total(p))} y se descontará el stock.</p><label>Cómo se pagó<select class="inp" name="pago"><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option></select></label>`, m => {
      const pago = ui.vals(m).pago, copia = JSON.stringify(db.crudo()), t = total(p);
      const v = db.add('ventas', {
        items: p.items.map(i => ({ ...i })),
        total: t,
        pago,
        eventoId: '',
        clienteId: p.clienteId,
        fecha: ui.hoy(),
        pedidoId: p.id,
        comision: pago === 'Tarjeta' ? t * ui.cfg.comision() / 100 : 0
      });
      p.items.forEach(i => CC.mover(i.varianteId, -i.cant, 'venta', 'Pedido ' + p.folio, v.id));
      db.update('pedidos', p.id, { estado: 'Entregado' });
      CC.router.show();
      ui.deshacer(`Pedido ${p.folio} entregado.`, copia);
    });
  }
  // Color del contorno de cada tarjeta según el estado de producción.
  const COLOR_ESTADO = {
    'Por hacer': 'var(--azul-300)',
    'En producción': 'var(--amarillo)',
    'Listo': 'var(--color-success, #3fd08f)',
    'Entregado': 'var(--azul-600)'
  };
  const ganancia = p => p.items.reduce((s, i) => s + (i.precio - (i.costo || 0)) * i.cant, 0);
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
    db.add('pedidos', {folio, clienteId: p.clienteId, fecha: ui.hoy(), entrega: entrega.toLocaleDateString('sv'), estado: 'Por hacer', anticipo: 0, notas: p.notas || '', items: p.items.map(i => ({...i}))});
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

    el.querySelector('#n').onclick = form;
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