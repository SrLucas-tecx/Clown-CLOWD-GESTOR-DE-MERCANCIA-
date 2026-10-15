// Productos y variantes (con foto, SKU, costo, precio y mínimo).
(() => {
  const { db, ui } = CC, E = ui.esc, inp = ui.inp;
  CC.stock = id => db.all('movimientos').filter(m => m.varianteId === id).reduce((s, m) => s + m.cant, 0);
  CC.nombreVar = v => { const p = db.get('productos', v.productoId); return (p ? p.producto : '?') + (v.nombre ? ' · ' + v.nombre : ''); };
  const varForm = (v = {}) => inp('nombre', 'Variante (ej. 1.5" epoxi)', v.nombre) + inp('sku', 'SKU', v.sku) +
    `<div class="grid3">${inp('costo', 'Costo', v.costo, 'number', 'step="0.01"')}${inp('precio', 'Precio', v.precio, 'number', 'step="0.01"')}${inp('minimo', 'Mínimo', v.minimo, 'number')}</div>`;
  const num = o => ({ nombre: o.nombre, sku: o.sku, costo: +o.costo || 0, precio: +o.precio || 0, minimo: +o.minimo || 0 });

  function nuevo() {
    let foto = ''; const cats = [...new Set(db.all('productos').map(p => p.categoria))];
    ui.modal('Nuevo producto', inp('producto', 'Nombre del diseño') +
      `<div class="grid2"><label>Categoría<input class="inp" name="categoria" list="cats" placeholder="Pines, stickers…"><datalist id="cats">${cats.map(c => `<option>${E(c)}</option>`).join('')}</datalist></label>${inp('coleccion', 'Colección / serie')}</div>
       <label>Foto<input type="file" accept="image/*" id="foto"></label>` + varForm() + inp('stock', 'Stock inicial', '', 'number'), m => {
      const o = ui.vals(m); if (!o.producto.trim()) { ui.toast('Falta el nombre'); return false; }
      const p = db.add('productos', { producto: o.producto.trim(), categoria: o.categoria, coleccion: o.coleccion, foto });
      const v = db.add('variantes', { productoId: p.id, ...num(o) });
      if (+o.stock > 0) CC.mover(v.id, +o.stock, 'entrada', 'Stock inicial');
      CC.router.show();
    });
    document.getElementById('foto').onchange = e => ui.thumb(e.target.files[0], d => foto = d);
  }
  const variante = (productoId, v) => ui.modal(v ? 'Editar variante' : 'Nueva variante', varForm(v), m => {
    const o = num(ui.vals(m)); v ? db.update('variantes', v.id, o) : db.add('variantes', { productoId, ...o }); CC.router.show();
  });

  CC.router.register('catalogo', 'Catálogo', '🏷️', el => {
    const vs = db.all('variantes');
    el.innerHTML = `<div class="bar"><input class="inp" id="q" placeholder="Buscar producto…"><button class="btn" id="nuevo">+ Producto</button></div>
      <div class="card"><table><thead><tr><th></th><th>Producto</th><th>Stock</th><th>Costo</th><th>Precio</th><th>Margen</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>`;
    const draw = () => {
      const q = el.querySelector('#q').value.toLowerCase();
      el.querySelector('#rows').innerHTML = vs.filter(v => CC.nombreVar(v).toLowerCase().includes(q)).map(v => {
        const p = db.get('productos', v.productoId) || {}, mg = v.precio ? Math.round((v.precio - v.costo) / v.precio * 100) : 0;
        return `<tr><td>${p.foto ? `<img class="th" src="${p.foto}">` : '<div class="th ph"></div>'}</td>
          <td><b>${E(CC.nombreVar(v))}</b><div class="mute">${E(p.categoria || '')} ${E(v.sku || '')}</div></td>
          <td>${CC.stock(v.id)}</td><td>${ui.money(v.costo)}</td><td>${ui.money(v.precio)}</td><td>${mg}%</td>
          <td class="end"><button class="btn ghost sm" data-e="${v.id}">Editar</button> <button class="btn ghost sm" data-a="${v.productoId}">+ Variante</button></td></tr>`;
      }).join('') || '<tr><td colspan="7" class="mute">Aún no hay productos. Crea el primero con «+ Producto».</td></tr>';
    };
    draw(); el.querySelector('#q').oninput = draw; el.querySelector('#nuevo').onclick = nuevo;
    el.querySelector('#rows').onclick = e => { const b = e.target.closest('button'); if (!b) return;
      b.dataset.e ? variante(null, db.get('variantes', b.dataset.e)) : variante(b.dataset.a); };
  });
})();
