// Inventario: pestañas Pines / Stickers, estados (stock, en proceso, vendidos) y tarjetas con temática y etiquetas.
(() => {
  const { db, ui } = CC, E = ui.esc;
  let tipo = null, estado = 'stock', tag = null;
  CC.mover = (varianteId, cant, tipo, motivo = '', ref = '') => db.add('movimientos', { varianteId, cant, tipo, motivo, ref, fecha: ui.hoy() });
  const grupo = p => String(p.categoria || '').trim().toLowerCase() || '_sin';
  const qty = (v, e) => e === 'stock' ? CC.stock(v.id) : e === 'proceso' ? CC.enProceso(v.id) : CC.vendidos(v.id);

  const consumir = (varId, n) => { const v = db.get('variantes', varId); (v.receta || []).forEach(r => { const m = db.get('materiales', r.materialId); if (m) db.update('materiales', m.id, { stock: Math.max(0, m.stock - r.cant * n) }); }); };
  function mov(varId, t, cant) {
    const opts = db.all('variantes').map(v => `<option value="${v.id}">${E(CC.nombreVar(v))}</option>`).join('');
    ui.modal('Movimiento de inventario', `<label>Variante<select class="inp" name="v">${opts}</select></label>
      <div class="grid2"><label>Tipo<select class="inp" name="tipo"><option value="entrada">Entrada a stock (+)</option><option value="proceso">Mandar a proceso</option><option value="terminar">Terminar proceso → stock</option><option value="merma">Merma (−)</option><option value="ajuste">Ajuste (+ o −)</option></select></label>${ui.inp('cant', 'Cantidad', cant || '', 'number')}</div>${ui.inp('motivo', 'Motivo')}`, m => {
      const o = ui.vals(m); let c = +o.cant;
      if (!o.v || !c) { ui.toast('Elige variante y cantidad'); return false; }
      const a = Math.abs(c), nom = CC.nombreVar(db.get('variantes', o.v));
      if (o.tipo === 'terminar') { const en = CC.enProceso(o.v), f = CC.faltantes(o.v, a);
        if (a > en) { ui.toast(`No se puede: "${nom}" solo tiene ${en} en proceso`); return false; }
        if (f.length) { ui.toast('Falta material para terminar: ' + f.join(', ')); return false; } }
      const sale = o.tipo === 'merma' || (o.tipo === 'ajuste' && c < 0) ? a : 0;
      if (sale > CC.stock(o.v)) { ui.toast(`No se puede sacar ${sale}: "${nom}" solo tiene ${CC.stock(o.v)} en stock`); return false; }
      if (o.tipo === 'proceso') CC.mover(o.v, a, 'proceso', o.motivo);
      else if (o.tipo === 'terminar') { CC.mover(o.v, -a, 'proceso', 'Terminado'); CC.mover(o.v, a, 'entrada', 'Terminado de proceso'); consumir(o.v, a); }
      else CC.mover(o.v, o.tipo === 'merma' ? -a : o.tipo === 'entrada' ? a : c, o.tipo, o.motivo);
      CC.router.show();
    });
    const m = document.getElementById('modal'); if (varId) m.querySelector('[name=v]').value = varId; if (t) m.querySelector('[name=tipo]').value = t;
  }
  function tarjeta(p) {
    ui.modal('Tarjeta del producto', ui.inp('coleccion', 'Temática / colección', p.coleccion) + '<label>Etiquetas</label>' + CC.tags.picker('producto', p.etiquetas), m => {
      db.update('productos', p.id, { coleccion: ui.vals(m).coleccion, etiquetas: CC.tags.leer(m) }); CC.router.show(); });
    CC.tags.bind(document.getElementById('modal'));
  }

  CC.router.register('inventario', 'Inventario', '📦', el => {
    const cats = CC.categorias.lista().map(c => [String(c.nombre).trim().toLowerCase(), `${c.icono || '📦'} ${c.nombre}`]), ps0 = db.all('productos');
    if (ps0.some(p => grupo(p) === '_sin')) cats.push(['_sin', '📦 Sin categoría']);
    if (!cats.some(c => c[0] === tipo)) tipo = (cats.find(c => ps0.some(p => grupo(p) === c[0])) || cats[0])[0];
    const ps = ps0, vs = db.all('variantes'), enG = ps.filter(p => grupo(p) === tipo);
    const pvs = p => vs.filter(v => v.productoId === p.id);
    const tabs = cats.map(([k, l]) => `<button class="tab ${tipo === k ? 'on' : ''}" data-t="${k}">${l} <small>(${ps.filter(p => grupo(p) === k).length})</small></button>`).join('');
    const segs = [['stock', 'Nuevos / en stock'], ['proceso', 'En proceso'], ['vendidos', 'Vendidos']].map(([k, l]) =>
      `<button class="${estado === k ? 'on' : ''}" data-s="${k}">${l} · ${enG.reduce((s, p) => s + pvs(p).reduce((a, v) => a + Math.max(0, qty(v, k)), 0), 0)}</button>`).join('');
    const usadas = [...new Set(enG.flatMap(p => p.etiquetas || []))].map(id => db.get('etiquetas', id)).filter(t => t && !t.eliminado);
    const cards = enG.filter(p => !tag || (p.etiquetas || []).includes(tag)).map(p => {
      const pv = pvs(p), tot = pv.reduce((s, v) => s + Math.max(0, qty(v, estado)), 0); if (estado !== 'stock' && !tot) return '';
      const nuevo = Date.now() - new Date(p.creado) < 12096e5 ? '<span class="chip" style="--c:var(--color-success)">Nuevo</span>' : '';
      return `<div class="pcard"><div class="pb"><b>${E(p.producto)}</b> ${nuevo}${p.porConfirmar ? '<span class="chip" style="--c:var(--amarillo-300)">Por confirmar</span>' : ''}<div class="mute">${E(p.coleccion || 'Sin temática')}</div><div>${CC.tags.chips(p.etiquetas)}</div>
        ${pv.map(v => { const q = qty(v, estado); if (estado !== 'stock' && !q) return ''; const bajo = estado === 'stock' && v.minimo && q <= v.minimo;
          return `<div class="line"><span>${E(v.nombre || 'Único')}${estado === 'stock' && CC.puedeHacer(v) !== null ? `<div class="mute">Material para ${CC.puedeHacer(v)} más</div>` : ''}</span><span class="${bajo ? 'neg' : ''}">${q} pzs ${estado === 'proceso' ? `<button class="btn ghost sm" data-f="${v.id}" data-n="${q}">Terminar</button>` : ''}</span></div>`; }).join('')}
        <div class="bar" style="margin:8px 0 0"><button class="btn ghost sm" data-e="${p.id}">Tarjeta</button><button class="btn ghost sm" data-mv="${pv[0]?.id || ''}">Movimiento</button></div></div></div>`; }).join('');
    const movs = db.all('movimientos').slice(-15).reverse();
    el.innerHTML = `<div class="tabs">${tabs}</div><div class="bar"><div class="seg">${segs}</div><div style="flex:1"></div><button class="btn ghost" id="cg">⚙️ Categorías</button><button class="btn ghost" id="et">🏷️ Etiquetas</button><button class="btn" id="mov">+ Movimiento</button></div>
      ${usadas.length ? `<div class="flt">${usadas.map(t => `<span class="chip ${tag === t.id ? 'on' : ''}" data-g="${t.id}" style="--c:${t.color}">${E(t.nombre)}</span>`).join('')}</div>` : ''}
      <div class="cards">${cards || '<p class="mute">No hay nada aquí todavía.</p>'}</div>
      <details class="card" style="margin-top:16px"><summary>Últimos movimientos</summary><table><tbody>${movs.map(m => { const v = db.get('variantes', m.varianteId);
        return `<tr><td>${m.fecha}</td><td>${E(v ? CC.nombreVar(v) : '?')}</td><td>${m.tipo}</td><td class="${m.cant < 0 ? 'neg' : 'pos-n'}">${m.cant > 0 ? '+' : ''}${m.cant}</td><td class="mute">${E(m.motivo)}</td></tr>`; }).join('')}</tbody></table></details>`;
    el.querySelector('#mov').onclick = () => mov();
    el.querySelector('#cg').onclick = () => CC.categorias.gestionar(() => CC.router.show());
    el.querySelector('#et').onclick = () => CC.tags.gestionar('producto', () => CC.router.show());
    el.onclick = e => {
      const t = e.target.closest('[data-t]'), s = e.target.closest('[data-s]'), g = e.target.closest('[data-g]'), b = e.target.closest('button[data-e],button[data-mv],button[data-f]');
      if (t) { tipo = t.dataset.t; tag = null; return CC.router.show(); }
      if (s) { estado = s.dataset.s; return CC.router.show(); }
      if (g) { tag = tag === g.dataset.g ? null : g.dataset.g; return CC.router.show(); }
      if (!b) return;
      if (b.dataset.e) tarjeta(db.get('productos', b.dataset.e));
      else if (b.dataset.f) mov(b.dataset.f, 'terminar', b.dataset.n);
      else mov(b.dataset.mv);
    };
  });
})();
