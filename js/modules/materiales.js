// Materiales por grupo (recuadros) con stock; las recetas de pines y stickers los consumen.
(() => {
  const { db, ui } = CC, E = ui.esc, G = ['Pines', 'Stickers', 'Empaque', 'Otros'];
  const usos = m => db.all('variantes').filter(v => (v.receta || []).some(r => r.materialId === m.id));
  function form(m = {}, g) {
    ui.modal(m.id ? 'Editar material' : 'Nuevo material', ui.inp('nombre', 'Nombre (alfileres, vinil mate…)', m.nombre) +
      `<div class="grid2"><label>Grupo<select class="inp" name="grupo">${G.map(x => `<option ${x === (m.grupo || g) ? 'selected' : ''}>${x}</option>`).join('')}</select></label>${ui.inp('unidad', 'Unidad (pzs, hojas, m)', m.unidad || 'pzs')}</div>
       <div class="grid3">${ui.inp('stock', 'Stock', m.stock, 'number', 'step="0.01"')}${ui.inp('costo', 'Costo por unidad', m.costo, 'number', 'step="0.0001"')}${ui.inp('minimo', 'Mínimo', m.minimo, 'number')}</div>`, el => {
      const o = ui.vals(el); if (!o.nombre.trim()) { ui.toast('Falta el nombre'); return false; }
      const d = { nombre: o.nombre.trim(), grupo: o.grupo, unidad: o.unidad || 'pzs', stock: +o.stock || 0, costo: +o.costo || 0, minimo: +o.minimo || 0 };
      m.id ? db.update('materiales', m.id, d) : db.add('materiales', d); CC.router.show(); });
  }
  const ajustar = m => ui.modal('Ajustar ' + E(m.nombre), ui.inp('cant', 'Cantidad (+ entra, − sale)', '', 'number', 'step="0.01"'), el => {
    const c = +ui.vals(el).cant; if (!c) return false; db.update('materiales', m.id, { stock: Math.max(0, m.stock + c) }); CC.router.show(); });
  const ver = m => ui.detalle({ icon: '🧵', title: m.nombre, sub: m.grupo, secciones: [
    { t: 'Existencias', f: [['Stock', m.stock + ' ' + m.unidad, m.minimo && m.stock <= m.minimo ? 'bad' : ''], ['Costo por unidad', ui.money(m.costo)], ['Valor en stock', ui.money(m.stock * m.costo)]] },
    { t: 'Se usa en', f: usos(m).length ? usos(m).map(v => [CC.nombreVar(v), v.receta.find(r => r.materialId === m.id).cant + ' ' + m.unidad + ' por pieza']) : [['Aún no está en ninguna receta', '']] }],
    acciones: [{ label: '± Stock', fn: () => ajustar(m) }, { label: '✏️ Editar', ghost: 1, fn: () => form(m) }] });

  CC.router.register('materiales', 'Materiales', '🧵', el => {
    const ms = db.all('materiales');
    el.innerHTML = `<div class="bar"><button class="btn" id="n">+ Material</button><span class="mute">El material se descuenta al terminar una producción (Inventario → En proceso → Terminar).</span></div>` +
      G.map(g => `<div class="card"><div class="bar"><h3 style="margin:0;flex:1">${g}</h3><button class="btn ghost sm" data-n="${g}">＋ Agregar</button></div><div class="cards">` +
        (ms.filter(m => m.grupo === g).map(m => { const bajo = m.minimo && m.stock <= m.minimo;
          return `<div class="pcard"><div class="pb"><b>${E(m.nombre)}</b><div class="${bajo ? 'neg' : ''}" style="font:800 1.4rem var(--font-display)">${m.stock} <small class="mute">${E(m.unidad)}</small></div><div class="mute">${ui.money(m.costo)} por ${E(m.unidad)}${bajo ? ' · Resurtir' : ''}</div>
            <div class="bar" style="margin:8px 0 0"><button class="btn sm" data-v="${m.id}">Ver más</button><button class="btn ghost sm" data-s="${m.id}">± Stock</button></div></div></div>`; }).join('') || '<p class="mute">Sin materiales en este grupo.</p>') + '</div></div>').join('');
    el.onclick = e => { const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'n') form(); else if (b.dataset.n) form({}, b.dataset.n); else if (b.dataset.v) ver(db.get('materiales', b.dataset.v)); else if (b.dataset.s) ajustar(db.get('materiales', b.dataset.s)); };
  });
})();
