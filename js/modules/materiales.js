// Materiales por grupo (tarjetas) con stock; las recetas de pines y stickers los consumen.
// El costo por unidad SE CALCULA: costo total pagado ÷ cantidad comprada. Al entrar más stock con costo,
// se promedia con lo que ya había.
(() => {
  const {db, ui} = CC;
  const E = ui.esc;
  const GRUPOS = ['Pines', 'Stickers', 'Empaque', 'Otros'];
  const redondear = x => Math.round(x * 10000) / 10000;

  // Costo por unidad con hasta 4 decimales (los materiales suelen costar centavos por pieza).
  const unidad = x => '$' + (+x || 0).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 4});
  const usos = m => db.all('variantes').filter(v => (v.receta || []).some(r => r.materialId === m.id));

  // Vuelve a calcular el costo de todas las piezas que usan un material.
  CC.recalcular = id => db.all('variantes').filter(v => (v.receta || []).some(r => r.materialId === id)).forEach(v =>
    db.update('variantes', v.id, {
      costo: Math.round(v.receta.reduce((s, r) => { const x = db.get('materiales', r.materialId); return s + (x ? x.costo * r.cant : 0); }, 0) * 100) / 100
    }));

  // Además de las recetas, recalcula las piezas que se calculan con un tipo de producto.
  const recalcularRecetas = CC.recalcular;
  CC.recalcular = id => {
    recalcularRecetas(id);
    if (CC.recalcularTipos) CC.recalcularTipos(id);
  };

  // ---------------------------------------------------------------------------------------------
  // Nuevo / editar material (costo por unidad calculado)
  // ---------------------------------------------------------------------------------------------
  function form(m = {}, grupo) {
    const editando = !!m.id;
    ui.modal(editando ? 'Editar material' : 'Nuevo material',
      ui.inp('nombre', 'Nombre (alfileres, vinil mate…)', m.nombre) + `
      <div class="grid2">
        <label>Grupo<select class="inp" name="grupo">${GRUPOS.map(x => `<option ${x === (m.grupo || grupo) ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        ${ui.inp('unidad', 'Unidad (pzs, hojas, m)', m.unidad || 'pzs')}
      </div>
      <div class="grid2">${ui.inp('stock', 'Stock actual', m.stock, 'number', 'step="0.01"')}${ui.inp('minimo', 'Mínimo (para avisarte)', m.minimo, 'number')}</div>
      <p class="mute" style="margin:6px 0 0">${editando ? 'Para cambiar el costo, escribe lo que pagaste y cuántas unidades compraste. Si lo dejas vacío, se queda igual.' : '¿Cuánto pagaste y cuántas unidades compraste? El costo por unidad se calcula solo.'}</p>
      <div class="grid2">${ui.inp('costoTotal', 'Costo total pagado ($)', '', 'number', 'step="0.01"')}${ui.inp('cantCompra', 'Cantidad comprada', '', 'number', 'step="0.01" placeholder="Si lo dejas vacío usa el stock"')}</div>
      <div class="card" id="mt-res" style="margin:10px 0 0;font-size:.9rem"></div>`, modal => {
        const o = ui.vals(modal), e = calcularCosto(o, m);
        if (!o.nombre.trim()) { ui.toast('Falta el nombre'); return false; }
        if (e.error) { ui.toast(e.error); return false; }
        const datos = {nombre: o.nombre.trim(), grupo: o.grupo, unidad: o.unidad || 'pzs', stock: +o.stock || 0, costo: e.costo, minimo: +o.minimo || 0};
        if (editando) { db.update('materiales', m.id, datos); CC.recalcular(m.id); } else db.add('materiales', datos);
        CC.router.show();
      });

    const raiz = document.getElementById('modal');
    const pintar = () => {
      const e = calcularCosto(ui.vals(raiz), m);
      raiz.querySelector('#mt-res').innerHTML = e.error ? `<span class="neg">${E(e.error)}</span>` : e.detalle;
    };
    raiz.oninput = raiz.onchange = pintar;
    pintar();
  }

  // Costo por unidad = total pagado ÷ cantidad comprada (si no hay cantidad, usa el stock).
  function calcularCosto(o, m) {
    const total = +o.costoTotal || 0, cantidad = +o.cantCompra || +o.stock || 0;
    if (!total) {
      const actual = m.costo || 0;
      return {costo: actual, detalle: actual ? `Costo por unidad actual: <b>${unidad(actual)}</b> (sin cambios)` : 'Escribe el costo total pagado para calcular el costo por unidad.'};
    }
    if (total < 0) return {error: 'El costo total no puede ser negativo.'};
    if (!(cantidad > 0)) return {error: 'Escribe la cantidad comprada (o el stock) para calcular el costo.'};
    const costo = redondear(total / cantidad);
    return {costo, detalle: `Costo por unidad: <b>${unidad(costo)}</b> <span class="mute">(${ui.money(total)} ÷ ${cantidad})</span>`};
  }

  // ---------------------------------------------------------------------------------------------
  // Ajustar stock (entra o sale). Si entra con costo, se promedia con lo que había.
  // ---------------------------------------------------------------------------------------------
  function ajustar(m) {
    ui.modal('Ajustar ' + E(m.nombre), `
      ${ui.inp('cant', 'Cantidad (+ entra, − sale)', '', 'number', 'step="0.01"')}
      ${ui.inp('costoEntrada', 'Costo total de lo que entra (opcional)', '', 'number', 'step="0.01"')}
      <div class="card" id="aj-res" style="margin:10px 0 0;font-size:.9rem"></div>`, modal => {
        const e = calcularEntrada(m, ui.vals(modal));
        if (e.error) { ui.toast(e.error); return false; }
        if (!e.cant) return false;
        db.update('materiales', m.id, {stock: Math.max(0, m.stock + e.cant), costo: e.costo});
        if (e.costo !== m.costo) CC.recalcular(m.id);
        CC.router.show();
      });
    const raiz = document.getElementById('modal');
    const pintar = () => {
      const e = calcularEntrada(m, ui.vals(raiz));
      raiz.querySelector('#aj-res').innerHTML = e.error ? `<span class="neg">${E(e.error)}</span>` : e.detalle;
    };
    raiz.oninput = pintar;
    pintar();
  }

  function calcularEntrada(m, o) {
    const cant = +o.cant || 0, total = +o.costoEntrada || 0;
    if (m.stock + cant < 0) return {error: `No se puede sacar ${-cant}: solo hay ${m.stock} ${m.unidad}`};
    if (cant > 0 && total > 0) {
      const costo = m.stock > 0 && m.costo ? redondear((m.stock * m.costo + total) / (m.stock + cant)) : redondear(total / cant);
      return {cant, costo, detalle: `Costo por unidad: <b>${unidad(m.costo)}</b> → <b>${unidad(costo)}</b> <span class="mute">(promedio con lo que ya tenías)</span>`};
    }
    return {cant, costo: m.costo, detalle: cant ? `Nuevo stock: <b>${Math.max(0, m.stock + cant)} ${E(m.unidad)}</b> · el costo por unidad no cambia (${unidad(m.costo)})` : '<span class="mute">Escribe una cantidad.</span>'};
  }

  // ---------------------------------------------------------------------------------------------
  // Detalle («Ver más»)
  // ---------------------------------------------------------------------------------------------
  const ver = m => ui.detalle({
    icon: '🧵', title: m.nombre, sub: m.grupo,
    secciones: [
      {t: 'Existencias', f: [
        ['Stock', m.stock + ' ' + m.unidad, m.minimo && m.stock <= m.minimo ? 'bad' : ''],
        ['Costo por unidad', unidad(m.costo)],
        ['Valor en stock', ui.money(m.stock * m.costo)]
      ]},
      {t: 'Se usa en', f: usos(m).length
        ? usos(m).map(v => [CC.nombreVar(v), v.receta.find(r => r.materialId === m.id).cant + ' ' + m.unidad + ' por pieza'])
        : [['Aún no está en ninguna receta', '']]}
    ],
    acciones: [
      {label: '🧮 Dividir costo', fn: () => dividir(m.id)},
      {label: '± Stock', ghost: 1, fn: () => ajustar(m)},
      {label: '✏️ Editar', ghost: 1, fn: () => form(m)},
      {label: '🗑️ Eliminar', ghost: 1, fn: () => eliminar(m)}
    ]
  });

  // ---------------------------------------------------------------------------------------------
  // Eliminar (solo si ningún producto ni tipo lo usa)
  // ---------------------------------------------------------------------------------------------
  const usosTipos = m => db.all('tipos').filter(t => t.materialId === m.id || (t.receta || []).some(r => r.materialId === m.id));
  function eliminar(m) {
    const p = usos(m).length, t = usosTipos(m).length;
    if (p || t) return ui.toast(`No se puede eliminar "${m.nombre}": lo usa${p ? ` ${p} producto(s)` : ''}${p && t ? ' y' : ''}${t ? ` ${t} tipo(s) de producto` : ''}. Quítalo primero de sus materiales.`);
    ui.confirm(`¿Eliminar el material «${m.nombre}»?${m.stock ? ` Tiene ${m.stock} ${m.unidad} en stock.` : ''}`).then(ok => {
      if (!ok) return;
      const copia = JSON.stringify(db.crudo());
      db.remove('materiales', m.id);
      CC.router.show();
      ui.deshacer('Material eliminado.', copia);
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Dividir el costo de una compra entre las piezas que saldrán de ella (3 pasos)
  //   1 · Qué compraste   2 · Qué vas a hacer   3 · Resultado
  // ---------------------------------------------------------------------------------------------
  function dividir(pre) {
    const mats = db.all('materiales'), $ = ui.money;
    if (!mats.length) return ui.toast('Primero agrega materiales');
    ui.modal('Dividir el costo del material', `
      <div class="mute" id="dv-paso" style="margin-bottom:8px"></div>

      <div class="dv-p" data-p="1">
        <p class="mute" style="margin-top:0">Anota lo que compraste. En el siguiente paso eliges cuántas piezas vas a hacer con ello.</p>
        <label>¿Qué material compraste?<select class="inp" name="mat">${mats.map(x => `<option value="${x.id}" ${x.id === pre ? 'selected' : ''}>${E(x.nombre)} (${E(x.unidad)})</option>`).join('')}</select></label>
        <div class="grid2">${ui.inp('total', '¿Cuánto pagaste en total? ($)', '', 'number', 'step="0.01" min="0"')}${ui.inp('cant', '¿Cuántas unidades compraste?', '', 'number', 'step="0.01" min="0"')}</div>
        <label>¿Lo sumo a tu stock?<select class="inp" name="suma"><option value="1">Sí, agregar lo comprado al stock</option><option value="0">No, ya lo tenía registrado</option></select></label>
      </div>

      <div class="dv-p" data-p="2" style="display:none">
        <p class="mute" style="margin-top:0">¿Cuántas piezas vas a hacer con esta compra? Solo salen los productos que usan este material en su receta.</p>
        <div id="dv"></div>
        <label>¿Cómo repartimos el costo?
          <select class="inp" name="modo"><option value="uso">Que las piezas absorban el sobrante (recomendado)</option><option value="unidad">Cobrar solo lo que se usa: el sobrante se queda en stock</option></select></label>
        <div class="mute" id="dv-modo"></div>
      </div>

      <div class="dv-p" data-p="3" style="display:none"><div class="card" id="dvp" style="margin:0;font-size:.9rem"></div></div>

      <div class="neg" id="dv-err" style="margin-top:8px"></div>
      <div class="bar" style="margin:10px 0 0"><button type="button" class="btn ghost" id="dv-atras">← Atrás</button><div style="flex:1"></div><button type="button" class="btn" id="dv-sig">Siguiente →</button></div>`, el => {
        const e = estimar();
        if (e.error) { ui.toast(e.error); return false; }
        db.update('materiales', e.mat.id, {costo: redondear(e.efectivo), stock: e.mat.stock + (ui.vals(el).suma === '1' ? e.cant : 0)});
        CC.recalcular(e.mat.id);
        ui.toast(`Costo repartido: ${unidad(e.efectivo)} por ${e.mat.unidad}`);
        CC.router.show();
      });

    const root = document.getElementById('modal'), q = s => root.querySelector(s);
    const guardar = q('[data-ok]');
    let paso = 1;

    const estimar = () => {
      const id = q('[name=mat]').value, mat = db.get('materiales', id), total = +q('[name=total]').value || 0, cant = +q('[name=cant]').value || 0;
      const piezas = [...root.querySelectorAll('.pz')].map(i => ({v: db.get('variantes', i.dataset.v), n: +i.value || 0})).filter(x => x.n > 0);
      const uso = x => x.v.receta.find(r => r.materialId === id).cant;
      const usado = piezas.reduce((s, x) => s + x.n * uso(x), 0), modoUso = q('[name=modo]').value === 'uso';
      const efectivo = modoUso && usado > 0 && usado <= cant ? total / usado : (cant ? total / cant : 0);
      const llenado = cant ? Math.round(usado / cant * 100) : 0;
      let error = '';
      if (!(total > 0 && cant > 0)) error = 'Escribe cuánto pagaste y cuántas unidades compraste.';
      else if (!piezas.length) error = 'Escribe cuántas piezas vas a hacer con este material.';
      else if (usado > cant) error = `No alcanza: las piezas necesitan ${+usado.toFixed(2)} ${mat.unidad} y compraste ${cant}.`;
      const aviso = !error && llenado < 70 ? `⚠️ Solo usas el ${llenado}% de lo comprado. ${modoUso ? 'El costo por pieza sube porque absorbe el sobrante.' : 'El sobrante se queda en stock.'}` : '';
      return {mat, total, cant, piezas, uso, efectivo, llenado, error, aviso};
    };

    const listaPiezas = () => {
      const id = q('[name=mat]').value;
      q('#dv').innerHTML = db.all('variantes').filter(v => (v.receta || []).some(r => r.materialId === id)).map(v => `
        <div class="line" style="gap:8px"><span style="flex:1">${E(CC.nombreVar(v))}<div class="mute">usa ${v.receta.find(r => r.materialId === id).cant} por pieza</div></span>
          <input class="inp pz" data-v="${v.id}" type="number" min="0" placeholder="Piezas a hacer" style="width:130px"></div>`).join('')
        || '<p class="mute">Ningún producto usa este material en su receta. Agrégalo en Catálogo → Materiales de un producto.</p>';
    };

    const resultado = () => {
      const e = estimar();
      q('#dvp').innerHTML = e.error ? `<span class="neg">${E(e.error)}</span>`
        : `Costo por ${E(e.mat.unidad)}: <b>${unidad(e.mat.costo)}</b> → <b>${unidad(e.efectivo)}</b><br>Se usa el <b>${e.llenado}%</b> de lo que compraste${ui.vals(root).suma === '1' ? `<br>Al stock se suman <b>${e.cant} ${E(e.mat.unidad)}</b>` : ''}
          ${e.piezas.map(x => `<div class="line"><span>${E(CC.nombreVar(x.v))} <span class="mute">(${x.n} pzs)</span></span><b>${unidad(e.uso(x) * e.efectivo)} de material por pieza</b></div>`).join('')}${e.aviso ? `<p class="neg" style="margin:8px 0 0">${E(e.aviso)}</p>` : ''}`;
    };

    const textoModo = () => {
      q('#dv-modo').textContent = q('[name=modo]').value === 'uso'
        ? 'Todo lo que pagaste se reparte entre las piezas que haces. Es el costo real si no vas a usar el sobrante.'
        : 'Cada pieza solo carga lo que gasta de material. Lo que sobra queda en stock y se cobra cuando lo uses.';
    };

    const mostrar = () => {
      root.querySelectorAll('.dv-p').forEach(p => { p.style.display = +p.dataset.p === paso ? '' : 'none'; });
      q('#dv-paso').textContent = `Paso ${paso} de 3 · ${['Qué compraste', 'Qué vas a hacer', 'Resultado'][paso - 1]}`;
      q('#dv-atras').style.visibility = paso > 1 ? 'visible' : 'hidden';
      q('#dv-sig').style.display = paso < 3 ? '' : 'none';
      guardar.style.display = paso === 3 ? '' : 'none';
      q('#dv-err').textContent = '';
      if (paso === 2) { listaPiezas(); textoModo(); }
      if (paso === 3) resultado();
    };

    q('#dv-sig').onclick = () => {
      const e = estimar();
      // Paso 1 pide dinero y cantidad; paso 2 pide piezas y que alcance el material.
      const falla = paso === 1 ? !(e.total > 0 && e.cant > 0) : !!e.error;
      if (falla) { q('#dv-err').textContent = paso === 1 ? 'Escribe cuánto pagaste y cuántas unidades compraste.' : e.error; return; }
      paso++;
      mostrar();
    };
    q('#dv-atras').onclick = () => { paso--; mostrar(); };
    root.onchange = e => {
      if (e.target.name === 'mat') listaPiezas();
      if (e.target.name === 'modo') textoModo();
      q('#dv-err').textContent = '';
    };
    mostrar();
  }

  // ---------------------------------------------------------------------------------------------
  // Pantalla: tarjetas por grupo
  // ---------------------------------------------------------------------------------------------
  let busqueda = '', soloBajos = false;
  const norm = s => String(s || '').trim().toLowerCase();
  const esBajo = m => m.minimo && m.stock <= m.minimo;

  const tarjeta = m => {
    const bajo = esBajo(m);
    return `<div class="pcard"><div class="pb">
      <div class="bar" style="margin:0"><b style="flex:1">${E(m.nombre)}</b>${bajo ? '<span class="chip" style="--c:var(--rojo-300)">Resurtir</span>' : ''}</div>
      <div class="${bajo ? 'neg' : ''}" style="font:800 1.4rem var(--font-display)">${m.stock} <small class="mute">${E(m.unidad)}</small></div>
      <div class="mute">${unidad(m.costo)} por ${E(m.unidad)} · valor ${ui.money(m.stock * m.costo)}</div>
      <div class="bar" style="margin:8px 0 0">
        <button class="btn sm" data-v="${m.id}">Ver más</button><button class="btn ghost sm" data-s="${m.id}">± Stock</button>
        <button class="btn ghost sm" data-e="${m.id}" title="Editar">✏️</button><button class="btn ghost sm" data-d="${m.id}" title="Eliminar">🗑️</button>
      </div></div></div>`;
  };

  CC.router.register('materiales', 'Materiales', '🧵', el => {
    const materiales = db.all('materiales'), bajos = materiales.filter(esBajo).length;
    const kpi = (t, v, c = '') => `<div class="kpi"><small>${t}</small><b class="${c}">${v}</b></div>`;
    el.innerHTML = `
      <div class="bar">
        <button class="btn" id="n">+ Material</button>
        <button class="btn ghost" id="dv">🧮 Dividir costo</button>
        <input class="inp" id="bq" placeholder="🔍 Buscar material…" value="${E(busqueda)}" style="flex:1;min-width:180px;max-width:300px">
        <button class="btn ${soloBajos ? '' : 'ghost'}" data-f="1">⚠️ Por resurtir (${bajos})</button>
      </div>
      <div class="kpis">
        ${kpi('Materiales', materiales.length)}${kpi('Por resurtir', bajos, bajos ? 'neg' : '')}${kpi('Valor en stock', ui.money(materiales.reduce((s, m) => s + m.stock * m.costo, 0)))}
      </div>
      <div id="mt-grupos"></div>`;

    const pintar = () => {
      const visibles = materiales.filter(m => (!busqueda || norm(m.nombre).includes(norm(busqueda))) && (!soloBajos || esBajo(m)));
      el.querySelector('#mt-grupos').innerHTML = GRUPOS.map(g => `
        <div class="card">
          <div class="bar"><h3 style="margin:0;flex:1">${g}</h3><button class="btn ghost sm" data-n="${g}">＋ Agregar</button></div>
          <div class="cards">${visibles.filter(m => m.grupo === g).map(tarjeta).join('') || `<p class="mute">${busqueda || soloBajos ? 'Nada coincide en este grupo.' : 'Sin materiales en este grupo.'}</p>`}</div>
        </div>`).join('');
    };
    pintar();

    el.querySelector('#bq').oninput = e => { busqueda = e.target.value; pintar(); };
    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      if (b.id === 'n') form();
      else if (b.id === 'dv') dividir();
      else if (d.f) { soloBajos = !soloBajos; CC.router.show(); }
      else if (d.n) form({}, d.n);
      else if (d.v) ver(db.get('materiales', d.v));
      else if (d.s) ajustar(db.get('materiales', d.s));
      else if (d.e) form(db.get('materiales', d.e));
      else if (d.d) eliminar(db.get('materiales', d.d));
    };
  });
})();
