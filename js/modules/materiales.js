// Materiales por grupo (recuadros) con stock; las recetas de pines y stickers los consumen.
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
      {label: '✏️ Editar', ghost: 1, fn: () => form(m)}
    ]
  });

  // ---------------------------------------------------------------------------------------------
  // Dividir el costo de una compra de material entre las piezas que saldrán de ella
  // ---------------------------------------------------------------------------------------------
  function dividir(pre) {
    const mats = db.all('materiales'), $ = ui.money;
    if (!mats.length) return ui.toast('Primero agrega materiales');
    ui.modal('Dividir el costo del material', `
      <p class="mute">Registra una compra y reparte su costo entre los pines o stickers que saldrán de ella.</p>
      <label>Material<select class="inp" name="mat">${mats.map(x => `<option value="${x.id}" ${x.id === pre ? 'selected' : ''}>${E(x.nombre)} (${E(x.unidad)})</option>`).join('')}</select></label>
      <div class="grid2">${ui.inp('total', 'Costo total pagado', '', 'number', 'step="0.01"')}${ui.inp('cant', 'Cantidad comprada', '', 'number', 'step="0.01"')}</div>
      <label>Cómo repartir<select class="inp" name="modo"><option value="uso">Por uso: absorbe el sobrante (recomendado)</option><option value="unidad">Por unidad comprada: el sobrante no se carga</option></select></label>
      <label>Sumar al stock<select class="inp" name="suma"><option value="1">Sí, agregar lo comprado</option><option value="0">No, ya lo tenía registrado</option></select></label>
      <div id="dv"></div><div class="card" id="dvp" style="margin:12px 0 0;font-size:.85rem"></div>`, el => {
        const e = estimar();
        if (e.error) { ui.toast(e.error); return false; }
        db.update('materiales', e.mat.id, {costo: redondear(e.efectivo), stock: e.mat.stock + (ui.vals(el).suma === '1' ? e.cant : 0)});
        CC.recalcular(e.mat.id);
        ui.toast(`Costo repartido: ${unidad(e.efectivo)} por ${e.mat.unidad}`);
        CC.router.show();
      });

    const root = document.getElementById('modal'), q = s => root.querySelector(s);
    const estimar = () => {
      const id = q('[name=mat]').value, mat = db.get('materiales', id), total = +q('[name=total]').value || 0, cant = +q('[name=cant]').value || 0;
      const piezas = [...root.querySelectorAll('.pz')].map(i => ({v: db.get('variantes', i.dataset.v), n: +i.value || 0})).filter(x => x.n > 0);
      const uso = x => x.v.receta.find(r => r.materialId === id).cant;
      const usado = piezas.reduce((s, x) => s + x.n * uso(x), 0), modoUso = q('[name=modo]').value === 'uso';
      const efectivo = modoUso && usado > 0 && usado <= cant ? total / usado : (cant ? total / cant : 0);
      const llenado = cant ? Math.round(usado / cant * 100) : 0;
      let error = '';
      if (!(total > 0 && cant > 0)) error = 'Captura el costo total y la cantidad comprada.';
      else if (!piezas.length) error = 'Escribe cuántas piezas vas a hacer con este material.';
      else if (usado > cant) error = `No alcanza: las piezas necesitan ${+usado.toFixed(2)} ${mat.unidad} y compraste ${cant}.`;
      const aviso = !error && llenado < 70 ? `⚠️ Solo usas el ${llenado}% de lo comprado. ${modoUso ? 'El costo por pieza sube porque absorbe el sobrante.' : 'El sobrante se queda en stock.'}` : '';
      return {mat, total, cant, piezas, uso, efectivo, llenado, error, aviso};
    };
    const calcular = () => {
      if (!q('[name=mat]')) return;
      const e = estimar();
      q('#dvp').innerHTML = e.error ? `<span class="neg">${E(e.error)}</span>`
        : `Costo por ${E(e.mat.unidad)}: <b>${unidad(e.efectivo)}</b> · Llenado: <b>${e.llenado}%</b>${e.piezas.map(x => `<br>${E(CC.nombreVar(x.v))}: ${$(e.uso(x) * e.efectivo)} de material por pieza (${x.n} pzs)`).join('')}${e.aviso ? `<br><span class="neg">${E(e.aviso)}</span>` : ''}`;
    };
    const lista = () => {
      const id = q('[name=mat]').value;
      q('#dv').innerHTML = db.all('variantes').filter(v => (v.receta || []).some(r => r.materialId === id)).map(v => `
        <div class="grid2 cr"><span>${E(CC.nombreVar(v))}<div class="mute">${v.receta.find(r => r.materialId === id).cant} por pieza</div></span><input class="inp pz" data-v="${v.id}" type="number" placeholder="Piezas a hacer"></div>`).join('')
        || '<p class="mute">Ninguna receta usa este material. Agrégalo en Catálogo → Materiales.</p>';
      calcular();
    };
    root.onchange = e => e.target.name === 'mat' ? lista() : calcular();
    root.oninput = calcular;
    lista();
  }

  // ---------------------------------------------------------------------------------------------
  // Pantalla
  // ---------------------------------------------------------------------------------------------
  CC.router.register('materiales', 'Materiales', '🧵', el => {
    const materiales = db.all('materiales');
    el.innerHTML = `
      <div class="bar"><button class="btn" id="n">+ Material</button><button class="btn ghost" id="dv">🧮 Dividir costo</button>
        <span class="mute">El costo por unidad se calcula con lo que pagaste. El material se descuenta al terminar una producción (Inventario → En proceso → Terminar).</span></div>` +
      GRUPOS.map(g => `
        <div class="card">
          <div class="bar"><h3 style="margin:0;flex:1">${g}</h3><button class="btn ghost sm" data-n="${g}">＋ Agregar</button></div>
          <div class="cards">${materiales.filter(m => m.grupo === g).map(m => {
            const bajo = m.minimo && m.stock <= m.minimo;
            return `<div class="pcard"><div class="pb"><b>${E(m.nombre)}</b>
              <div class="${bajo ? 'neg' : ''}" style="font:800 1.4rem var(--font-display)">${m.stock} <small class="mute">${E(m.unidad)}</small></div>
              <div class="mute">${unidad(m.costo)} por ${E(m.unidad)}${bajo ? ' · Resurtir' : ''}</div>
              <div class="bar" style="margin:8px 0 0"><button class="btn sm" data-v="${m.id}">Ver más</button><button class="btn ghost sm" data-s="${m.id}">± Stock</button></div></div></div>`;
          }).join('') || '<p class="mute">Sin materiales en este grupo.</p>'}</div>
        </div>`).join('');

    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.id === 'n') form();
      else if (b.id === 'dv') dividir();
      else if (b.dataset.n) form({}, b.dataset.n);
      else if (b.dataset.v) ver(db.get('materiales', b.dataset.v));
      else if (b.dataset.s) ajustar(db.get('materiales', b.dataset.s));
    };
  });
})();
