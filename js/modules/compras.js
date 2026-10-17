// Compras por lote (productos de reventa): reparte el descuento y el envío entre los lotes,
// calcula el costo real por pieza y el costo promedio cuando se compra de nuevo el mismo producto.
(() => {
  const { db, ui } = CC, E = ui.esc, $ = ui.money, norm = s => String(s || '').trim().toLowerCase(), r2 = x => Math.round(x * 100) / 100;

  // d = { fecha, proveedor, pagado, lineas: [{ id (variante existente o ''), nombre, cat, cant, lista }] }
  CC.recibirCompra = d => {
    const lista = d.lineas.reduce((s, l) => s + l.lista, 0), f = lista ? d.pagado / lista : 1;
    const lineas = d.lineas.map(l => {
      let v = l.id ? db.get('variantes', l.id) : null;
      if (!v) { const p = db.add('productos', { producto: l.nombre, categoria: l.cat, coleccion: '', etiquetas: [] }); v = db.add('variantes', { productoId: p.id, nombre: '', sku: '', costo: 0, precio: 0, minimo: 0, receta: [], origen: 'reventa' }); }
      const real = r2(l.lista * f), s = Math.max(0, CC.stock(v.id)), antes = v.costo || 0;
      const despues = s && antes ? r2((s * antes + real) / (s + l.cant)) : r2(real / l.cant);
      db.update('variantes', v.id, { costo: despues, origen: 'reventa' });
      return { varianteId: v.id, nombre: CC.nombreVar(db.get('variantes', v.id)), cant: l.cant, lista: l.lista, real, costoAntes: antes, costoDespues: despues };
    });
    const c = db.add('compras', { fecha: d.fecha, proveedor: d.proveedor || '', pagado: d.pagado, lista, lineas });
    lineas.forEach(l => CC.mover(l.varianteId, l.cant, 'entrada', 'Compra', c.id));
    return c;
  };

  function form() {
    const vs = db.all('variantes').filter(v => !(v.receta || []).length), cats = [...new Set(db.all('productos').map(p => p.categoria).filter(Boolean))];
    const nombreDe = id => id ? CC.nombreVar(db.get('variantes', id)) : '';
    const linea = () => `<div class="cl card" style="padding:12px;margin-bottom:10px"><select class="inp lv"><option value="">➕ Producto nuevo</option>${vs.map(v => `<option value="${v.id}">${E(CC.nombreVar(v))}</option>`).join('')}</select>
      <div class="grid2 ln" style="margin-top:8px"><input class="inp lnm" placeholder="Nombre (ej. Pinzas kawaii)"><input class="inp lct" list="catsc" placeholder="Categoría (Pinzas, Llaveros…)"></div>
      <div class="grid2" style="margin-top:8px"><input class="inp lq" type="number" placeholder="Cantidad"><input class="inp lc" type="number" step="0.01" placeholder="Costo del lote (lista)"></div></div>`;
    ui.modal('Nueva compra por lote', `${ui.inp('proveedor', 'Proveedor o tienda')}<div class="grid2">${ui.inp('fecha', 'Fecha', ui.hoy(), 'date')}${ui.inp('pagado', 'Total pagado (con descuento y envío)', '', 'number', 'step="0.01"')}</div>
      <datalist id="catsc">${cats.map(c => `<option>${E(c)}</option>`).join('')}</datalist><label>Productos del lote</label><div id="ls">${linea()}</div><button type="button" class="btn ghost sm" id="al">＋ Agregar producto</button><div class="card" id="cp" style="margin:12px 0 0;font-size:.85rem"></div>`, m => {
      const e = est(); if (e.error) { ui.toast(e.error); return false; }
      const o = ui.vals(m), copia = JSON.stringify(db.crudo()), c = CC.recibirCompra({ fecha: o.fecha, proveedor: o.proveedor, pagado: e.pag, lineas: e.lin });
      ui.deshacer(`Compra registrada: ${c.lineas.reduce((s, l) => s + l.cant, 0)} piezas por ${$(c.pagado)}.`, copia); CC.router.show(); });
    const root = document.getElementById('modal'), q = s => root.querySelector(s);
    const est = () => {
      const lin = [...root.querySelectorAll('.cl')].map(r => ({ id: r.querySelector('.lv').value, nombre: r.querySelector('.lnm').value.trim(), cat: r.querySelector('.lct').value.trim(), cant: +r.querySelector('.lq').value || 0, lista: +r.querySelector('.lc').value || 0 })).filter(l => l.id || l.nombre || l.cant || l.lista);
      const lista = lin.reduce((s, l) => s + l.lista, 0), raw = q('[name=pagado]').value, pag = raw === '' ? lista : +raw || 0, f = lista ? pag / lista : 1;
      const ids = lin.filter(l => l.id).map(l => l.id), nom = lin.filter(l => !l.id).map(l => norm(l.nombre)); let error = '';
      if (!lin.length) error = 'Agrega al menos un producto a la compra.';
      else if (lin.some(l => !l.id && !l.nombre)) error = 'Falta el nombre de un producto nuevo.';
      else if (lin.some(l => l.cant <= 0 || l.lista <= 0)) error = 'Cada producto necesita cantidad y costo del lote.';
      else if (new Set(ids).size < ids.length || new Set(nom).size < nom.length) error = 'Hay un producto repetido: junta sus cantidades en una sola línea.';
      else if (lin.some(l => !l.id && db.all('productos').some(p => norm(p.producto) === norm(l.nombre)))) error = 'Ese producto ya existe: elígelo en la lista en vez de crearlo nuevo.';
      else if (!(pag > 0)) error = 'El total pagado debe ser mayor a 0.';
      return { lin, lista, pag, f, error };
    };
    const calc = () => { if (!q('#cp')) return; const e = est();
      q('#cp').innerHTML = e.error ? `<span class="neg">${E(e.error)}</span>` : `Lo listado suma <b>${$(e.lista)}</b> y pagaste <b>${$(e.pag)}</b>: ${e.f < 1 ? `el descuento deja cada lote en <b>${Math.round(e.f * 100)}%</b> de su precio de lista` : e.f > 1 ? `el envío o cargos extra suben cada lote a <b>${Math.round(e.f * 100)}%</b> de su precio de lista` : 'sin descuento ni envío'}.${e.lin.map(l => `<br>${E(l.nombre || nombreDe(l.id))}: <b>${$(l.lista * e.f / l.cant)}</b> por pieza`).join('')}`; };
    root.oninput = calc; root.onchange = e => { if (e.target.classList.contains('lv')) e.target.closest('.cl').querySelector('.ln').style.display = e.target.value ? 'none' : ''; calc(); };
    q('#al').onclick = () => q('#ls').insertAdjacentHTML('beforeend', linea()); calc();
  }
  function ver(c) {
    const f = c.lista ? c.pagado / c.lista : 1;
    ui.detalle({ icon: '🧾', title: `Compra del ${c.fecha}`, sub: c.proveedor || 'Sin proveedor', secciones: [
      { t: 'Resumen', f: [['Lo listado', $(c.lista)], ['Lo que pagaste', $(c.pagado)], ['Descuento / envío', (c.pagado - c.lista >= 0 ? '+ ' : '− ') + $(Math.abs(c.pagado - c.lista)), c.pagado <= c.lista ? 'good' : 'bad'], ['Cada lote costó', Math.round(f * 100) + '% de su lista']] },
      { t: 'Productos', f: c.lineas.map(l => [`${l.nombre} (${l.cant})`, `${$(l.real / l.cant)} c/u`]) },
      { t: 'Costo promedio resultante', f: c.lineas.map(l => [l.nombre, `${$(l.costoAntes)} → ${$(l.costoDespues)}`]) }],
      acciones: c.anulada ? [] : [{ label: '↩️ Anular compra', ghost: 1, fn: () => anular(c) }] });
  }
  function anular(c) {
    const sin = c.lineas.find(l => CC.stock(l.varianteId) < l.cant);
    if (sin) return ui.toast(`No se puede anular: de "${sin.nombre}" ya se vendieron o sacaron piezas de este lote (quedan ${Math.max(0, CC.stock(sin.varianteId))} de ${sin.cant})`);
    ui.confirm('Se quitarán del inventario las piezas de este lote.', 'Anular compra').then(ok => {
      if (!ok) return; const copia = JSON.stringify(db.crudo());
      c.lineas.forEach(l => { CC.mover(l.varianteId, -l.cant, 'ajuste', 'Compra anulada', c.id); const v = db.get('variantes', l.varianteId); if (v && v.costo === l.costoDespues) db.update('variantes', v.id, { costo: l.costoAntes }); });
      db.update('compras', c.id, { anulada: true }); CC.router.show(); ui.deshacer('Compra anulada.', copia); });
  }

  CC.router.register('compras', 'Compras', '🧾', el => {
    const cs = db.all('compras').slice().reverse(), ok = cs.filter(c => !c.anulada);
    const k = (t, b) => `<div class="kpi"><small>${t}</small><b>${b}</b></div>`;
    el.innerHTML = `<div class="bar"><button class="btn" id="n">+ Compra por lote</button><span class="mute">Para lo que compras ya hecho (llaveros, pinzas, pines…). El descuento y el envío se reparten entre los lotes.</span></div>
      <div class="kpis">${k('Inversión en compras', $(ok.reduce((s, c) => s + c.pagado, 0)))}${k('Piezas compradas', ok.reduce((s, c) => s + c.lineas.reduce((a, l) => a + l.cant, 0), 0))}${k('Compras registradas', ok.length)}</div>` +
      (cs.map(c => `<div class="card ${c.anulada ? 'mute' : ''}"><div class="bar"><div style="flex:1"><h3 style="margin:0">${c.fecha}${c.proveedor ? ' · ' + E(c.proveedor) : ''}${c.anulada ? ' (anulada)' : ''}</h3><span class="mute">${c.lineas.length} producto(s) · ${c.lineas.reduce((s, l) => s + l.cant, 0)} piezas</span></div><b>${$(c.pagado)}</b><button class="btn sm" data-v="${c.id}">Ver más</button></div></div>`).join('') || '<p class="mute">Aún no hay compras. Registra la primera con «+ Compra por lote».</p>');
    el.querySelector('#n').onclick = form;
    el.onclick = e => { const b = e.target.closest('[data-v]'); if (b) ver(db.get('compras', b.dataset.v)); };
  });
})();
