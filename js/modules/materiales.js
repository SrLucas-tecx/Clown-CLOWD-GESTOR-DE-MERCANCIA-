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
      m.id ? (db.update('materiales', m.id, d), CC.recalcular(m.id)) : db.add('materiales', d); CC.router.show(); });
  }
  const ajustar = m => ui.modal('Ajustar ' + E(m.nombre), ui.inp('cant', 'Cantidad (+ entra, − sale)', '', 'number', 'step="0.01"'), el => {
    const c = +ui.vals(el).cant; if (!c) return false;
    if (m.stock + c < 0) { ui.toast(`No se puede sacar ${-c}: solo hay ${m.stock} ${m.unidad}`); return false; } db.update('materiales', m.id, { stock: Math.max(0, m.stock + c) }); CC.router.show(); });
  const ver = m => ui.detalle({ icon: '🧵', title: m.nombre, sub: m.grupo, secciones: [
    { t: 'Existencias', f: [['Stock', m.stock + ' ' + m.unidad, m.minimo && m.stock <= m.minimo ? 'bad' : ''], ['Costo por unidad', ui.money(m.costo)], ['Valor en stock', ui.money(m.stock * m.costo)]] },
    { t: 'Se usa en', f: usos(m).length ? usos(m).map(v => [CC.nombreVar(v), v.receta.find(r => r.materialId === m.id).cant + ' ' + m.unidad + ' por pieza']) : [['Aún no está en ninguna receta', '']] }],
    acciones: [{ label: '🧮 Dividir costo', fn: () => dividir(m.id) }, { label: '± Stock', ghost: 1, fn: () => ajustar(m) }, { label: '✏️ Editar', ghost: 1, fn: () => form(m) }] });

  CC.recalcular = id => db.all('variantes').filter(v => (v.receta || []).some(r => r.materialId === id)).forEach(v =>
    db.update('variantes', v.id, { costo: Math.round(v.receta.reduce((s, r) => { const x = db.get('materiales', r.materialId); return s + (x ? x.costo * r.cant : 0); }, 0) * 100) / 100 }));

  // Reparte el costo de una compra de material entre las piezas que saldrán de ella (como en LUCXSTUDIO con el DTF).
  function dividir(pre) {
    const mats = db.all('materiales'), $ = ui.money; if (!mats.length) return ui.toast('Primero agrega materiales');
    ui.modal('Dividir el costo del material', `<p class="mute">Registra una compra y reparte su costo entre los pines o stickers que saldrán de ella.</p>
      <label>Material<select class="inp" name="mat">${mats.map(x => `<option value="${x.id}" ${x.id === pre ? 'selected' : ''}>${E(x.nombre)} (${E(x.unidad)})</option>`).join('')}</select></label>
      <div class="grid2">${ui.inp('total', 'Costo total pagado', '', 'number', 'step="0.01"')}${ui.inp('cant', 'Cantidad comprada', '', 'number', 'step="0.01"')}</div>
      <label>Cómo repartir<select class="inp" name="modo"><option value="uso">Por uso: absorbe el sobrante (recomendado)</option><option value="unidad">Por unidad comprada: el sobrante no se carga</option></select></label>
      <label>Sumar al stock<select class="inp" name="suma"><option value="1">Sí, agregar lo comprado</option><option value="0">No, ya lo tenía registrado</option></select></label>
      <div id="dv"></div><div class="card" id="dvp" style="margin:12px 0 0;font-size:.85rem"></div>`, el => {
      const e = est(); if (e.error) { ui.toast(e.error); return false; }
      db.update('materiales', e.mat.id, { costo: Math.round(e.efectivo * 10000) / 10000, stock: e.mat.stock + (ui.vals(el).suma === '1' ? e.cant : 0) });
      CC.recalcular(e.mat.id); ui.toast(`Costo repartido: ${$(e.efectivo)} por ${e.mat.unidad}`); CC.router.show(); });
    const root = document.getElementById('modal'), q = s => root.querySelector(s);
    const est = () => {
      const id = q('[name=mat]').value, mat = db.get('materiales', id), total = +q('[name=total]').value || 0, cant = +q('[name=cant]').value || 0;
      const pz = [...root.querySelectorAll('.pz')].map(i => ({ v: db.get('variantes', i.dataset.v), n: +i.value || 0 })).filter(x => x.n > 0);
      const uso = x => x.v.receta.find(r => r.materialId === id).cant, usado = pz.reduce((s, x) => s + x.n * uso(x), 0), modoUso = q('[name=modo]').value === 'uso';
      const efectivo = modoUso && usado > 0 && usado <= cant ? total / usado : (cant ? total / cant : 0), llen = cant ? Math.round(usado / cant * 100) : 0; let error = '';
      if (!(total > 0 && cant > 0)) error = 'Captura el costo total y la cantidad comprada.';
      else if (!pz.length) error = 'Escribe cuántas piezas vas a hacer con este material.';
      else if (usado > cant) error = `No alcanza: las piezas necesitan ${+usado.toFixed(2)} ${mat.unidad} y compraste ${cant}.`;
      const aviso = !error && llen < 70 ? `⚠️ Solo usas el ${llen}% de lo comprado. ${modoUso ? 'El costo por pieza sube porque absorbe el sobrante.' : 'El sobrante se queda en stock.'}` : '';
      return { mat, total, cant, pz, uso, efectivo, llen, error, aviso };
    };
    const calc = () => { if (!q('[name=mat]')) return; const e = est();
      q('#dvp').innerHTML = e.error ? `<span class="neg">${E(e.error)}</span>` : `Costo por ${E(e.mat.unidad)}: <b>${$(e.efectivo)}</b> · Llenado: <b>${e.llen}%</b>${e.pz.map(x => `<br>${E(CC.nombreVar(x.v))}: ${$(e.uso(x) * e.efectivo)} de material por pieza (${x.n} pzs)`).join('')}${e.aviso ? `<br><span class="neg">${E(e.aviso)}</span>` : ''}`; };
    const lista = () => { const id = q('[name=mat]').value;
      q('#dv').innerHTML = db.all('variantes').filter(v => (v.receta || []).some(r => r.materialId === id)).map(v => `<div class="grid2 cr"><span>${E(CC.nombreVar(v))}<div class="mute">${v.receta.find(r => r.materialId === id).cant} por pieza</div></span><input class="inp pz" data-v="${v.id}" type="number" placeholder="Piezas a hacer"></div>`).join('') || '<p class="mute">Ninguna receta usa este material. Agrégalo en Catálogo → Materiales.</p>'; calc(); };
    root.onchange = e => e.target.name === 'mat' ? lista() : calc(); root.oninput = calc; lista();
  }
  CC.router.register('materiales', 'Materiales', '🧵', el => {
    const ms = db.all('materiales');
    el.innerHTML = `<div class="bar"><button class="btn" id="n">+ Material</button><button class="btn ghost" id="dv">🧮 Dividir costo</button><span class="mute">El material se descuenta al terminar una producción (Inventario → En proceso → Terminar).</span></div>` +
      G.map(g => `<div class="card"><div class="bar"><h3 style="margin:0;flex:1">${g}</h3><button class="btn ghost sm" data-n="${g}">＋ Agregar</button></div><div class="cards">` +
        (ms.filter(m => m.grupo === g).map(m => { const bajo = m.minimo && m.stock <= m.minimo;
          return `<div class="pcard"><div class="pb"><b>${E(m.nombre)}</b><div class="${bajo ? 'neg' : ''}" style="font:800 1.4rem var(--font-display)">${m.stock} <small class="mute">${E(m.unidad)}</small></div><div class="mute">${ui.money(m.costo)} por ${E(m.unidad)}${bajo ? ' · Resurtir' : ''}</div>
            <div class="bar" style="margin:8px 0 0"><button class="btn sm" data-v="${m.id}">Ver más</button><button class="btn ghost sm" data-s="${m.id}">± Stock</button></div></div></div>`; }).join('') || '<p class="mute">Sin materiales en este grupo.</p>') + '</div></div>').join('');
    el.onclick = e => { const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'n') form(); else if (b.id === 'dv') dividir(); else if (b.dataset.n) form({}, b.dataset.n); else if (b.dataset.v) ver(db.get('materiales', b.dataset.v)); else if (b.dataset.s) ajustar(db.get('materiales', b.dataset.s)); };
  });
})();
