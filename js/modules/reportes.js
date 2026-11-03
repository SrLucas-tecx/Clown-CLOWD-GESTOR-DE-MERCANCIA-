// Reportes con gráficas prediseñadas (sin librerías: funcionan sin internet y se adaptan a celular):
// ventas por fecha, por tema, Pines/Stickers/Otros, tipos más vendidos, forma de pago, por bazar,
// interés contra ventas y una tabla por tema (ventas, interés y ganancia). Todo se puede bajar en Excel.
(() => {
  const {db, ui} = CC;
  const E = ui.esc, $ = ui.money, G = CC.grupos;
  const norm = s => String(s || '').trim().toLowerCase();
  const r2 = x => Math.round(x * 100) / 100;
  const COLORES = ['var(--amarillo)', 'var(--rojo)', 'var(--color-success, #3fd08f)', 'var(--azul-300)', '#b388ff', '#4dabf7', '#ff6b9d', '#ffa94d'];

  // Filtros (se conservan mientras no cierres la página)
  const filtro = {rango: '30', desde: '', hasta: '', bazar: 'all'};

  const sumarDias = (fecha, n) => { const d = new Date(fecha + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv'); };
  const limites = () => {
    const hoy = ui.hoy();
    if (filtro.rango === 'todo') return ['', ''];
    if (filtro.rango === 'custom') return [filtro.desde, filtro.hasta];
    return [sumarDias(hoy, -(+filtro.rango - 1)), hoy];
  };

  // ---------------------------------------------------------------------------------------------
  // Datos del periodo
  // ---------------------------------------------------------------------------------------------
  function recopilar() {
    const [desde, hasta] = limites(), grupos = G.construir(), grupoDe = new Map();
    grupos.forEach(g => g.variantes.forEach(v => grupoDe.set(v.id, g)));
    const enRango = f => (!desde || f >= desde) && (!hasta || f <= hasta);
    const enBazar = id => filtro.bazar === 'all' || (filtro.bazar === 'none' ? !id : id === filtro.bazar);

    const ventas = CC.ventasOk().filter(v => enRango(v.fecha) && enBazar(v.eventoId));
    const porDia = new Map(), porTema = new Map(), porSeccion = new Map(), porTipo = new Map(), porPago = new Map(), porBazar = new Map();
    const acumula = (mapa, clave, datos) => { const x = mapa.get(clave) || {}; Object.keys(datos).forEach(k => { x[k] = (x[k] || 0) + datos[k]; }); mapa.set(clave, x); };

    ventas.forEach(v => {
      const util = CC.utilidad([v]);
      acumula(porDia, v.fecha, {total: v.total, ventas: 1});
      acumula(porPago, v.pago, {total: v.total});
      acumula(porBazar, v.eventoId || '', {vendido: v.total, ganancia: util, ventas: 1});
      v.items.forEach(i => {
        const g = grupoDe.get(i.varianteId), tema = g ? g.tema : G.SIN_TEMA, seccion = g ? g.seccion : 'Otros', ingreso = i.precio * i.cant;
        acumula(porTema, tema, {piezas: i.cant, ingreso, ganancia: (i.precio - i.costo) * i.cant});
        acumula(porSeccion, seccion, {piezas: i.cant, ingreso});
        acumula(porTipo, g ? `${g.etiqueta} (${g.tema})` : i.nombre, {piezas: i.cant, ingreso});
      });
    });

    // Interés: consultas del mismo periodo y bazar, por tema.
    const consultas = new Map();
    db.all('consultas').filter(c => enRango(c.fecha) && enBazar(c.eventoId)).forEach(c => {
      let tema = G.SIN_TEMA;
      if (c.tipo) { const t = c.temaId ? db.get('temas', c.temaId) : null; tema = (t && !t.eliminado ? t.nombre : c.tema) || G.SIN_TEMA; }
      else if (c.varianteId) { const g = grupoDe.get(c.varianteId); tema = g ? g.tema : G.SIN_TEMA; }
      acumula(consultas, tema, {n: c.cant});
    });

    const stockTema = {};
    grupos.forEach(g => { stockTema[g.tema] = (stockTema[g.tema] || 0) + g.stock; });
    const temas = [...new Set([...porTema.keys(), ...consultas.keys()])];
    const filasTema = temas.map(t => {
      const x = porTema.get(t) || {}, c = (consultas.get(t) || {}).n || 0;
      return {tema: t, piezas: x.piezas || 0, ingreso: x.ingreso || 0, ganancia: x.ganancia || 0, consultas: c, stock: stockTema[t] || 0};
    }).sort((a, b) => b.ingreso - a.ingreso || b.consultas - a.consultas);

    return {desde, hasta, ventas, porDia, porSeccion, porTipo, porPago, porBazar, filasTema,
      total: ventas.reduce((s, v) => s + v.total, 0), ganancia: CC.utilidad(ventas), piezas: ventas.reduce((s, v) => s + v.items.reduce((a, i) => a + i.cant, 0), 0)};
  }

  // ---------------------------------------------------------------------------------------------
  // Gráficas (HTML y SVG)
  // ---------------------------------------------------------------------------------------------
  const vacio = '<p class="mute">Sin datos en este periodo.</p>';

  // Barras horizontales: [{label, valor, color?}]
  const barrasH = (filas, formato = n => n) => {
    if (!filas.length) return vacio;
    const max = Math.max(...filas.map(f => f.valor), 1);
    return filas.map((f, i) => `
      <div style="margin:8px 0"><div style="display:flex;justify-content:space-between;gap:8px"><span>${E(f.label)}</span><b>${formato(f.valor)}</b></div>
        <div class="meter" style="margin:3px 0"><i style="width:${Math.max(2, f.valor / max * 100)}%;background:${f.color || COLORES[i % COLORES.length]}"></i></div></div>`).join('');
  };

  // Dos series por fila (por ejemplo vendido y ganancia, o consultas y piezas vendidas).
  const barrasDobles = (filas, nombres, formatos) => {
    if (!filas.length) return vacio;
    const max = Math.max(...filas.flatMap(f => [f.a, f.b]), 1);
    return `<div class="mute" style="display:flex;gap:14px;margin-bottom:4px"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${COLORES[0]}"></i> ${nombres[0]}</span><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${COLORES[2]}"></i> ${nombres[1]}</span></div>`
      + filas.map(f => `
        <div style="margin:10px 0"><div><b>${E(f.label)}</b></div>
          <div style="display:flex;align-items:center;gap:8px"><div class="meter" style="flex:1;margin:3px 0"><i style="width:${Math.max(2, Math.max(0, f.a) / max * 100)}%;background:${COLORES[0]}"></i></div><span style="min-width:70px;text-align:right">${formatos[0](f.a)}</span></div>
          <div style="display:flex;align-items:center;gap:8px"><div class="meter" style="flex:1;margin:3px 0"><i style="width:${Math.max(2, Math.max(0, f.b) / max * 100)}%;background:${COLORES[2]}"></i></div><span style="min-width:70px;text-align:right">${formatos[1](f.b)}</span></div></div>`).join('');
  };

  // Columnas verticales (ventas por fecha): [{etiqueta, valor, detalle}]
  const columnas = puntos => {
    if (!puntos.length) return vacio;
    const ancho = 640, alto = 230, margenIzq = 46, margenInf = 34, util = ancho - margenIzq - 8, max = Math.max(...puntos.map(p => p.valor), 1);
    const paso = util / puntos.length, barra = Math.max(4, Math.min(56, paso * 0.68)), cada = Math.max(1, Math.ceil(puntos.length / 8));
    const y = v => alto - margenInf - v / max * (alto - margenInf - 14);
    return `<svg viewBox="0 0 ${ancho} ${alto}" style="width:100%;height:auto;max-height:320px;display:block" role="img" aria-label="Ventas por fecha">
      ${[0, .5, 1].map(t => `<line x1="${margenIzq}" x2="${ancho - 8}" y1="${y(max * t)}" y2="${y(max * t)}" stroke="var(--azul-600)" stroke-dasharray="3 4"/><text x="${margenIzq - 6}" y="${y(max * t) + 4}" text-anchor="end" style="fill:var(--azul-300);font-size:11px">${t ? '$' + Math.round(max * t).toLocaleString('es-MX') : '0'}</text>`).join('')}
      ${puntos.map((p, i) => { const x = margenIzq + paso * i + (paso - barra) / 2;
        return `<rect x="${x}" y="${y(p.valor)}" width="${barra}" height="${alto - margenInf - y(p.valor)}" rx="3" fill="var(--amarillo)"><title>${E(p.detalle)}</title></rect>${i % cada === 0 ? `<text x="${x + barra / 2}" y="${alto - 14}" text-anchor="middle" style="fill:var(--azul-300);font-size:11px">${E(p.etiqueta)}</text>` : ''}`; }).join('')}
    </svg>`;
  };

  // Dona con leyenda: [{label, valor, color?}]
  const dona = (items, formato) => {
    const total = items.reduce((s, i) => s + i.valor, 0);
    if (!total) return vacio;
    let acumulado = 0;
    const arcos = items.map((it, i) => { const pct = it.valor / total * 100, arco = `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${it.color || COLORES[i % COLORES.length]}" stroke-width="7" stroke-dasharray="${pct} ${100 - pct}" stroke-dashoffset="${25 - acumulado}"><title>${E(it.label)}: ${formato(it.valor)}</title></circle>`; acumulado += pct; return arco; }).join('');
    return `<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
      <svg viewBox="0 0 42 42" style="width:150px;height:150px;flex:0 0 auto" role="img"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--azul-700)" stroke-width="7"/>${arcos}
        <text x="21" y="22.5" text-anchor="middle" style="fill:currentColor;font-size:5px;font-weight:700">${formato(total)}</text></svg>
      <div style="flex:1;min-width:140px">${items.map((it, i) => `<div class="line"><span><i style="display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px;background:${it.color || COLORES[i % COLORES.length]}"></i>${E(it.label)}</span><b>${formato(it.valor)} <span class="mute">${Math.round(it.valor / total * 100)}%</span></b></div>`).join('')}</div></div>`;
  };

  // Agrupa las ventas por día, semana o mes según qué tan largo sea el periodo.
  function seriePorFecha(d) {
    const fechas = [...d.porDia.keys()].sort();
    if (!fechas.length) return [];
    const dias = Math.round((new Date(fechas[fechas.length - 1]) - new Date(fechas[0])) / 864e5) + 1;
    const clave = f => dias <= 35 ? f : dias <= 140 ? sumarDias(f, -((new Date(f + 'T00:00:00').getDay() + 6) % 7)) : f.slice(0, 7);
    const mapa = new Map();
    fechas.forEach(f => { const k = clave(f), x = mapa.get(k) || {total: 0, ventas: 0}; x.total += d.porDia.get(f).total; x.ventas += d.porDia.get(f).ventas; mapa.set(k, x); });
    const unidad = dias <= 35 ? 'día' : dias <= 140 ? 'semana del' : 'mes';
    return [...mapa].sort().map(([k, x]) => ({etiqueta: dias <= 140 ? k.slice(5) : k, valor: x.total, detalle: `${unidad} ${k}: ${$(x.total)} · ${x.ventas} venta(s)`}));
  }

  // ---------------------------------------------------------------------------------------------
  // Pantalla
  // ---------------------------------------------------------------------------------------------
  CC.router.register('reportes', 'Reportes', '📉', el => {
    const d = recopilar(), bazares = db.all('eventos');
    const nombreBazar = id => id ? ((db.get('eventos', id) || {}).nombre || 'Bazar eliminado') : 'Sin bazar';
    const filasBazar = [...d.porBazar].map(([id, x]) => ({label: nombreBazar(id), a: x.vendido, b: x.ganancia})).sort((p, q) => q.a - p.a).slice(0, 8);
    const filasInteres = d.filasTema.filter(f => f.consultas || f.piezas).slice(0, 8).map(f => ({label: f.tema, a: f.consultas, b: f.piezas}));
    const opcion = (v, actual, t) => `<option value="${v}" ${String(v) === String(actual) ? 'selected' : ''}>${t}</option>`;
    const kpi = (t, v, c = '') => `<div class="kpi"><small>${t}</small><b class="${c}">${v}</b></div>`;

    el.innerHTML = `
      <div class="bar">
        <div style="flex:1;min-width:220px"><h3 style="margin:0">Reportes</h3><p class="mute" style="margin:2px 0 0">Gráficas listas para ver cómo va el negocio. Cambia el periodo o el bazar y todo se actualiza.</p></div>
        <button class="btn" id="xls">⬇️ Descargar Excel</button>
      </div>
      <div class="card"><div class="grid3">
        <label>Periodo<select class="inp" name="rango">${[['7', 'Últimos 7 días'], ['30', 'Últimos 30 días'], ['90', 'Últimos 90 días'], ['365', 'Último año'], ['todo', 'Todo'], ['custom', 'Elegir fechas…']].map(([v, t]) => opcion(v, filtro.rango, t)).join('')}</select></label>
        <label>Bazar<select class="inp" name="bazar">${opcion('all', filtro.bazar, 'Todos')}${opcion('none', filtro.bazar, 'Sin bazar')}${bazares.map(b => opcion(b.id, filtro.bazar, '🎪 ' + E(b.nombre))).join('')}</select></label>
        ${filtro.rango === 'custom' ? `<div class="grid2">${ui.inp('desde', 'Desde', filtro.desde, 'date')}${ui.inp('hasta', 'Hasta', filtro.hasta, 'date')}</div>` : '<div></div>'}
      </div></div>

      <div class="kpis">
        ${kpi('Ventas', d.ventas.length)}${kpi('Piezas vendidas', d.piezas)}${kpi('Total vendido', $(d.total), 'pos-n')}${kpi('Ganancia', $(d.ganancia), d.ganancia < 0 ? 'neg' : 'pos-n')}
      </div>

      <div class="card"><h3>📅 Ventas por fecha</h3>${columnas(seriePorFecha(d))}</div>

      <div class="grid2" style="align-items:start">
        <div class="card"><h3>🗂️ Ventas por tema</h3>${barrasH(d.filasTema.filter(f => f.ingreso).slice(0, 8).map(f => ({label: f.tema, valor: f.ingreso})), $)}</div>
        <div class="card"><h3>📍 Pines · Stickers · Otros</h3>${dona(['Pines', 'Stickers', 'Otros'].filter(s => d.porSeccion.has(s)).map((s, i) => ({label: s, valor: d.porSeccion.get(s).ingreso, color: COLORES[i]})), $)}</div>
      </div>
      <div class="grid2" style="align-items:start">
        <div class="card"><h3>🏆 Tipos más vendidos</h3>${barrasH([...d.porTipo].map(([label, x]) => ({label, valor: x.piezas})).sort((a, b) => b.valor - a.valor).slice(0, 8), n => n + ' pzs')}</div>
        <div class="card"><h3>💳 Forma de pago</h3>${dona([...d.porPago].map(([label, x], i) => ({label, valor: x.total, color: COLORES[i]})), $)}</div>
      </div>
      <div class="grid2" style="align-items:start">
        <div class="card"><h3>🎪 Por bazar: vendido y ganancia</h3>${barrasDobles(filasBazar, ['Vendido', 'Ganancia'], [$, $])}</div>
        <div class="card"><h3>❓ Interés contra ventas</h3><p class="mute" style="margin-top:-6px">Lo que preguntan contra lo que se vende, por tema.</p>${barrasDobles(filasInteres, ['Consultas', 'Piezas vendidas'], [n => n, n => n])}</div>
      </div>

      <div class="card"><h3>📋 Resumen por tema</h3>
        <table class="tabla-resp"><thead><tr><th>Tema</th><th>Piezas</th><th>Vendido</th><th>Ganancia</th><th>Consultas</th><th>En stock</th></tr></thead>
        <tbody>${d.filasTema.map(f => `<tr><td data-l="Tema"><b>${E(f.tema)}</b></td><td data-l="Piezas">${f.piezas}</td><td data-l="Vendido">${$(f.ingreso)}</td>
          <td data-l="Ganancia" class="${f.ganancia < 0 ? 'neg' : 'pos-n'}">${$(f.ganancia)}</td><td data-l="Consultas">${f.consultas}</td><td data-l="En stock">${f.stock}</td></tr>`).join('') || '<tr><td colspan="6" class="mute">Sin datos en este periodo.</td></tr>'}</tbody></table></div>`;

    el.onchange = e => {
      if (!(e.target.name in filtro)) return;
      filtro[e.target.name] = e.target.value;
      CC.router.show();
    };
    el.querySelector('#xls').onclick = () => {
      if (!d.ventas.length && !d.filasTema.length) return ui.toast('No hay datos para descargar en este periodo');
      CC.excel.descargar('reportes-' + ui.hoy(), {
        'Por tema': d.filasTema.map(f => ({Tema: f.tema, Piezas: f.piezas, Vendido: r2(f.ingreso), Ganancia: r2(f.ganancia), Consultas: f.consultas, 'En stock': f.stock})),
        'Por fecha': [...d.porDia].sort().map(([f, x]) => ({Fecha: f, Ventas: x.ventas, Total: r2(x.total)})),
        'Por bazar': [...d.porBazar].map(([id, x]) => ({Bazar: nombreBazar(id), Ventas: x.ventas, Vendido: r2(x.vendido), Ganancia: r2(x.ganancia)})),
        'Por tipo': [...d.porTipo].map(([t, x]) => ({Tipo: t, Piezas: x.piezas, Ingresos: r2(x.ingreso)})).sort((a, b) => b.Piezas - a.Piezas),
        'Forma de pago': [...d.porPago].map(([p, x]) => ({Pago: p, Total: r2(x.total)}))
      });
    };
  });
})();
