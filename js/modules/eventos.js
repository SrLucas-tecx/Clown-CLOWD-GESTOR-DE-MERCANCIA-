// Bazares: lista «Mis bazares» y vista de detalle de cada uno.
// El detalle reúne: resultados, mercancía llevada (agrupada por tema), costos y pagos,
// ingresos extra y ventas por fecha. Todo se agrega, suma, resta y quita en la misma pantalla.
(() => {
  const {db, ui} = CC;
  const E = ui.esc, $ = ui.money;
  const norm = s => String(s || '').trim().toLowerCase();
  const SIN_TEMA = '__sin__';
  const CHECKLIST = ['Mesa', 'Fondo de caja', 'Bolsas', 'Terminal', 'Cartelitos'];
  let abierto = null; // id del bazar que se está viendo en detalle (null = lista)

  // ---------------------------------------------------------------------------------------------
  // Datos de un bazar
  // ---------------------------------------------------------------------------------------------
  const mesa = e => +e.mesa || +e.espacio || 0;
  const suma = lista => lista.reduce((s, x) => s + x.monto, 0);
  const ventasDe = id => CC.ventasOk().filter(v => v.eventoId === id);
  const vendidasEn = (id, varianteId) => ventasDe(id).reduce(
    (s, v) => s + v.items.filter(i => i.varianteId === varianteId).reduce((a, i) => a + i.cant, 0), 0);
  const maletaDe = id => db.all('maletas').find(m => m.eventoId === id);

  // Costos del bazar (mesa + costos capturados al crear + gastos), cada uno con su origen para poder quitarlo.
  const costosDe = e => [
    ...(mesa(e) ? [{concepto: 'Mesa / puesto', monto: mesa(e), fijo: true}] : []),
    ...(e.costos || []).map((c, i) => ({concepto: c.concepto, monto: c.monto, origen: 'costos', i})),
    ...db.all('gastos').filter(g => g.eventoId === e.id).map(g => ({
      concepto: g.concepto + (g.tipo === 'produccion' ? ' (producción)' : ''), monto: g.monto, origen: 'gasto', id: g.id
    }))
  ];

  // Mercancía asignada: una fila por variante con lo llevado, vendido y restante.
  const mercanciaDe = e => {
    const maleta = maletaDe(e.id);
    return (maleta ? maleta.items : []).map(item => {
      const v = db.get('variantes', item.varianteId);
      if (!v || v.eliminado) return null;
      const p = db.get('productos', v.productoId) || {};
      const vend = vendidasEn(e.id, v.id);
      return {v, tema: (p.coleccion || '').trim() || SIN_TEMA, llevo: item.llevo, vend, rest: Math.max(0, item.llevo - vend), precio: v.precio || 0, costo: v.costo || 0};
    }).filter(Boolean);
  };

  const calc = e => {
    const vs = ventasDe(e.id), costos = costosDe(e);
    const gas = suma(costos), prod = suma(db.all('gastos').filter(g => g.eventoId === e.id && g.tipo === 'produccion'));
    const util = CC.utilidad(vs), extra = suma(e.ingresos || []), com = vs.reduce((s, v) => s + (v.comision || 0), 0);
    const items = mercanciaDe(e);
    const potencial = items.reduce((s, i) => s + i.rest * (i.precio - i.costo), 0);
    const neto = util + extra - gas - com;
    return {
      vs, n: vs.length, venta: vs.reduce((s, v) => s + v.total, 0), costos, gas, prod, util, extra, com, neto,
      estimada: neto + potencial, pend: Math.max(0, gas - (+e.pagado || 0)),
      pct: gas ? Math.min(100, Math.round((util + extra) / gas * 100)) : 100,
      items, consultas: db.all('consultas').filter(c => c.eventoId === e.id).reduce((s, c) => s + c.cant, 0)
    };
  };

  // Vuelve a dibujar la pantalla sin perder el lugar donde estabas (así agregar y quitar no «salta»).
  const refrescar = () => {
    const y = window.scrollY, contenedor = document.querySelector('.page-content'), yc = contenedor ? contenedor.scrollTop : 0;
    CC.router.show();
    window.scrollTo(0, y);
    if (contenedor) contenedor.scrollTop = yc;
  };

  // ---------------------------------------------------------------------------------------------
  // Formularios: bazar, costo, ingreso, pago
  // ---------------------------------------------------------------------------------------------
  const filaCosto = '<div class="grid2 cr"><input class="inp cc" placeholder="Concepto (gasolina, comida…)"><input class="inp cm" type="number" step="0.01" placeholder="$ Monto"></div>';

  function form(bazar) {
    const nuevo = !bazar, e = bazar || {};
    ui.modal(nuevo ? 'Nuevo bazar' : 'Editar bazar',
      ui.inp('nombre', 'Nombre del bazar', e.nombre) +
      ui.inp('lugar', 'Lugar', e.lugar, 'text', 'placeholder="Ej. Temilenio, Centro Tolzú"') +
      `<div class="grid3">${ui.inp('fecha', 'Fecha de inicio', e.fecha || ui.hoy(), 'date')}${ui.inp('dias', 'Duración (días)', e.dias, 'number')}${ui.inp('mesa', 'Costo de la mesa', e.mesa, 'number', 'step="0.01"')}</div>
       <div class="grid2">${ui.inp('pagado', 'Ya pagado / apartado', e.pagado, 'number', 'step="0.01"')}${ui.inp('fondoCaja', 'Fondo de caja inicial', e.fondoCaja, 'number', 'step="0.01"')}</div>` +
      (nuevo ? `<label>Otros costos (opcional)</label><div id="filas">${filaCosto}</div><button type="button" class="btn ghost sm" id="addc">＋ Agregar costo</button>` : ''), m => {
        const o = ui.vals(m);
        if (!o.nombre.trim()) { ui.toast('Falta el nombre'); return false; }
        const datos = {nombre: o.nombre.trim(), lugar: o.lugar.trim(), fecha: o.fecha, dias: +o.dias || 0, mesa: +o.mesa || 0, pagado: +o.pagado || 0, fondoCaja: +o.fondoCaja || 0};
        if (nuevo) {
          const costos = [...m.querySelectorAll('.cr')].map(r => ({concepto: r.querySelector('.cc').value.trim() || 'Otro', monto: +r.querySelector('.cm').value || 0})).filter(c => c.monto > 0);
          abierto = db.add('eventos', {...datos, costos, ingresos: []}).id;
        } else db.update('eventos', e.id, datos);
        refrescar();
      });
    if (nuevo) document.getElementById('addc').onclick = () => document.getElementById('filas').insertAdjacentHTML('beforeend', filaCosto);
  }

  const agregarCosto = id => ui.modal('Agregar costo',
    ui.inp('concepto', 'Concepto') + ui.inp('monto', 'Monto', '', 'number', 'step="0.01"') +
    '<label>Tipo<select class="inp" name="tipo"><option value="evento">🎪 Evento (mesa, transporte)</option><option value="produccion">🧵 Producción (material)</option></select></label>', m => {
      const o = ui.vals(m);
      if (!(+o.monto > 0)) { ui.toast('Pon un monto'); return false; }
      db.add('gastos', {eventoId: id, concepto: o.concepto || 'Otro', monto: +o.monto, tipo: o.tipo});
      refrescar();
    });

  const agregarIngreso = id => ui.modal('Ingreso extra',
    ui.inp('concepto', 'Concepto (rifa, juegos, propinas…)') + ui.inp('monto', 'Monto', '', 'number', 'step="0.01"'), m => {
      const o = ui.vals(m), e = db.get('eventos', id);
      if (!(+o.monto > 0)) { ui.toast('Pon un monto'); return false; }
      db.update('eventos', id, {ingresos: [...(e.ingresos || []), {concepto: o.concepto || 'Otro', monto: +o.monto}]});
      refrescar();
    });

  const registrarPago = e => ui.modal('Registrar pago',
    `<p class="mute">Ya pagado: <b>${$(+e.pagado || 0)}</b>. Lo que captures se suma.</p>` + ui.inp('monto', 'Monto del pago', '', 'number', 'step="0.01"'), m => {
      const monto = +ui.vals(m).monto;
      if (!(monto > 0)) { ui.toast('Pon un monto'); return false; }
      db.update('eventos', e.id, {pagado: (+e.pagado || 0) + monto});
      refrescar();
    });

  // Quita un costo o un ingreso de la lista (con «Deshacer»).
  function quitar(e, tipo, dato) {
    const copia = JSON.stringify(db.crudo());
    if (tipo === 'gasto') db.remove('gastos', dato.id);
    else if (tipo === 'costos') db.update('eventos', e.id, {costos: (e.costos || []).filter((_, i) => i !== +dato.i)});
    else if (tipo === 'ingreso') db.update('eventos', e.id, {ingresos: (e.ingresos || []).filter((_, i) => i !== +dato.i)});
    refrescar();
    ui.deshacer('Quitado.', copia);
  }

  function eliminar(e) {
    const ventas = ventasDe(e.id).length;
    if (ventas) return ui.toast(`No se puede eliminar "${e.nombre}": tiene ${ventas} venta(s). Anúlalas primero.`);
    ui.confirm(`¿Eliminar el bazar "${e.nombre}"? También se quitan su mercancía asignada y sus costos.`).then(ok => {
      if (!ok) return;
      const copia = JSON.stringify(db.crudo());
      db.all('gastos').filter(g => g.eventoId === e.id).forEach(g => db.remove('gastos', g.id));
      db.all('maletas').filter(m => m.eventoId === e.id).forEach(m => db.remove('maletas', m.id));
      db.remove('eventos', e.id);
      abierto = null;
      refrescar();
      ui.deshacer('Bazar eliminado.', copia);
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Mercancía: asignar temas, sumar y restar lo que se lleva
  // ---------------------------------------------------------------------------------------------
  const asegurarMaleta = id => maletaDe(id) || db.add('maletas', {eventoId: id, items: [], lista: CHECKLIST.map(t => ({t, ok: false})), cerrada: false});
  const cerrada = id => { const m = maletaDe(id); return !!(m && m.cerrada); };
  const ESTA_CERRADA = 'La maleta de este bazar ya está cerrada';

  // Lo que aún se puede llevar de una variante: lo que hay en inventario menos lo que ya queda por vender allá.
  const disponible = (e, v) => {
    const it = (maletaDe(e.id) || {items: []}).items.find(x => x.varianteId === v.id);
    const restante = it ? Math.max(0, it.llevo - vendidasEn(e.id, v.id)) : 0;
    return Math.max(0, CC.stock(v.id) - restante);
  };

  function agregarMercancia(e, temaPre = '') {
    if (cerrada(e.id)) return ui.toast(ESTA_CERRADA);
    // Temas = los de la sección Temas + cualquier temática escrita en un producto.
    const nombres = new Map();
    db.all('temas').forEach(t => nombres.set(norm(t.nombre), t.nombre));
    db.all('productos').forEach(p => { const t = (p.coleccion || '').trim(); if (t && !nombres.has(norm(t))) nombres.set(norm(t), t); });
    const temas = [...nombres.values()].sort((a, b) => a.localeCompare(b, 'es'));
    const haySinTema = db.all('productos').some(p => !(p.coleccion || '').trim());
    if (!temas.length && !haySinTema) return ui.toast('Primero agrega productos al inventario');
    const inicial = temaPre || (temas[0] || SIN_TEMA);

    ui.modal('Agregar mercancía · ' + E(e.nombre), `
      <label>Tema
        <select class="inp" name="tema">
          ${temas.map(t => `<option value="${E(t)}" ${t === inicial ? 'selected' : ''}>${E(t)}</option>`).join('')}
          ${haySinTema ? `<option value="${SIN_TEMA}" ${inicial === SIN_TEMA ? 'selected' : ''}>Sin tema</option>` : ''}
        </select>
      </label>
      <div class="bar"><span class="mute" style="flex:1">Escribe cuántas piezas llevas de cada diseño.</span><button type="button" class="btn ghost sm" id="mv-todo">Llevar todo lo disponible</button></div>
      <div id="mv-lista"></div>
      <div class="card" id="mv-res" style="margin:12px 0 0;font-size:.85rem"></div>`, m => {
      const filas = [...m.querySelectorAll('.mv-c')].map(i => ({v: db.get('variantes', i.dataset.v), n: Math.floor(+i.value) || 0})).filter(f => f.n !== 0);
      if (!filas.length) { ui.toast('Escribe al menos una cantidad'); return false; }
      const mal = filas.find(f => f.n < 0 || f.n > disponible(e, f.v));
      if (mal) { ui.toast(`No puedes llevar ${mal.n} de "${CC.nombreVar(mal.v)}": solo hay ${disponible(e, mal.v)} disponibles`); return false; }
      const maleta = asegurarMaleta(e.id);
      const items = maleta.items.map(i => ({...i}));
      filas.forEach(f => {
        const it = items.find(i => i.varianteId === f.v.id);
        if (it) it.llevo += f.n; else items.push({varianteId: f.v.id, llevo: f.n});
      });
      db.update('maletas', maleta.id, {items});
      refrescar();
    });

    const raiz = document.getElementById('modal'), q = s => raiz.querySelector(s);
    raiz.querySelector('.modal-box').style.maxWidth = '640px';
    const variantesDe = valor => db.all('variantes').filter(v => {
      const tema = ((db.get('productos', v.productoId) || {}).coleccion || '').trim();
      return valor === SIN_TEMA ? !tema : norm(tema) === norm(valor);
    });
    const pintar = () => {
      const vs = variantesDe(q('[name=tema]').value);
      q('#mv-lista').innerHTML = vs.map(v => `
        <div class="line" style="gap:8px">
          <span style="flex:1;min-width:0">${E(CC.nombreVar(v))}<div class="mute">disponibles ${disponible(e, v)}</div></span>
          <input class="inp mv-c" data-v="${v.id}" type="number" min="0" max="${disponible(e, v)}" placeholder="0" style="width:90px" ${disponible(e, v) ? '' : 'disabled'}>
        </div>`).join('') || '<p class="mute">Este tema aún no tiene productos.</p>';
      resumen();
    };
    const resumen = () => {
      const total = [...raiz.querySelectorAll('.mv-c')].reduce((s, i) => s + (Math.floor(+i.value) || 0), 0);
      q('#mv-res').innerHTML = total ? `Vas a agregar <b>${total}</b> pieza(s) a este bazar.` : '<span class="mute">Aún no hay cantidades.</span>';
    };
    q('[name=tema]').onchange = pintar;
    raiz.oninput = resumen;
    const baseClick = raiz.onclick;
    raiz.onclick = ev => {
      if (ev.target.id === 'mv-todo') { raiz.querySelectorAll('.mv-c').forEach(i => { i.value = i.max; }); return resumen(); }
      baseClick(ev);
    };
    pintar();
  }

  // Suma o resta piezas llevadas de una variante (no baja de lo ya vendido ni sube de lo que hay).
  function ajustar(e, varianteId, delta) {
    if (cerrada(e.id)) return ui.toast(ESTA_CERRADA);
    const maleta = maletaDe(e.id), v = db.get('variantes', varianteId);
    const item = maleta && maleta.items.find(i => i.varianteId === varianteId);
    if (!item) return;
    const vend = vendidasEn(e.id, varianteId), nuevo = item.llevo + delta;
    if (nuevo < vend) return ui.toast(`Ya se vendieron ${vend} de "${CC.nombreVar(v)}": no puedes llevar menos`);
    if (delta > 0 && disponible(e, v) < delta) return ui.toast(`No hay más "${CC.nombreVar(v)}" en inventario (disponibles ${disponible(e, v)})`);
    db.update('maletas', maleta.id, {items: maleta.items.map(i => i.varianteId === varianteId ? {...i, llevo: nuevo} : i)});
    refrescar();
  }

  function quitarMercancia(e, varianteId) {
    if (cerrada(e.id)) return ui.toast(ESTA_CERRADA);
    const vend = vendidasEn(e.id, varianteId);
    if (vend) return ui.toast(`No se puede quitar: ya se vendieron ${vend}. Baja la cantidad hasta ${vend} como mínimo.`);
    const maleta = maletaDe(e.id), copia = JSON.stringify(db.crudo());
    db.update('maletas', maleta.id, {items: maleta.items.filter(i => i.varianteId !== varianteId)});
    refrescar();
    ui.deshacer('Mercancía quitada del bazar.', copia);
  }

  // ---------------------------------------------------------------------------------------------
  // Pantallas
  // ---------------------------------------------------------------------------------------------
  const kpi = (titulo, valor, detalle = '', clase = '') => `<div class="kpi"><small>${titulo}</small><b class="${clase}">${valor}</b>${detalle ? `<span class="mute">${detalle}</span>` : ''}</div>`;
  const subtitulo = e => [e.lugar, e.fecha, e.dias ? e.dias + (e.dias === 1 ? ' día' : ' días') : ''].filter(Boolean).map(E).join(' · ');

  function listaBazares(el) {
    const bazares = db.all('eventos').slice().reverse();
    el.innerHTML = `
      <div class="bar">
        <div style="flex:1;min-width:240px"><h3 style="margin:0">Mis bazares</h3>
          <p class="mute" style="margin:2px 0 0">Entra a un bazar para ver su mercancía, costos, ingresos y ganancia.</p></div>
        <button class="btn" id="nuevo">+ Nuevo bazar</button>
      </div>
      <div class="card">
        <table>
          <thead><tr><th>Bazar</th><th>Ventas</th><th>Total vendido</th><th>Ganancia real</th><th>Acciones</th></tr></thead>
          <tbody>${bazares.map(b => {
            const c = calc(b);
            return `<tr>
              <td><b>🎪 ${E(b.nombre)}</b><div class="mute">${subtitulo(b)}</div><div class="mute">Costo real: ${$(c.gas)} · Pendiente: ${$(c.pend)}</div></td>
              <td>${c.n}</td><td>${$(c.venta)}</td>
              <td class="${c.neto < 0 ? 'neg' : 'pos-n'}"><b>${$(c.neto)}</b></td>
              <td class="end"><button class="btn sm" data-a="ver" data-id="${b.id}">Ir al bazar</button>
                <button class="btn ghost sm" data-a="editar" data-id="${b.id}">Editar</button>
                <button class="btn ghost sm" data-a="borrar" data-id="${b.id}">Eliminar</button></td></tr>`;
          }).join('') || '<tr><td colspan="5" class="mute">Registra tu primer bazar para ver su rendimiento.</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  function detalleBazar(el, e) {
    const c = calc(e), maleta = maletaDe(e.id), bloqueada = !!(maleta && maleta.cerrada);
    const llevadas = c.items.reduce((s, i) => s + i.llevo, 0), vendidas = c.items.reduce((s, i) => s + i.vend, 0), restantes = c.items.reduce((s, i) => s + i.rest, 0);
    const pendiente = c.items.reduce((s, i) => s + i.rest * i.precio, 0);
    const rotacion = llevadas ? Math.round(vendidas / llevadas * 100) : 0;

    // Mercancía agrupada por tema
    const porTema = {};
    c.items.forEach(i => (porTema[i.tema] = porTema[i.tema] || []).push(i));
    const bloquesTema = Object.keys(porTema).sort((a, b) => a.localeCompare(b, 'es')).map(tema => {
      const filas = porTema[tema];
      const llevo = filas.reduce((s, i) => s + i.llevo, 0), vend = filas.reduce((s, i) => s + i.vend, 0);
      return `
        <div class="card">
          <div class="bar"><b style="flex:1">🗂️ ${tema === SIN_TEMA ? 'Sin tema' : E(tema)}</b>
            <span class="chip" style="--c:var(--azul-300)">${llevo} llevadas</span><span class="chip" style="--c:var(--color-success)">${vend} vendidas</span>
            ${bloqueada ? '' : `<button class="btn ghost sm" data-a="mercancia" data-tema="${E(tema)}">＋ Agregar</button>`}</div>
          ${filas.map(i => `
            <div class="line" style="gap:8px;flex-wrap:wrap">
              <span style="flex:1;min-width:160px">${E(CC.nombreVar(i.v))}<div class="mute">vendidas ${i.vend} · restantes ${i.rest}</div></span>
              ${bloqueada ? `<b>${i.llevo}</b>` : `<span><button class="btn ghost sm" data-a="menos" data-v="${i.v.id}">−</button> <b>${i.llevo}</b> <button class="btn sm" data-a="mas" data-v="${i.v.id}">+</button></span>
              <button class="btn ghost sm" data-a="quitarM" data-v="${i.v.id}" title="Quitar del bazar">✕</button>`}
            </div>`).join('')}
        </div>`;
    }).join('');

    // Ventas por fecha
    const porFecha = {};
    c.vs.forEach(v => { porFecha[v.fecha] = porFecha[v.fecha] || {total: 0, n: 0}; porFecha[v.fecha].total += v.total; porFecha[v.fecha].n++; });
    const fechas = Object.keys(porFecha).sort(), maxDia = Math.max(1, ...fechas.map(f => porFecha[f].total));

    el.innerHTML = `
      <div class="bar"><button class="btn ghost" data-a="volver">← Volver a Mis bazares</button><div style="flex:1"></div>
        <button class="btn ghost" data-a="caja">💰 Ver caja</button><button class="btn ghost" data-a="editar" data-id="${e.id}">✏️ Editar</button><button class="btn ghost" data-a="borrar" data-id="${e.id}">🗑️ Eliminar</button></div>
      <h3 style="margin:0">🎪 ${E(e.nombre)}</h3><p class="mute" style="margin:2px 0 10px">${subtitulo(e) || 'Sin fecha ni lugar'}${bloqueada ? ' · 🔒 maleta cerrada' : ''}</p>

      <div class="kpis">
        ${kpi('Total vendido', $(c.venta), c.n + ' venta(s)')}
        ${kpi('Ganancia si vendes todo', $(c.estimada), 'ganancia real + lo que falta por vender')}
        ${kpi('❓ Consultas ligadas', c.consultas, 'preguntas hechas en este bazar')}
        ${kpi('Costo real del bazar', $(c.gas), `Pagado ${$(+e.pagado || 0)} · Saldo ${$(c.pend)}`)}
        ${kpi('+ Ingresos extra', $(c.extra), 'juegos, rifas, propinas…', 'pos-n')}
        ${kpi('💰 Ganancia real', $(c.neto), 'ventas − costo de producto + extra − costos', c.neto < 0 ? 'neg' : 'pos-n')}
      </div>
      <div class="meter"><i style="width:${c.pct}%"></i></div>
      <div class="mute" style="margin-bottom:12px">${c.pct >= 100 ? 'Costos cubiertos' : 'Equilibrio: ' + c.pct + '% de los costos cubiertos'}</div>

      <div class="bar" style="margin-top:8px"><h3 style="margin:0;flex:1">🧳 Mercancía que llevas</h3>
        ${bloqueada ? '' : '<button class="btn" data-a="mercancia" data-tema="">＋ Agregar tema</button>'}</div>
      <div class="kpis">
        ${kpi('Llevadas', llevadas, 'piezas asignadas')}
        ${kpi('Vendidas', vendidas, 'de lo que llevaste', 'pos-n')}
        ${kpi('Restantes', restantes, 'por vender')}
        ${kpi('Rotación', rotacion + '%', 'qué parte ya salió')}
        ${kpi('Valor pendiente', $(pendiente), 'venta potencial de lo que queda')}
      </div>
      ${bloquesTema || `<div class="card" style="text-align:center"><p class="mute">Aún no asignas mercancía a este bazar.</p><button class="btn" data-a="mercancia" data-tema="">＋ Agregar tema</button></div>`}

      <div class="card">
        <div class="bar"><h3 style="margin:0;flex:1">Costos del bazar</h3><button class="btn ghost sm" data-a="pago">💵 Registrar pago</button><button class="btn sm" data-a="costo">＋ Agregar costo</button></div>
        ${c.costos.map(x => `<div class="line"><span>${E(x.concepto)}</span><span><b>${$(x.monto)}</b> ${x.fijo ? '' : `<button class="btn ghost sm" data-a="quitarC" data-o="${x.origen}" data-i="${x.i ?? ''}" data-id="${x.id || ''}">✕</button>`}</span></div>`).join('') || '<p class="mute">Sin costos registrados.</p>'}
      </div>

      <div class="card">
        <div class="bar"><div style="flex:1"><h3 style="margin:0">Ingresos extra de este bazar</h3><span class="mute">Dinero que no viene de vender pines o stickers: juegos, rifas, comida, propinas.</span></div><button class="btn sm" data-a="ingreso">＋ Agregar ingreso</button></div>
        ${(e.ingresos || []).map((x, i) => `<div class="line"><span>${E(x.concepto)}</span><span><b>${$(x.monto)}</b> <button class="btn ghost sm" data-a="quitarI" data-i="${i}">✕</button></span></div>`).join('') || '<p class="mute">Aún no registras ingresos extra en este bazar.</p>'}
      </div>

      <div class="card">
        <h3>Ventas por fecha</h3>
        ${fechas.map(f => `<div class="line" style="display:block"><div style="display:flex;justify-content:space-between"><span>${f} <span class="mute">· ${porFecha[f].n} venta(s)</span></span><b>${$(porFecha[f].total)}</b></div><div class="meter" style="margin:4px 0"><i style="width:${Math.round(porFecha[f].total / maxDia * 100)}%"></i></div></div>`).join('') || '<p class="mute">Aún no hay ventas ligadas a este bazar.</p>'}
      </div>`;
  }

  CC.router.register('eventos', 'Bazares', '🎪', el => {
    if (abierto && (!db.get('eventos', abierto) || db.get('eventos', abierto).eliminado)) abierto = null;
    const e = abierto ? db.get('eventos', abierto) : null;
    e ? detalleBazar(el, e) : listaBazares(el);

    el.onclick = ev => {
      const b = ev.target.closest('button');
      if (!b) return;
      const d = b.dataset, actual = abierto ? db.get('eventos', abierto) : null, delBoton = d.id ? db.get('eventos', d.id) : null;
      switch (d.a) {
        case 'nuevo': return form();
        case 'ver': abierto = d.id; return refrescar();
        case 'volver': abierto = null; return refrescar();
        case 'editar': return form(delBoton);
        case 'borrar': return eliminar(delBoton);
        case 'caja': CC.cajaSel = actual.id; location.hash = 'caja'; return;
        case 'pago': return registrarPago(actual);
        case 'costo': return agregarCosto(actual.id);
        case 'ingreso': return agregarIngreso(actual.id);
        case 'quitarC': return quitar(actual, d.o === 'gasto' ? 'gasto' : 'costos', d);
        case 'quitarI': return quitar(actual, 'ingreso', d);
        case 'mercancia': return agregarMercancia(actual, d.tema);
        case 'mas': return ajustar(actual, d.v, 1);
        case 'menos': return ajustar(actual, d.v, -1);
        case 'quitarM': return quitarMercancia(actual, d.v);
      }
    };
    const nuevo = el.querySelector('#nuevo');
    if (nuevo) nuevo.onclick = () => form();
  });
})();