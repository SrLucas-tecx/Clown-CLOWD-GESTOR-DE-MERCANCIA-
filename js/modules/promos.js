// Precios por cantidad («3 por $90») y combos. Los usa el modo bazar y la lista de precios.
(() => {
  const { db, ui } = CC, E = ui.esc, $ = ui.money;
  CC.linea = (v, cant) => { const p = v.precio || 0; if (v.escCant > 1 && v.escTotal > 0 && v.escTotal / v.escCant < p) { const k = Math.floor(cant / v.escCant); return k * v.escTotal + (cant - k * v.escCant) * p; } return cant * p; };
  CC.comboSuma = c => c.items.reduce((s, i) => s + ((db.get('variantes', i.varianteId) || {}).precio || 0) * i.cant, 0);
  CC.comboMax = c => Math.min(...c.items.map(i => Math.floor(Math.max(0, CC.stock(i.varianteId)) / i.cant)));
  function form() {
    const vs = db.all('variantes'); if (vs.length < 2) return ui.toast('Necesitas al menos 2 productos para armar un combo');
    const linea = () => `<div class="cl2" style="display:grid;grid-template-columns:3fr 1fr;gap:8px;margin-bottom:8px"><select class="inp lv">${vs.map(v => `<option value="${v.id}">${E(CC.nombreVar(v))}</option>`).join('')}</select><input class="inp lq" type="number" min="1" value="1"></div>`;
    ui.modal('Nuevo combo', ui.inp('nombre', 'Nombre (ej. Combo gatos)') + ui.inp('precio', 'Precio del combo', '', 'number', 'step="0.01"') + `<label>Productos del combo</label><div id="ls">${linea()}${linea()}</div><button type="button" class="btn ghost sm" id="al">＋ Agregar producto</button><div class="card" id="cp" style="margin:12px 0 0;font-size:.85rem"></div>`, m => {
      const e = est(); if (e.error) { ui.toast(e.error); return false; } db.add('combos', { nombre: ui.vals(m).nombre.trim(), precio: e.precio, items: e.items }); ui.toast('Combo creado'); CC.router.show(); });
    const root = document.getElementById('modal'), q = s => root.querySelector(s);
    const est = () => {
      const items = [...root.querySelectorAll('.cl2')].map(r => ({ varianteId: r.querySelector('.lv').value, cant: Math.floor(+r.querySelector('.lq').value) || 0 })).filter(i => i.cant), precio = +q('[name=precio]').value || 0, suma = items.reduce((s, i) => s + (db.get('variantes', i.varianteId).precio || 0) * i.cant, 0); let error = '';
      if (!q('[name=nombre]').value.trim()) error = 'Ponle un nombre al combo.'; else if (items.length < 2) error = 'Un combo necesita al menos 2 productos.';
      else if (new Set(items.map(i => i.varianteId)).size < items.length) error = 'Hay un producto repetido: usa una sola línea con más cantidad.';
      else if (!(precio > 0)) error = 'Pon el precio del combo.'; else if (precio >= suma) error = `No se puede: el combo debe costar menos que comprar las piezas por separado (${$(suma)}).`;
      return { items, precio, suma, error };
    };
    const calc = () => { if (!q('#cp')) return; const e = est(); q('#cp').innerHTML = e.error ? `<span class="neg">${E(e.error)}</span>` : `Por separado <b>${$(e.suma)}</b> → combo <b>${$(e.precio)}</b>: el cliente ahorra <b>${$(e.suma - e.precio)}</b>.`; };
    root.oninput = root.onchange = calc; q('#al').onclick = () => q('#ls').insertAdjacentHTML('beforeend', linea()); calc();
  }
  CC.router.register('promos', 'Promociones', '🎁', el => {
    const cs = db.all('combos'), tiers = db.all('variantes').filter(v => v.escCant > 1 && v.escTotal > 0);
    el.innerHTML = `<div class="bar"><button class="btn" id="n">+ Combo</button><span class="mute">Los precios por cantidad («3 por $90») se definen en Catálogo → Editar. Aquí armas combos de varios productos.</span></div>
      <div class="card"><h3>Precios por cantidad</h3>${tiers.map(v => `<div class="line"><span>${E(CC.nombreVar(v))}</span><b>${v.escCant} por ${$(v.escTotal)} <span class="mute">(normal ${$(v.precio)} c/u)</span></b></div>`).join('') || '<p class="mute">Ninguno todavía.</p>'}</div>
      <div class="cards">${cs.map(c => `<div class="pcard"><div class="pb"><b>🎁 ${E(c.nombre)}</b><div style="font:800 1.5rem var(--font-display)">${$(c.precio)}</div><div class="mute">Por separado ${$(CC.comboSuma(c))}</div>${c.items.map(i => `<div class="line"><span>${i.cant} × ${E(CC.nombreVar(db.get('variantes', i.varianteId) || {}))}</span></div>`).join('')}<div class="mute">Se pueden armar ${CC.comboMax(c)}</div><div class="bar" style="margin:8px 0 0"><button class="btn ghost sm" data-d="${c.id}">Eliminar</button></div></div></div>`).join('') || '<p class="mute">Aún no hay combos.</p>'}</div>`;
    el.querySelector('#n').onclick = form;
    el.onclick = e => { const b = e.target.closest('[data-d]'); if (b) ui.confirm('¿Eliminar este combo?').then(ok => { if (ok) { const copia = JSON.stringify(db.crudo()); db.remove('combos', b.dataset.d); CC.router.show(); ui.deshacer('Combo eliminado.', copia); } }); };
  });
})();
