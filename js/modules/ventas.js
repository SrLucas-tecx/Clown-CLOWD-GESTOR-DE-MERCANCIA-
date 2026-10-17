// Venta rápida táctil. El precio y el costo se congelan en cada venta; anular regresa el stock.
(() => {
  const { db, ui } = CC, E = ui.esc;
  let cart = [];
  CC.ventasOk = () => db.all('ventas').filter(v => !v.anulada);
  CC.utilidad = vs => vs.reduce((s, v) => s + v.items.reduce((a, i) => a + (i.precio - i.costo) * i.cant, 0), 0);

  CC.router.register('ventas', 'Venta', '🛒', el => {
    const vs = db.all('variantes'), evs = db.all('eventos');
    el.innerHTML = `<div class="pos"><section><input class="inp" id="q" placeholder="Buscar producto…"><div class="tiles" id="tiles"></div></section>
      <div class="card"><h3>Venta actual</h3><div id="cart"></div><div class="tot"><span>Total</span><b id="tot"></b></div>
      <label>Pago<select class="inp" id="pay"><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option></select></label>
      <label>Bazar / evento<select class="inp" id="ev"><option value="">Sin evento</option>${evs.map(e => `<option value="${e.id}">${E(e.nombre)}</option>`).join('')}</select></label>
      <label>Cliente (opcional)<select class="inp" id="cl"><option value="">Sin cliente</option>${db.all('clientes').map(c => `<option value="${c.id}">${E(c.nombre)}</option>`).join('')}</select></label>
      <button class="btn ghost sm" id="nc" type="button">＋ Cliente nuevo</button>
      <button class="btn big" id="ok">Cobrar</button></div></div>
      <div class="card"><h3>Últimas ventas</h3><div id="hist"></div></div>`;
    const $ = s => el.querySelector(s);
    const tiles = () => { const q = $('#q').value.toLowerCase();
      $('#tiles').innerHTML = vs.filter(v => CC.nombreVar(v).toLowerCase().includes(q)).map(v => { const p = db.get('productos', v.productoId) || {};
        return `<button class="tile" data-id="${v.id}"><b>${E(CC.nombreVar(v))}</b><div class="mute">${ui.money(v.precio)} · ${CC.stock(v.id)} pzs</div></button>`; }).join('') || '<p class="mute">Agrega productos en el Catálogo.</p>'; };
    const paint = () => { $('#cart').innerHTML = cart.map((i, n) => `<div class="line"><span>${E(i.nombre)}</span><span><button class="btn ghost sm" data-m="${n}">−</button> ${i.cant} <button class="btn ghost sm" data-p="${n}">+</button> ${ui.money(i.precio * i.cant)}</span></div>`).join('') || '<p class="mute">Toca un producto para agregarlo.</p>';
      $('#tot').textContent = ui.money(cart.reduce((s, i) => s + i.precio * i.cant, 0)); };
    const hist = () => { $('#hist').innerHTML = `<table><tbody>${db.all('ventas').slice(-10).reverse().map(v => `<tr class="${v.anulada ? 'mute' : ''}"><td>${v.fecha}</td><td>${v.items.map(i => i.cant + '× ' + E(i.nombre)).join(', ')}</td><td>${v.pago}</td><td>${ui.money(v.total)}</td><td class="end">${v.anulada ? 'Anulada' : `<button class="btn ghost sm" data-x="${v.id}">Anular</button>`}</td></tr>`).join('') || '<tr><td class="mute">Aún no hay ventas.</td></tr>'}</tbody></table>`; };
    tiles(); paint(); hist();
    $('#q').oninput = tiles;
    $('#tiles').onclick = e => { const t = e.target.closest('.tile'); if (!t) return; const v = db.get('variantes', t.dataset.id), l = cart.find(i => i.varianteId === v.id);
      if ((l ? l.cant : 0) + 1 > CC.stock(v.id)) return ui.toast(`No hay suficiente "${CC.nombreVar(v)}": quedan ${Math.max(0, CC.stock(v.id))}`);
      l ? l.cant++ : cart.push({ varianteId: v.id, nombre: CC.nombreVar(v), cant: 1, precio: v.precio, costo: v.costo }); paint(); };
    $('#cart').onclick = e => { const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.p) { const i = cart[b.dataset.p]; if (i.cant + 1 > CC.stock(i.varianteId)) return ui.toast(`Solo quedan ${Math.max(0, CC.stock(i.varianteId))} de "${i.nombre}"`); i.cant++; } else if (--cart[b.dataset.m].cant <= 0) cart.splice(b.dataset.m, 1); paint(); };
    $('#nc').onclick = () => CC.clienteForm();
    $('#ok').onclick = () => { if (!cart.length) return ui.toast('La venta está vacía');
      const sinStock = cart.find(i => i.cant > CC.stock(i.varianteId)); if (sinStock) return ui.toast(`No se puede cobrar: "${sinStock.nombre}" ya no tiene stock suficiente`);
      const venta = db.add('ventas', { items: cart, total: cart.reduce((s, i) => s + i.precio * i.cant, 0), pago: $('#pay').value, eventoId: $('#ev').value, clienteId: $('#cl').value, fecha: ui.hoy() });
      if (venta.pago === 'Tarjeta') db.update('ventas', venta.id, { comision: venta.total * ui.cfg.comision() / 100 });
      cart.forEach(i => CC.mover(i.varianteId, -i.cant, 'venta', '', venta.id)); cart = []; ui.toast('Venta registrada'); CC.router.show(); };
    $('#hist').onclick = e => { const b = e.target.closest('[data-x]'); if (!b) return; const v = db.get('ventas', b.dataset.x);
      db.update('ventas', v.id, { anulada: true }); v.items.forEach(i => CC.mover(i.varianteId, i.cant, 'anulación', 'Venta anulada', v.id)); ui.toast('Venta anulada'); CC.router.show(); };
  });
})();
