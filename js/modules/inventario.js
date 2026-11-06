// Inventario: pestañas Pines / Stickers, estados (stock, en proceso, vendidos, merma) y tarjetas con temática y etiquetas.
(() => {
  const {db, ui} = CC, E = ui.esc;
  let tipo = null, estado = 'stock', tag = null;
  // extra (opcional): {fecha, lote}. Las entradas con lote permiten ver de qué lote es lo que queda.
  CC.mover = (varianteId, cant, tipo, motivo = '', ref = '', extra = {}) => db.add('movimientos', {
    varianteId,
    cant,
    tipo,
    motivo,
    ref,
    fecha: extra.fecha || ui.hoy(),
    ...(extra.lote ? { lote: extra.lote } : {})
  });

  // Lotes de una variante con lo que queda de cada uno. Lo que sale (ventas, merma…) se descuenta
  // primero de los lotes más antiguos; lo que queda se reparte entre los más nuevos.
  CC.lotesDe = v => {
    const entradas = db.all('movimientos').filter(m => m.varianteId === v.id && m.tipo === 'entrada' && m.cant > 0 && m.lote)
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.creado).localeCompare(String(b.creado)));
    const porLote = new Map();
    entradas.forEach(m => {
      const x = porLote.get(m.lote) || { lote: m.lote, fecha: m.fecha, cant: 0, resta: 0 };
      x.cant += m.cant;
      porLote.set(m.lote, x);
    });
    let falta = Math.max(0, CC.stock(v.id));
    const lista = [...porLote.values()];
    for (let i = lista.length - 1; i >= 0; i--) {
      lista[i].resta = Math.min(lista[i].cant, falta);
      falta -= lista[i].resta;
    }
    if (falta > 0 && lista.length) lista.unshift({ lote: 'Sin lote', fecha: '', cant: falta, resta: falta });
    return lista;
  };
  const mermaDe = id => -db.all('movimientos').filter(m => m.varianteId === id && m.tipo === 'merma').reduce((s, m) => s + m.cant, 0);
  const grupo = p => String(p.categoria || '').trim().toLowerCase() || '_sin';
  const qty = (v, e) => e === 'stock' ? CC.stock(v.id) : e === 'proceso' ? CC.enProceso(v.id) : e === 'merma' ? mermaDe(v.id) : CC.vendidos(v.id);
  // Detalle desplegable de una variante: sus lotes (en stock) o los motivos de merma.
  const detalleExtra = (v, e) => {
    if (e === 'stock') {
      const ls = CC.lotesDe(v).filter(l => l.resta > 0);
      return ls.length ? `<details style="margin:2px 0 4px"><summary class="mute" style="cursor:pointer">Lotes (${ls.length})</summary>${ls.map(l => `<div class="mute">${E(l.lote)}${l.fecha ? ' · ' + E(l.fecha) : ''} · quedan ${l.resta} de ${l.cant}</div>`).join('')}</details>` : '';
    }
    if (e === 'merma') {
      const ms = db.all('movimientos').filter(m => m.varianteId === v.id && m.tipo === 'merma').slice().reverse();
      return ms.length ? `<details style="margin:2px 0 4px"><summary class="mute" style="cursor:pointer">Motivos (${ms.length})</summary>${ms.map(m => `<div class="mute">${E(m.fecha)} · ${-m.cant} pz · ${E(m.motivo || 'sin motivo')}</div>`).join('')}</details>` : '';
    }
    return '';
  };
  const consumir = (varId, n) => {
    const v = db.get('variantes', varId);
    (v.receta || []).forEach(r => {
      const m = db.get('materiales', r.materialId);
      if (m)
        db.update('materiales', m.id, { stock: Math.max(0, m.stock - r.cant * n) });
    });
  };
  function mov(varId, t, cant) {
    const opts = db.all('variantes').map(v => `<option value="${v.id}">${E(CC.nombreVar(v))}</option>`).join('');
    ui.modal('Movimiento de inventario', `<label>Variante<select class="inp" name="v">${opts}</select></label>
      <div class="grid2"><label>Tipo<select class="inp" name="tipo"><option value="entrada">Entrada a stock (+)</option><option value="proceso">Mandar a proceso</option><option value="terminar">Terminar proceso → stock</option><option value="merma">Merma (−)</option><option value="ajuste">Ajuste (+ o −)</option></select></label>${ui.inp('cant', 'Cantidad', cant || '', 'number')}</div>${ui.inp('motivo', 'Motivo')}${ui.inp('lote', 'Lote (solo para entradas, opcional)', '', 'text', 'placeholder="Ej. L-20261104-1"')}`, m => {
      const o = ui.vals(m);
      let c = +o.cant;
      if (!o.v || !c) {
        ui.toast('Elige variante y cantidad');
        return false;
      }
      const a = Math.abs(c), nom = CC.nombreVar(db.get('variantes', o.v));
      if (o.tipo === 'terminar') {
        const en = CC.enProceso(o.v), f = CC.faltantes(o.v, a);
        if (a > en) {
          ui.toast(`No se puede: "${nom}" solo tiene ${en} en proceso`);
          return false;
        }
        if (f.length) {
          ui.toast('Falta material para terminar: ' + f.join(', '));
          return false;
        }
      }
      const sale = o.tipo === 'merma' || o.tipo === 'ajuste' && c < 0 ? a : 0;
      if (sale > CC.stock(o.v)) {
        ui.toast(`No se puede sacar ${sale}: "${nom}" solo tiene ${CC.stock(o.v)} en stock`);
        return false;
      }
      if (o.tipo === 'proceso')
        CC.mover(o.v, a, 'proceso', o.motivo);
      else if (o.tipo === 'terminar') {
        CC.mover(o.v, -a, 'proceso', 'Terminado');
        CC.mover(o.v, a, 'entrada', 'Terminado de proceso');
        consumir(o.v, a);
      } else
        CC.mover(o.v, o.tipo === 'merma' ? -a : o.tipo === 'entrada' ? a : c, o.tipo, o.motivo, '', o.tipo === 'entrada' && o.lote.trim() ? { lote: o.lote.trim() } : {});
      CC.router.show();
    });
    const m = document.getElementById('modal');
    if (varId)
      m.querySelector('[name=v]').value = varId;
    if (t)
      m.querySelector('[name=tipo]').value = t;
  }
  function tarjeta(p) {
    ui.modal('Tarjeta del producto', ui.inp('coleccion', 'Temática / colección', p.coleccion) + '<label>Etiquetas</label>' + CC.tags.picker('producto', p.etiquetas), m => {
      db.update('productos', p.id, {
        coleccion: ui.vals(m).coleccion,
        etiquetas: CC.tags.leer(m)
      });
      CC.router.show();
    });
    CC.tags.bind(document.getElementById('modal'));
  }
  CC.router.register('inventario', 'Inventario', '📦', el => {
    const cats = CC.categorias.lista().map(c => [
        String(c.nombre).trim().toLowerCase(),
        `${c.icono || '📦'} ${c.nombre}`
      ]), ps0 = db.all('productos');
    if (ps0.some(p => grupo(p) === '_sin'))
      cats.push([
        '_sin',
        '📦 Sin categoría'
      ]);
    if (!cats.some(c => c[0] === tipo))
      tipo = (cats.find(c => ps0.some(p => grupo(p) === c[0])) || cats[0])[0];
    const ps = ps0, vs = db.all('variantes'), enG = ps.filter(p => grupo(p) === tipo);
    const pvs = p => vs.filter(v => v.productoId === p.id);
    const tabs = cats.map(([k, l]) => `<button class="tab ${tipo === k ? 'on' : ''}" data-t="${k}">${l} <small>(${ps.filter(p => grupo(p) === k).length})</small></button>`).join('');
    const segs = [
      [
        'stock',
        'Nuevos / en stock'
      ],
      [
        'proceso',
        'En proceso'
      ],
      [
        'vendidos',
        'Vendidos'
      ],
      [
        'merma',
        'Merma'
      ]
    ].map(([k, l]) => `<button class="${estado === k ? 'on' : ''}" data-s="${k}">${l} · ${enG.reduce((s, p) => s + pvs(p).reduce((a, v) => a + Math.max(0, qty(v, k)), 0), 0)}</button>`).join('');
    const usadas = [...new Set(enG.flatMap(p => p.etiquetas || []))].map(id => db.get('etiquetas', id)).filter(t => t && !t.eliminado);
    const cards = enG.filter(p => !tag || (p.etiquetas || []).includes(tag)).map(p => {
      const pv = pvs(p), tot = pv.reduce((s, v) => s + Math.max(0, qty(v, estado)), 0);
      if (estado !== 'stock' && !tot)
        return '';
      const nuevo = Date.now() - new Date(p.creado) < 1209600000 ? '<span class="chip" style="--c:var(--color-success)">Nuevo</span>' : '';
      return `<div class="pcard"><div class="pb"><b>${E(p.producto)}</b> ${nuevo}${p.porConfirmar ? '<span class="chip" style="--c:var(--amarillo-300)">Por confirmar</span>' : ''}<div class="mute">${E(p.coleccion || 'Sin temática')}</div><div>${CC.tags.chips(p.etiquetas)}</div>
        ${pv.map(v => {
        const q = qty(v, estado);
        if (estado !== 'stock' && !q)
          return '';
        const bajo = estado === 'stock' && v.minimo && q <= v.minimo;
        return `<div class="line"><span>${E(v.nombre || 'Único')}${estado === 'stock' && CC.puedeHacer(v) !== null ? `<div class="mute">Material para ${CC.puedeHacer(v)} más</div>` : ''}${detalleExtra(v, estado)}</span><span class="${bajo ? 'neg' : ''}">${q} pzs ${estado === 'proceso' ? `<button class="btn ghost sm" data-f="${v.id}" data-n="${q}">Terminar</button>` : ''}</span></div>`;
      }).join('')}
        <div class="bar" style="margin:8px 0 0"><button class="btn ghost sm" data-e="${p.id}">Tarjeta</button><button class="btn ghost sm" data-mv="${pv[0]?.id || ''}">Movimiento</button></div></div></div>`;
    }).join('');
    const movs = db.all('movimientos').slice(-15).reverse();
    el.innerHTML = `<div class="tabs">${tabs}</div><div class="bar"><div class="seg">${segs}</div><div style="flex:1"></div><button class="btn" id="av">➕ Agregar varios</button><button class="btn ghost" id="cg">⚙️ Categorías</button><button class="btn ghost" id="et">🏷️ Etiquetas</button><button class="btn ghost" id="mov">+ Movimiento</button></div>
      ${usadas.length ? `<div class="flt">${usadas.map(t => `<span class="chip ${tag === t.id ? 'on' : ''}" data-g="${t.id}" style="--c:${t.color}">${E(t.nombre)}</span>`).join('')}</div>` : ''}
      <div class="cards">${cards || '<p class="mute">No hay nada aquí todavía.</p>'}</div>
      <details class="card" style="margin-top:16px"><summary>Últimos movimientos</summary><table><tbody>${movs.map(m => {
      const v = db.get('variantes', m.varianteId);
      return `<tr><td>${m.fecha}</td><td>${E(v ? CC.nombreVar(v) : '?')}</td><td>${m.tipo}</td><td class="${m.cant < 0 ? 'neg' : 'pos-n'}">${m.cant > 0 ? '+' : ''}${m.cant}</td><td class="mute">${m.lote ? `<span class="chip" style="--c:var(--azul-300)">${E(m.lote)}</span> ` : ''}${E(m.motivo)}</td></tr>`;
    }).join('')}</tbody></table></details>`;
    el.querySelector('#av').onclick = () => CC.agregarVarios();
    el.querySelector('#mov').onclick = () => mov();
    el.querySelector('#cg').onclick = () => CC.categorias.gestionar(() => CC.router.show());
    el.querySelector('#et').onclick = () => CC.tags.gestionar('producto', () => CC.router.show());
    el.onclick = e => {
      const t = e.target.closest('[data-t]'), s = e.target.closest('[data-s]'), g = e.target.closest('[data-g]'), b = e.target.closest('button[data-e],button[data-mv],button[data-f]');
      if (t) {
        tipo = t.dataset.t;
        tag = null;
        return CC.router.show();
      }
      if (s) {
        estado = s.dataset.s;
        return CC.router.show();
      }
      if (g) {
        tag = tag === g.dataset.g ? null : g.dataset.g;
        return CC.router.show();
      }
      if (!b)
        return;
      if (b.dataset.e)
        tarjeta(db.get('productos', b.dataset.e));
      else if (b.dataset.f)
        mov(b.dataset.f, 'terminar', b.dataset.n);
      else
        mov(b.dataset.mv);
    };
  });
})();
