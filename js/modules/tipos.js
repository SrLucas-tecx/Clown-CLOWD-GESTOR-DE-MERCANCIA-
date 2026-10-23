// Tipos de producto (Ajustes): mini pin, pin estándar, gigante, metálico, sticker en hoja…
// Cada tipo dice de qué material está hecho y cuántas piezas salen de él; con eso se calcula el costo
// por pieza y un precio sugerido según el margen que fijes aquí.
(() => {
  const {db, ui} = CC;
  const E = ui.esc, $ = ui.money;
  const CLAVE_MARGEN = 'clowncloud:margen'; // el mismo margen que usa Rentabilidad
  const MARCA_BASE = 'clowncloud:tiposBase';
  const BASE = [
    ['Pin estándar 1.5"', 'Pines', 1], ['Mini pin', 'Pines', 1], ['Pin gigante', 'Pines', 1], ['Pin metálico', 'Pines', 1], ['Sticker en hoja', 'Stickers', 12]
  ];

  const margen = () => +localStorage.getItem(CLAVE_MARGEN) || 40;
  // Comisión real de terminal sobre lo vendido (0 si aún no hay ventas).
  const tasaComision = () => {
    const ventas = CC.ventasOk(), total = ventas.reduce((s, v) => s + v.total, 0);
    return total ? ventas.reduce((s, v) => s + (v.comision || 0), 0) / total : 0;
  };

  CC.margenDeseado = margen;

  // Precio sugerido: costo ÷ (1 − margen − comisión de terminal), redondeado hacia arriba al peso.
  CC.precioSugerido = costo => {
    const denominador = 1 - margen() / 100 - tasaComision();
    // El -1e-9 evita que un error de decimales (8.0000000002) suba el precio un peso de más.
    return costo > 0 && denominador > 0 ? Math.ceil(costo / denominador - 1e-9) : null;
  };

  // Materiales que gasta UNA pieza de este tipo: el material base (1 ÷ lo que rinde, con merma)
  // más los materiales por defecto (alfiler, tarjeta, bolsita…). Devuelve [{materialId, cant}].
  CC.consumoTipo = t => {
    const consumo = new Map();
    const rinde = Math.max(0.0001, (+t.piezas || 1) * (1 - (+t.merma || 0) / 100));
    if (t.materialId) consumo.set(t.materialId, 1 / rinde);
    (t.receta || []).forEach(r => { if (r.materialId && +r.cant > 0) consumo.set(r.materialId, (consumo.get(r.materialId) || 0) + (+r.cant)); });
    return [...consumo].map(([materialId, cant]) => ({materialId, cant}));
  };

  // Costo por pieza de un tipo: lo que cuestan sus materiales + extras por pieza.
  CC.costoTipo = t => {
    const materiales = CC.consumoTipo(t).reduce((suma, c) => {
      const m = db.get('materiales', c.materialId);
      return suma + (m && !m.eliminado ? m.costo * c.cant : 0);
    }, 0);
    return Math.round((materiales + (+t.extra || 0)) * 100) / 100;
  };

  // Vuelve a calcular el costo de las piezas ligadas a un tipo (o a los tipos de un material).
  CC.recalcularTipos = materialId => {
    db.all('variantes').filter(v => v.tipoId && !(v.receta || []).length).forEach(v => {
      const tipo = db.get('tipos', v.tipoId);
      if (tipo && !tipo.eliminado && (!materialId || CC.consumoTipo(tipo).some(c => c.materialId === materialId))) db.update('variantes', v.id, {costo: CC.costoTipo(tipo)});
    });
  };

  const tiposBase = () => {
    if (localStorage.getItem(MARCA_BASE)) return;
    localStorage.setItem(MARCA_BASE, '1');
    if (!db.all('tipos').length) BASE.forEach(([nombre, categoria, piezas]) => db.add('tipos', {nombre, categoria, materialId: '', piezas, merma: 0, extra: 0}));
  };

  const refrescar = () => {
    const y = window.scrollY, contenedor = document.querySelector('.page-content'), yc = contenedor ? contenedor.scrollTop : 0;
    CC.router.show();
    window.scrollTo(0, y);
    if (contenedor) contenedor.scrollTop = yc;
  };

  // ---------------------------------------------------------------------------------------------
  // Formulario de tipo
  // ---------------------------------------------------------------------------------------------
  function form(tipo) {
    const t = tipo || {}, categorias = CC.categorias.lista().map(c => c.nombre), materiales = db.all('materiales');
    const filaReceta = (r = {}) => `
      <div class="tp-r" style="display:grid;grid-template-columns:1fr 110px 38px;gap:6px;margin-bottom:6px">
        <select class="inp rm">${materiales.map(m => `<option value="${m.id}" ${m.id === r.materialId ? 'selected' : ''}>${E(m.nombre)} (${E(m.unidad)})</option>`).join('')}</select>
        <input class="inp rc" type="number" step="0.01" min="0" placeholder="Cant. por pieza" value="${r.cant ?? ''}">
        <button type="button" class="btn ghost sm" data-rm title="Quitar">✕</button>
      </div>`;
    const leerReceta = root => [...root.querySelectorAll('.tp-r')].map(r => ({materialId: r.querySelector('.rm').value, cant: +r.querySelector('.rc').value || 0})).filter(r => r.materialId && r.cant > 0);
    ui.modal(tipo ? 'Editar tipo de producto' : 'Nuevo tipo de producto', `
      ${ui.inp('nombre', 'Nombre (ej. Mini pin, Pin gigante, Pin metálico)', t.nombre)}
      <div class="grid2">
        <label>Categoría<select class="inp" name="categoria">${categorias.map(c => `<option ${c === t.categoria ? 'selected' : ''}>${E(c)}</option>`).join('')}</select></label>
        <label>Material en el que está hecho
          <select class="inp" name="materialId"><option value="">— Sin material (solo extras) —</option>
            ${materiales.map(m => `<option value="${m.id}" ${m.id === t.materialId ? 'selected' : ''}>${E(m.nombre)} (${E(m.unidad)})</option>`).join('')}</select></label>
      </div>
      <div class="grid3">
        ${ui.inp('piezas', 'Piezas que salen de 1 unidad de material', t.piezas ?? 1, 'number', 'step="0.01" min="0"')}
        ${ui.inp('merma', 'Merma (%)', t.merma ?? 0, 'number', 'step="0.1" min="0" max="90"')}
        ${ui.inp('extra', 'Extras por pieza ($)', t.extra ?? 0, 'number', 'step="0.01" min="0"')}
      </div>
      <p class="mute" style="margin:4px 0 0">Ejemplo: una hoja de vinil de $10 con 12 stickers y 10% de merma cuesta ≈ $0.93 por sticker.</p>
      <div class="bar" style="margin:12px 0 4px"><b style="flex:1">Materiales que usa cada pieza</b><span class="mute">Lo que gasta por defecto: alfiler, tarjeta, bolsita…</span></div>
      <div id="tp-receta">${(t.receta || []).map(filaReceta).join('')}</div>
      <button type="button" class="btn ghost sm" id="tp-add">＋ Agregar material</button>
      <div class="card" id="tp-res" style="margin:10px 0 0;font-size:.9rem"></div>`, m => {
      const o = ui.vals(m), nombre = o.nombre.trim();
      if (!nombre) { ui.toast('Falta el nombre'); return false; }
      if (db.all('tipos').some(x => x.nombre.trim().toLowerCase() === nombre.toLowerCase() && (!tipo || x.id !== tipo.id))) { ui.toast('Ya existe un tipo con ese nombre'); return false; }
      if (!(+o.piezas > 0)) { ui.toast('Las piezas por unidad deben ser mayores a 0'); return false; }
      const datos = {nombre, categoria: o.categoria, materialId: o.materialId, piezas: +o.piezas, merma: +o.merma || 0, extra: +o.extra || 0, receta: leerReceta(m)};
      if (tipo) { db.update('tipos', tipo.id, datos); CC.recalcularTipos(); } else db.add('tipos', datos);
      refrescar();
    });
    const raiz = document.getElementById('modal'), baseClick = raiz.onclick;
    const previa = () => {
      const o = ui.vals(raiz), temporal = {materialId: o.materialId, piezas: o.piezas, merma: o.merma, extra: o.extra, receta: leerReceta(raiz)};
      const costo = CC.costoTipo(temporal), sugerido = CC.precioSugerido(costo);
      const usa = CC.consumoTipo(temporal).map(c => { const m = db.get('materiales', c.materialId); return m ? `${E(m.nombre)} ${+c.cant.toFixed(3)}` : ''; }).filter(Boolean);
      raiz.querySelector('#tp-res').innerHTML = `Costo por pieza: <b>${$(costo)}</b>${sugerido ? ` · Precio sugerido (margen ${margen()}%): <b>${$(sugerido)}</b>` : ''}${usa.length ? `<div class="mute">Cada pieza gasta: ${usa.join(' · ')}</div>` : ''}`;
    };
    raiz.oninput = raiz.onchange = previa;
    raiz.onclick = e => {
      if (e.target.closest('#tp-add')) {
        if (!materiales.length) return ui.toast('Primero agrega materiales en Inventario → Materiales');
        raiz.querySelector('#tp-receta').insertAdjacentHTML('beforeend', filaReceta());
        return previa();
      }
      const quitar = e.target.closest('[data-rm]');
      if (quitar) { quitar.closest('.tp-r').remove(); return previa(); }
      baseClick(e);
    };
    previa();
  }

  function eliminar(tipo) {
    const usos = db.all('variantes').filter(v => v.tipoId === tipo.id);
    ui.confirm(usos.length ? `«${tipo.nombre}» está en ${usos.length} producto(s). Conservan su costo actual, pero dejarán de calcularse con este tipo.` : `¿Eliminar el tipo «${tipo.nombre}»?`).then(ok => {
      if (!ok) return;
      const copia = JSON.stringify(db.crudo());
      usos.forEach(v => db.update('variantes', v.id, {tipoId: ''}));
      db.remove('tipos', tipo.id);
      refrescar();
      ui.deshacer('Tipo eliminado.', copia);
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Pantalla (Ajustes → Tipos de producto)
  // ---------------------------------------------------------------------------------------------
  CC.router.register('tipos', 'Tipos de producto', '🧩', el => {
    tiposBase();
    const tipos = db.all('tipos'), categorias = [...new Set(tipos.map(t => t.categoria))];
    const tasa = tasaComision();

    const tarjeta = t => {
      const material = t.materialId ? db.get('materiales', t.materialId) : null, costo = CC.costoTipo(t), sugerido = CC.precioSugerido(costo);
      const usos = db.all('variantes').filter(v => v.tipoId === t.id).length;
      return `
        <div class="pcard"><div class="pb">
          <b>${E(t.nombre)}</b>
          <div class="mute">${material && !material.eliminado ? `${E(material.nombre)} · salen ${+t.piezas} por ${E(material.unidad)}${t.merma ? ` · merma ${+t.merma}%` : ''}` : '<span class="warn">Sin material asignado</span>'}${t.extra ? ` · extras ${$(t.extra)}` : ''}</div>
          ${(t.receta || []).length ? `<div class="mute">Incluye: ${t.receta.map(r => { const m = db.get('materiales', r.materialId); return m ? E(m.nombre) + ' ×' + r.cant : ''; }).filter(Boolean).join(', ')}</div>` : ''}
          <div style="display:flex;gap:18px;margin:6px 0">
            <div><small class="mute">Costo por pieza</small><div style="font:800 1.4rem var(--font-display)">${$(costo)}</div></div>
            <div><small class="mute">Precio sugerido</small><div style="font:800 1.4rem var(--font-display)">${sugerido ? $(sugerido) : '—'}</div></div>
          </div>
          <div class="mute">${usos ? `Se usa en ${usos} producto(s)` : 'Aún no se usa en productos'}</div>
          <div class="bar" style="margin:8px 0 0"><button class="btn ghost sm" data-a="editar" data-id="${t.id}">Editar</button><button class="btn ghost sm" data-a="borrar" data-id="${t.id}">Eliminar</button></div>
        </div></div>`;
    };

    el.innerHTML = `
      <div class="bar">
        <div style="flex:1;min-width:240px"><h3 style="margin:0">Tipos de producto</h3>
          <p class="mute" style="margin:2px 0 0">Mini pin, pin gigante, metálico, sticker… cada uno con su material y cuántas piezas salen de él. El costo y el precio sugerido se calculan solos.</p></div>
        <button class="btn" data-a="nuevo">+ Tipo de producto</button>
      </div>

      <div class="card">
        <div class="grid3" style="align-items:end">
          ${ui.inp('margen', 'Margen neto deseado (%)', margen(), 'number', 'min="0" max="90" step="1"')}
          <div><small class="mute">Comisión de terminal real</small><div><b>${(tasa * 100).toFixed(1)}%</b> <span class="mute">${tasa ? 'de tus ventas' : '(aún sin ventas con tarjeta)'}</span></div></div>
          <div class="mute">Precio sugerido = costo ÷ (1 − margen − comisión), redondeado al peso.</div>
        </div>
      </div>

      ${categorias.map(c => `
        <h3 style="margin:14px 0 6px">${E(c)}</h3>
        <div class="cards">${tipos.filter(t => t.categoria === c).map(tarjeta).join('')}</div>`).join('') || '<p class="mute">Aún no hay tipos. Crea el primero con «+ Tipo de producto».</p>'}`;

    el.onchange = e => {
      if (e.target.name !== 'margen') return;
      const n = +e.target.value;
      if (!(n >= 0 && n < 90)) { ui.toast('El margen debe estar entre 0 y 90 %'); return refrescar(); }
      localStorage.setItem(CLAVE_MARGEN, n);
      refrescar();
    };
    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b || !b.dataset.a) return;
      if (b.dataset.a === 'nuevo') form();
      else if (b.dataset.a === 'editar') form(db.get('tipos', b.dataset.id));
      else if (b.dataset.a === 'borrar') eliminar(db.get('tipos', b.dataset.id));
    };
  });
})();
