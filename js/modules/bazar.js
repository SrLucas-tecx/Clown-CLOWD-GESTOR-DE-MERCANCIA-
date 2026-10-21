// Modo bazar: pantalla completa con botones grandes, descuento por renglón, precios por cantidad y combos.
(() => {
  const {db, ui} = CC, E = ui.esc, $ = ui.money, norm = s => String(s || '').trim().toLowerCase(), g = id => document.getElementById(id);
  const mb = {
    t: {},
    d: {},
    pago: 'Efectivo',
    cat: 'todos'
  };
  const abierto = () => {
    const o = g('mbz');
    return !!o && o.classList.contains('open');
  };
  const prods = () => [
    ...db.all('variantes').filter(v => CC.stock(v.id) > 0).map(v => ({
      k: v.id,
      v,
      n: CC.nombreVar(v),
      cat: norm((db.get('productos', v.productoId) || {}).categoria),
      max: CC.stock(v.id)
    })),
    ...db.all('combos').filter(c => CC.comboMax(c) > 0).map(c => ({
      k: 'c:' + c.id,
      c,
      n: '🎁 ' + c.nombre,
      cat: 'combos',
      max: CC.comboMax(c)
    }))
  ];
  const sub = (p, n) => p.v ? CC.linea(p.v, n) : p.c.precio * n;
  const fin = (p, n) => {
    const s = sub(p, n), d = mb.d[p.k];
    return !d || !(d.valor > 0) ? s : Math.max(0, d.tipo === 'pct' ? s * (1 - Math.min(100, d.valor) / 100) : s - d.valor);
  };
  function crear() {
    if (g('mbz'))
      return;
    const o = document.createElement('div');
    o.className = 'mb-overlay';
    o.id = 'mbz';
    o.innerHTML = `<div class="mb-top"><b style="font:700 1.1rem var(--font-display)">🛍️ Modo bazar</b><select class="inp" id="mbe"></select><button type="button" class="btn ghost" id="mbh" title="Vendido hoy en este lugar">Vendido hoy: <b id="mbhv">$0</b></button><div style="flex:1"></div><input class="inp" id="mbq" placeholder="Buscar…" style="max-width:220px"><button class="btn ghost" id="mbs">Salir</button></div>
      <div class="mb-pills" id="mbp"></div><div class="mb-grid" id="mbg"></div>
      <div class="mb-ticket"><div class="mb-items" id="mbi"></div><div class="mb-pay"><div class="pay-toggle" id="mbpay"><button data-p="Efectivo">💵 Efectivo</button><button data-p="Tarjeta">💳 Tarjeta</button></div><div class="mb-total"><span>Total</span><b id="mbt">$0.00</b></div><button class="btn ghost" id="mbl">Limpiar</button><button class="btn" id="mbc" style="min-height:52px;padding:0 32px">Cobrar</button></div></div>`;
    document.body.appendChild(o);
    g('mbs').onclick = cerrar;
    g('mbq').oninput = render;
    g('mbe').onchange = render;
    g('mbl').onclick = () => {
      mb.t = {};
      mb.d = {};
      render();
    };
    g('mbc').onclick = cobrar;
    g('mbh').onclick = () => {
      const vs = hoy();
      ui.detalle({
        icon: '🧾',
        title: 'Vendido hoy',
        sub: 'En el lugar elegido',
        secciones: [{
            f: [
              [
                'Ventas',
                vs.length
              ],
              [
                'Total',
                $(vs.reduce((s, v) => s + v.total, 0)),
                'good'
              ],
              [
                'Efectivo',
                $(vs.filter(v => v.pago === 'Efectivo').reduce((s, v) => s + v.total, 0))
              ],
              [
                'Tarjeta',
                $(vs.filter(v => v.pago === 'Tarjeta').reduce((s, v) => s + v.total, 0))
              ]
            ]
          }]
      });
    };
    g('mbpay').onclick = e => {
      const b = e.target.closest('[data-p]');
      if (b) {
        mb.pago = b.dataset.p;
        render();
      }
    };
    g('mbp').onclick = e => {
      const b = e.target.closest('[data-c]');
      if (b) {
        mb.cat = b.dataset.c;
        render();
      }
    };
    g('mbg').onclick = e => {
      const t = e.target.closest('[data-k]');
      if (t)
        agregar(t.dataset.k, 1);
    };
    g('mbi').onclick = e => {
      const b = e.target.closest('button');
      if (!b)
        return;
      if (b.dataset.k)
        agregar(b.dataset.k, +b.dataset.d);
      else if (b.dataset.x)
        descuento(b.dataset.x);
    };
  }
  const hoy = () => CC.ventasOk().filter(v => v.fecha === ui.hoy() && (v.eventoId || '') === g('mbe').value);
  function agregar(k, d) {
    const p = prods().find(x => x.k === k);
    if (!p)
      return;
    const a = mb.t[k] || 0;
    if (d > 0 && a + d > p.max)
      return ui.toast(`No hay más "${p.n}": quedan ${p.max}`);
    const n = Math.max(0, a + d);
    n ? mb.t[k] = n : delete mb.t[k];
    render();
  }
  function descuento(k) {
    const p = prods().find(x => x.k === k), d = mb.d[k] || {
        tipo: 'pct',
        valor: ''
      };
    if (!p)
      return;
    ui.modal('Descuento · ' + E(p.n), `<label>Tipo<select class="inp" name="tipo"><option value="pct" ${d.tipo === 'pct' ? 'selected' : ''}>% del renglón</option><option value="monto" ${d.tipo === 'monto' ? 'selected' : ''}>$ de descuento al renglón</option></select></label>${ui.inp('valor', 'Descuento (vacío = quitar)', d.valor, 'number', 'step="any"')}`, m => {
      const o = ui.vals(m), val = +o.valor || 0, s = sub(p, mb.t[k]);
      if (val < 0 || o.tipo === 'pct' && val > 100 || o.tipo === 'monto' && val > s) {
        ui.toast(o.tipo === 'pct' ? 'No se puede: el porcentaje debe estar entre 0 y 100' : `No se puede: el descuento no puede ser mayor al renglón (${$(s)})`);
        return false;
      }
      val > 0 ? mb.d[k] = {
        tipo: o.tipo,
        valor: val
      } : delete mb.d[k];
      render();
    });
  }
  function render() {
    if (!abierto())
      return;
    const todos = prods();
    Object.keys(mb.t).forEach(k => {
      const p = todos.find(x => x.k === k);
      if (!p)
        delete mb.t[k];
      else if (mb.t[k] > p.max)
        mb.t[k] = p.max;
    });
    Object.keys(mb.d).forEach(k => {
      if (!mb.t[k])
        delete mb.d[k];
    });
    const q = norm(g('mbq').value), cats = [
        'todos',
        ...new Set(todos.map(p => p.cat))
      ];
    if (!cats.includes(mb.cat))
      mb.cat = 'todos';
    g('mbp').innerHTML = cats.map(c => `<button class="tab ${mb.cat === c ? 'on' : ''}" data-c="${E(c)}">${c === 'todos' ? 'Todo' : c === 'combos' ? '🎁 Combos' : E(c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Sin categoría')}</button>`).join('');
    g('mbg').innerHTML = todos.filter(p => (mb.cat === 'todos' || p.cat === mb.cat) && (!q || norm(p.n).includes(q))).map(p => {
      const n = mb.t[p.k] || 0, v = p.v;
      return `<button class="mb-tile ${n ? 'on' : ''}" data-k="${p.k}"><b>${E(p.n)}</b><span class="mute">quedan ${p.max}</span>${v && v.escCant > 1 ? `<span class="mute">${v.escCant} por ${$(v.escTotal)}</span>` : ''}<span class="mb-price">${$(v ? v.precio : p.c.precio)}</span>${n ? `<span class="mb-badge">×${n}</span>` : ''}</button>`;
    }).join('') || '<p class="mute">Nada con stock coincide.</p>';
    let tot = 0;
    g('mbi').innerHTML = Object.keys(mb.t).map(k => {
      const p = todos.find(x => x.k === k), n = mb.t[k], f = fin(p, n);
      tot += f;
      return `<span class="mb-chip"><button data-k="${k}" data-d="-1">−</button><span>${n} × ${E(p.n)} · ${$(f)}</span><button data-k="${k}" data-d="1">+</button><button data-x="${k}" title="Descuento" style="${mb.d[k] ? 'background:var(--amarillo-soft)' : 'opacity:.6'}">🏷️</button></span>`;
    }).join('') || '<span class="mute">Toca un producto para agregarlo</span>';
    g('mbt').textContent = $(tot);
    g('mbc').disabled = !tot && !Object.keys(mb.t).length;
    g('mbpay').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.p === mb.pago));
    g('mbhv').textContent = $(hoy().reduce((s, v) => s + v.total, 0));
  }
  function cobrar() {
    const ks = Object.keys(mb.t);
    if (!ks.length)
      return;
    const todos = prods(), items = [];
    for (const k of ks) {
      const p = todos.find(x => x.k === k), n = mb.t[k];
      if (!p || n > p.max)
        return ui.toast('Cambió el stock: revisa la venta');
      const f = fin(p, n);
      if (p.v)
        items.push({
          varianteId: p.v.id,
          nombre: p.n,
          cant: n,
          precio: f / n,
          precioLista: p.v.precio || 0,
          costo: p.v.costo || 0
        });
      else {
        const suma = CC.comboSuma(p.c) || 1;
        p.c.items.forEach(i => {
          const v = db.get('variantes', i.varianteId), cant = i.cant * n;
          items.push({
            varianteId: v.id,
            nombre: `${CC.nombreVar(v)} (${p.c.nombre})`,
            cant,
            precio: f * ((v.precio || 0) * i.cant / suma) / cant,
            precioLista: v.precio || 0,
            costo: v.costo || 0
          });
        });
      }
    }
    const dem = {};
    items.forEach(i => dem[i.varianteId] = (dem[i.varianteId] || 0) + i.cant);
    const mal = Object.keys(dem).find(id => dem[id] > CC.stock(id));
    if (mal)
      return ui.toast(`No se puede cobrar: no hay suficiente "${CC.nombreVar(db.get('variantes', mal))}" (quedan ${Math.max(0, CC.stock(mal))})`);
    const total = items.reduce((s, i) => s + i.precio * i.cant, 0), copia = JSON.stringify(db.crudo());
    const ve = db.add('ventas', {
      items,
      total,
      pago: mb.pago,
      eventoId: g('mbe').value,
      clienteId: '',
      fecha: ui.hoy(),
      comision: mb.pago === 'Tarjeta' ? total * ui.cfg.comision() / 100 : 0
    });
    items.forEach(i => CC.mover(i.varianteId, -i.cant, 'venta', '', ve.id));
    mb.t = {};
    mb.d = {};
    render();
    ui.deshacer(`Cobrado ${$(total)} (${mb.pago === 'Tarjeta' ? 'tarjeta' : 'efectivo'})`, copia);
  }
  function abrir() {
    crear();
    mb.t = {};
    mb.d = {};
    mb.pago = 'Efectivo';
    mb.cat = 'todos';
    g('mbq').value = '';
    g('mbe').innerHTML = `<option value="">Sin bazar (caja general)</option>` + db.all('eventos').map(e => `<option value="${e.id}">🎪 ${E(e.nombre)}</option>`).join('');
    g('mbz').classList.add('open');
    document.body.classList.add('mb-activo');
    render();
  }
  function cerrar() {
    const o = g('mbz');
    if (o)
      o.classList.remove('open');
    document.body.classList.remove('mb-activo');
  }
  CC.bazar = {
    abrir,
    cerrar
  };
})();
