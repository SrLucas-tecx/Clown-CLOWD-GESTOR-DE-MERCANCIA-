// Productos y variantes (con foto, SKU, costo, precio y mínimo).
(() => {
  const { db, ui } = CC, E = ui.esc, inp = ui.inp;
  const suma = (id, f) => db.all('movimientos').filter(m => m.varianteId === id && f(m.tipo)).reduce((s, m) => s + m.cant, 0);
  CC.stock = id => suma(id, t => t !== 'proceso');
  CC.enProceso = id => suma(id, t => t === 'proceso');
  CC.vendidos = id => -suma(id, t => t === 'venta' || t === 'anulación');
  CC.nombreVar = v => { const p = db.get('productos', v.productoId); return (p ? p.producto : '?') + (v.nombre ? ' · ' + v.nombre : ''); };
  const varForm = (v = {}) => inp('nombre', 'Variante (ej. 1.5" epoxi)', v.nombre) + inp('sku', 'SKU', v.sku) +
    `<div class="grid3">${inp('costo', 'Costo', v.costo, 'number', 'step="0.01"')}${inp('precio', 'Precio', v.precio, 'number', 'step="0.01"')}${inp('minimo', 'Mínimo', v.minimo, 'number')}</div>${inp('extra', 'Empaque / extras por pieza ($)', v.extra, 'number', 'step="0.01"')}`;
  const num = o => ({ nombre: o.nombre, sku: o.sku, costo: +o.costo || 0, precio: +o.precio || 0, minimo: +o.minimo || 0, extra: +o.extra || 0 });

  function nuevo(pre = {}) {
    const cats = [...new Set(db.all('productos').map(p => p.categoria))];
    ui.modal('Nuevo producto', inp('producto', 'Nombre del diseño') +
      `<div class="grid2"><label>Categoría<input class="inp" name="categoria" list="cats" placeholder="Pines, stickers…" value="${E(pre.categoria || '')}"><datalist id="cats">${cats.map(c => `<option>${E(c)}</option>`).join('')}</datalist></label>${inp('coleccion', 'Temática / colección', pre.coleccion, 'text', 'list="temasl"')}<datalist id="temasl">${db.all('temas').map(t => `<option>${E(t.nombre)}</option>`).join('')}</datalist></div>
       <label>Etiquetas</label>` + CC.tags.picker('producto') + varForm() + inp('stock', 'Stock inicial', '', 'number'), m => {
      const o = ui.vals(m); if (!o.producto.trim()) { ui.toast('Falta el nombre'); return false; }
      const p = db.add('productos', { producto: o.producto.trim(), categoria: o.categoria, coleccion: o.coleccion, etiquetas: CC.tags.leer(m) });
      const v = db.add('variantes', { productoId: p.id, ...num(o) });
      if (+o.stock > 0) CC.mover(v.id, +o.stock, 'entrada', 'Stock inicial');
      CC.router.show();
    });
    CC.tags.bind(document.getElementById('modal'));
  }
  CC.nuevoProducto = nuevo;
  const variante = (productoId, v) => ui.modal(v ? 'Editar variante' : 'Nueva variante', varForm(v), m => {
    const o = num(ui.vals(m)); v ? db.update('variantes', v.id, o) : db.add('variantes', { productoId, ...o }); CC.router.show();
  });

  // Receta: qué materiales usa cada pieza. El costo por pieza se calcula con ellos.
  CC.faltantes = (id, n) => (db.get('variantes', id).receta || []).map(r => { const m = db.get('materiales', r.materialId); return m && m.stock < r.cant * n ? `${m.nombre} (necesitas ${+(r.cant * n).toFixed(2)}, hay ${m.stock})` : null; }).filter(Boolean);
  CC.puedeHacer = v => { const r = (v.receta || []).filter(x => db.get('materiales', x.materialId));
    return r.length ? Math.min(...r.map(x => Math.floor(db.get('materiales', x.materialId).stock / x.cant))) : null; };
  function receta(v) {
    const mats = db.all('materiales'); if (!mats.length) return ui.toast('Primero agrega materiales en Inventario → Materiales');
    const fila = (r = {}) => `<div class="grid2 cr"><select class="inp rm">${mats.map(m => `<option value="${m.id}" ${m.id === r.materialId ? 'selected' : ''}>${E(m.nombre)} (${E(m.unidad)})</option>`).join('')}</select><input class="inp rc" type="number" step="0.01" placeholder="Cantidad por pieza" value="${r.cant || ''}"></div>`;
    ui.modal('Materiales de ' + E(CC.nombreVar(v)), `<p class="mute">Lo que gasta cada pieza. El costo se calcula solo y el material se descuenta al terminar una producción.</p><div id="rf">${(v.receta && v.receta.length ? v.receta : [{}]).map(r => fila(r)).join('')}</div><button type="button" class="btn ghost sm" id="ra">＋ Agregar material</button>`, m => {
      const rc = [...m.querySelectorAll('.cr')].map(r => ({ materialId: r.querySelector('.rm').value, cant: +r.querySelector('.rc').value || 0 })).filter(r => r.cant > 0);
      const d = { receta: rc }; if (rc.length) d.costo = Math.round(rc.reduce((s, r) => s + db.get('materiales', r.materialId).costo * r.cant, 0) * 100) / 100;
      db.update('variantes', v.id, d); CC.router.show(); });
    document.getElementById('ra').onclick = () => document.getElementById('rf').insertAdjacentHTML('beforeend', fila());
  }
  CC.router.register('catalogo', 'Catálogo', '🏷️', el => {
    const vs = db.all('variantes');
    el.innerHTML = `<div class="bar"><input class="inp" id="q" placeholder="Buscar producto…"><button class="btn" id="nuevo">+ Producto</button></div>
      <div class="card"><table><thead><tr><th>Producto</th><th>Stock</th><th>Costo</th><th>Precio</th><th>Margen</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>`;
    const draw = () => {
      const q = el.querySelector('#q').value.toLowerCase();
      el.querySelector('#rows').innerHTML = vs.filter(v => CC.nombreVar(v).toLowerCase().includes(q)).map(v => {
        const p = db.get('productos', v.productoId) || {}, mg = v.precio ? Math.round((v.precio - v.costo) / v.precio * 100) : 0;
        return `<tr><td><b>${E(CC.nombreVar(v))}</b><div class="mute">${E(p.categoria || '')} ${E(v.sku || '')} ${v.origen === 'reventa' ? '<span class="chip" style="--c:#4dabf7">Reventa</span>' : ''}</div></td>
          <td>${CC.stock(v.id)}</td><td>${ui.money(v.costo)}</td><td>${ui.money(v.precio)}</td><td>${mg}%</td>
          <td class="end"><button class="btn ghost sm" data-e="${v.id}">Editar</button> ${v.origen === 'reventa' ? '' : `<button class="btn ghost sm" data-r="${v.id}">Materiales</button>`} <button class="btn ghost sm" data-a="${v.productoId}">+ Variante</button></td></tr>`;
      }).join('') || '<tr><td colspan="7" class="mute">Aún no hay productos. Crea el primero con «+ Producto».</td></tr>';
    };
    draw(); el.querySelector('#q').oninput = draw; el.querySelector('#nuevo').onclick = () => nuevo();
    el.querySelector('#rows').onclick = e => { const b = e.target.closest('button'); if (!b) return;
      b.dataset.e ? variante(null, db.get('variantes', b.dataset.e)) : b.dataset.r ? receta(db.get('variantes', b.dataset.r)) : variante(b.dataset.a); };
  });
})();
