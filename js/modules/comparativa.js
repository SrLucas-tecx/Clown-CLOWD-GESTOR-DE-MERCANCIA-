// Comparativa de bazares en tres pestañas:
//   ⚖️ Comparar bazares: un bazar contra otro, métrica por métrica.
//   📋 Por tema y tipo: qué llevaste a cada bazar, cuánto salió y qué rotación tuvo.
//   🎁 Bolsita sorpresa: las piezas que llevas a varios bazares y no salen (ver sorpresa.js).
(() => {
  const {db, ui} = CC;
  const E = ui.esc, $ = ui.money, G = CC.grupos;
  const CLAVE_BAZARES = 'clowncloud:sorpresaBazares';
  const CLAVE_ROTACION = 'clowncloud:sorpresaRotacion';
  let temaVista = 'todos';
  let ultimos = 5;

  // Regla de la bolsita sorpresa (se cambia en Ajustes → Reglas).
  CC.reglasSorpresa = () => {
    const bazares = parseInt(localStorage.getItem(CLAVE_BAZARES)), rotacion = parseFloat(localStorage.getItem(CLAVE_ROTACION));
    return {bazares: bazares >= 1 ? bazares : 3, rotacion: isFinite(rotacion) ? rotacion : 30};
  };
  CC.guardarReglasSorpresa = ({bazares, rotacion}) => {
    localStorage.setItem(CLAVE_BAZARES, bazares);
    localStorage.setItem(CLAVE_ROTACION, rotacion);
  };

  // Cruza lo que se llevó a cada bazar (maleta) con lo que se vendió allá, por tema y tipo.
  CC.analisisBazares = () => {
    const grupos = G.construir(), reglas = CC.reglasSorpresa(), hoy = ui.hoy();
    const bazares = db.all('eventos').filter(b => (b.fecha || hoy) <= hoy)
      .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')) || String(a.creado).localeCompare(String(b.creado)));
    const claveDe = new Map();
    grupos.forEach(g => g.variantes.forEach(v => claveDe.set(v.id, g.clave)));
    const filas = new Map(grupos.map(g => [g.clave, {g, celdas: {}}]));
    const celda = (clave, bazarId) => { const f = filas.get(clave); return f.celdas[bazarId] = f.celdas[bazarId] || {llevo: 0, vend: 0}; };
    const ventas = CC.ventasOk();

    const resumen = bazares.map(b => {
      const maleta = db.all('maletas').find(m => m.eventoId === b.id), ventasB = ventas.filter(v => v.eventoId === b.id);
      (maleta ? maleta.items : []).forEach(i => { const clave = claveDe.get(i.varianteId); if (clave) celda(clave, b.id).llevo += i.llevo; });
      ventasB.forEach(v => v.items.forEach(i => { const clave = claveDe.get(i.varianteId); if (clave && celda(clave, b.id).llevo > 0) celda(clave, b.id).vend += i.cant; }));
      return {b, vendido: ventasB.reduce((s, v) => s + v.total, 0), utilidad: CC.utilidad(ventasB), ventas: ventasB.length,
        consultas: db.all('consultas').filter(c => c.eventoId === b.id).reduce((s, c) => s + c.cant, 0)};
    });
    resumen.forEach(r => {
      const celdas = [...filas.values()].map(f => f.celdas[r.b.id]).filter(Boolean);
      r.llevadas = celdas.reduce((s, c) => s + c.llevo, 0);
      r.vendidas = celdas.reduce((s, c) => s + c.vend, 0);
      r.rotacion = r.llevadas ? Math.round(r.vendidas / r.llevadas * 100) : null;
    });

    const lista = [...filas.values()].map(f => {
      const usadas = bazares.map(b => f.celdas[b.id]).filter(c => c && c.llevo > 0);
      const sinSalir = usadas.filter(c => c.vend / c.llevo * 100 < reglas.rotacion).length;
      const llevo = usadas.reduce((s, c) => s + c.llevo, 0), vend = usadas.reduce((s, c) => s + c.vend, 0);
      return {...f, bazaresLlevado: usadas.length, sinSalir, rotacion: llevo ? Math.round(vend / llevo * 100) : null};
    }).filter(f => f.bazaresLlevado > 0);

    return {bazares, resumen, filas: lista, reglas, candidatos: lista.filter(f => f.g.stock > 0 && f.sinSalir >= reglas.bazares)};
  };

  // Color de una celda según su rotación (verde sale bien, ámbar regular, rojo no sale).
  const colorRotacion = (rot, umbral) => rot === null ? 'transparent' : rot >= 60 ? 'rgba(63,208,143,.25)' : rot >= umbral ? 'rgba(255,201,51,.22)' : 'rgba(227,54,61,.30)';

  let vista = 'comparar', idA = '', idB = '';
  // Cambia de pestaña desde otros módulos (por ejemplo, desde la Bolsita sorpresa).
  CC.comparativa = {ir(v) { vista = v; CC.router.show(); }};

  // ---------------------------------------------------------------------------------------------
  // Números de un bazar para compararlo
  // ---------------------------------------------------------------------------------------------
  function datosBazar(b, a) {
    const vs = CC.ventasOk().filter(v => v.eventoId === b.id);
    const vendido = vs.reduce((s, v) => s + v.total, 0), util = CC.utilidad(vs), com = vs.reduce((s, v) => s + (v.comision || 0), 0);
    const ingresos = b.ingresos || [], extra = ingresos.reduce((s, x) => s + x.monto, 0), deJuegos = ingresos.filter(x => x.juegoId);
    const gastos = db.all('gastos').filter(g => g.eventoId === b.id).reduce((s, g) => s + g.monto, 0);
    const gas = (+b.mesa || +b.espacio || 0) + (b.costos || []).reduce((s, c) => s + c.monto, 0) + gastos;
    const r = a.resumen.find(x => x.b.id === b.id);
    return {
      b, ventas: vs.length, vendido, neto: util + extra - gas - com, gas, ticket: vs.length ? vendido / vs.length : 0,
      llevadas: r ? r.llevadas : 0, vendidasMaleta: r ? r.vendidas : 0, rotacion: r ? r.rotacion : null,
      consultas: db.all('consultas').filter(c => c.eventoId === b.id).reduce((s, c) => s + c.cant, 0),
      dinJuegos: deJuegos.reduce((s, x) => s + x.monto, 0), personas: deJuegos.reduce((s, x) => s + (+x.personas || 0), 0), dias: +b.dias || 1
    };
  }

  // [etiqueta, campo, formato, qué es mejor: 'mas' | 'menos' | null]
  const METRICAS = [
    ['Vendido', 'vendido', $, 'mas'],
    ['Ganancia real', 'neto', $, 'mas'],
    ['Costos del bazar', 'gas', $, 'menos'],
    ['Ventas', 'ventas', n => n, 'mas'],
    ['Ticket promedio', 'ticket', $, 'mas'],
    ['Piezas llevadas', 'llevadas', n => n, null],
    ['Piezas vendidas', 'vendidasMaleta', n => n, 'mas'],
    ['Rotación', 'rotacion', n => n + '%', 'mas'],
    ['Consultas', 'consultas', n => n, null],
    ['🎲 Juegos contados', 'dinJuegos', $, 'mas'],
    ['👥 Personas que jugaron', 'personas', n => n, 'mas'],
    ['Días', 'dias', n => n, null]
  ];

  // ---------------------------------------------------------------------------------------------
  // Pestaña: Comparar bazares
  // ---------------------------------------------------------------------------------------------
  function pintarComparar(cont, a) {
    const bazares = db.all('eventos').slice().sort((x, y) => String(y.fecha || '').localeCompare(String(x.fecha || '')) || String(y.creado).localeCompare(String(x.creado)));
    if (bazares.length < 2) {
      cont.innerHTML = '<div class="card"><p class="mute">Necesitas al menos 2 bazares para compararlos. Crea otro en Bazares → Mis bazares.</p></div>';
      return;
    }
    const ids = bazares.map(b => b.id);
    if (!ids.includes(idA)) idA = ids.includes(CC.grupos.bazarActivo()) ? CC.grupos.bazarActivo() : ids[0];
    if (!ids.includes(idB) || idB === idA) idB = ids.find(i => i !== idA);
    const A = datosBazar(db.get('eventos', idA), a), B = datosBazar(db.get('eventos', idB), a);
    const opciones = sel => bazares.map(b => `<option value="${b.id}" ${b.id === sel ? 'selected' : ''}>🎪 ${E(b.nombre)}${b.fecha ? ' · ' + E(b.fecha) : ''}</option>`).join('');
    const sub = b => [b.lugar, b.fecha].filter(Boolean).map(E).join(' · ') || 'Sin fecha ni lugar';
    const num = (D, k) => D[k] === null ? -1 : D[k];
    const texto = (D, m) => D[m[1]] === null ? '—' : m[2](D[m[1]]);

    const fila = m => {
      const va = num(A, m[1]), vb = num(B, m[1]);
      const gana = !m[3] || va === vb ? '' : (m[3] === 'mas' ? va > vb : va < vb) ? 'A' : 'B';
      const d = A[m[1]] === null || B[m[1]] === null ? 0 : A[m[1]] - B[m[1]];
      const dif = d ? `<small class="mute" style="display:block;font-weight:400">${d > 0 ? '+' : '−'}${m[2](Math.abs(d))}</small>` : '';
      const lado = (D, L) => `<b style="text-align:center;font-size:1.1rem;${gana === L ? 'color:var(--ok)' : ''}">${texto(D, m)}</b>`;
      return `<div style="display:grid;grid-template-columns:1fr minmax(120px,auto) 1fr;gap:8px;align-items:center;padding:9px 0;border-top:1px dashed var(--line)">${lado(A, 'A')}<span class="mute" style="text-align:center">${m[0]}${dif}</span>${lado(B, 'B')}</div>`;
    };

    const dv = A.vendido - B.vendido;
    const resumen = dv ? `En <b>${E(A.b.nombre)}</b> vendiste <b>${$(Math.abs(dv))}</b> ${dv > 0 ? 'más' : 'menos'} que en <b>${E(B.b.nombre)}</b>.` : 'Los dos bazares vendieron lo mismo.';

    // Por tema: vendidas / llevadas en cada bazar
    const temas = new Map();
    a.filas.forEach(f => {
      const x = temas.get(f.g.tema) || {A: {llevo: 0, vend: 0}, B: {llevo: 0, vend: 0}}, ca = f.celdas[idA], cb = f.celdas[idB];
      if (ca) { x.A.llevo += ca.llevo; x.A.vend += ca.vend; }
      if (cb) { x.B.llevo += cb.llevo; x.B.vend += cb.vend; }
      temas.set(f.g.tema, x);
    });
    const celda = c => { const rot = c.llevo ? Math.round(c.vend / c.llevo * 100) : null; return `<td style="text-align:center;background:${colorRotacion(rot, a.reglas.rotacion)}">${c.llevo ? `<b>${c.vend}/${c.llevo}</b><div class="mute" style="font-size:.75rem">${rot}%</div>` : '<span class="mute">—</span>'}</td>`; };
    const filasTema = [...temas].filter(([, x]) => x.A.llevo || x.B.llevo).sort((p, q) => p[0].localeCompare(q[0], 'es'));

    cont.innerHTML = `
      <div class="grid2" style="align-items:end">
        <label>Bazar<select class="inp" name="idA">${opciones(idA)}</select></label>
        <label>Comparar con<select class="inp" name="idB">${opciones(idB)}</select></label>
      </div>
      <div class="grid2">
        <div class="card" style="border-color:var(--amarillo)"><small class="mute">BAZAR ELEGIDO</small><h3 style="margin:2px 0">🎪 ${E(A.b.nombre)}</h3><span class="mute">${sub(A.b)}</span></div>
        <div class="card"><small class="mute">BAZAR COMPARADO</small><h3 style="margin:2px 0">🎪 ${E(B.b.nombre)}</h3><span class="mute">${sub(B.b)}</span></div>
      </div>
      <div class="card"><p style="margin:0 0 6px">${resumen} <span class="mute">En verde, el que va mejor en cada renglón.</span></p>${METRICAS.map(fila).join('')}</div>
      <div class="card"><h3>Por tema</h3><p class="mute" style="margin-top:-6px">Vendidas / llevadas de cada tema en los dos bazares.</p>
        <table><thead><tr><th>Tema</th><th style="text-align:center">${E(A.b.nombre)}</th><th style="text-align:center">${E(B.b.nombre)}</th></tr></thead>
        <tbody>${filasTema.map(([t, x]) => `<tr><td><b>${E(t)}</b></td>${celda(x.A)}${celda(x.B)}</tr>`).join('') || '<tr><td colspan="3" class="mute">Aún no hay mercancía asignada a estos bazares.</td></tr>'}</tbody></table></div>`;

    cont.onchange = e => {
      if (e.target.name === 'idA') idA = e.target.value;
      else if (e.target.name === 'idB') idB = e.target.value;
      else return;
      CC.router.show();
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Pestaña: Por tema y tipo
  // ---------------------------------------------------------------------------------------------
  function pintarMatriz(cont, a) {
    const reglas = a.reglas;
    const mostrados = ultimos ? a.bazares.slice(-ultimos) : a.bazares;
    const temas = G.temasDe(a.filas.map(f => f.g));
    if (temaVista !== 'todos' && !temas.includes(temaVista)) temaVista = 'todos';
    const filas = a.filas.filter(f => temaVista === 'todos' || f.g.tema === temaVista)
      .sort((x, y) => y.sinSalir - x.sinSalir || x.g.tema.localeCompare(y.g.tema, 'es') || x.g.etiqueta.localeCompare(y.g.etiqueta, 'es'));
    const resumenMostrado = a.resumen.filter(r => mostrados.includes(r.b));

    cont.innerHTML = `
      <div class="bar">
        <div style="flex:1;min-width:240px"><h3 style="margin:0">Por tema y tipo</h3>
          <p class="mute" style="margin:2px 0 0">Qué llevaste y qué salió en cada bazar. Una pieza «no sale» si su rotación queda por debajo de ${reglas.rotacion}%; con ${reglas.bazares} bazares así, pasa a candidata para la bolsita sorpresa.</p></div>
        <select class="inp" id="tema" style="max-width:200px"><option value="todos">Todos los temas</option>${temas.map(t => `<option value="${E(t)}" ${t === temaVista ? 'selected' : ''}>${E(t)}</option>`).join('')}</select>
        <select class="inp" id="rango" style="max-width:170px">${[[3, 'Últimos 3'], [5, 'Últimos 5'], [8, 'Últimos 8'], [0, 'Todos']].map(([n, t]) => `<option value="${n}" ${n === ultimos ? 'selected' : ''}>${t}</option>`).join('')}</select>
      </div>

      ${a.candidatos.length ? `<div class="card" style="border-color:var(--amarillo)"><b>🎁 ${a.candidatos.length} candidato(s) a bolsita sorpresa</b>
        <span class="mute"> · ${a.candidatos.slice(0, 4).map(f => E(f.g.tema + ' · ' + f.g.etiqueta)).join(', ')}${a.candidatos.length > 4 ? '…' : ''}</span>
        <button class="btn sm" id="irSorpresa" style="margin-left:8px">Ver bolsita sorpresa</button></div>` : ''}

      <div class="card"><h3>Resumen por bazar</h3>
        <table class="tabla-resp"><thead><tr><th>Bazar</th><th>Llevadas</th><th>Vendidas</th><th>Rotación</th><th>Vendido</th><th>Ganancia</th><th>Consultas</th></tr></thead>
        <tbody>${resumenMostrado.map(r => `<tr>
          <td data-l="Bazar"><b>🎪 ${E(r.b.nombre)}</b><div class="mute">${E(r.b.fecha || '')}</div></td>
          <td data-l="Llevadas">${r.llevadas}</td><td data-l="Vendidas">${r.vendidas}</td>
          <td data-l="Rotación" style="background:${colorRotacion(r.rotacion, reglas.rotacion)}">${r.rotacion === null ? '—' : r.rotacion + '%'}</td>
          <td data-l="Vendido">${$(r.vendido)}</td><td data-l="Ganancia" class="${r.utilidad < 0 ? 'neg' : 'pos-n'}">${$(r.utilidad)}</td><td data-l="Consultas">${r.consultas}</td></tr>`).join('')
          || '<tr><td colspan="7" class="mute">Aún no hay bazares pasados.</td></tr>'}</tbody></table></div>

      <div class="card"><h3>Por tema y tipo</h3>
        <p class="mute" style="margin-top:-6px">Cada casilla muestra vendidas / llevadas. Verde: sale bien · ámbar: regular · rojo: no sale.</p>
        <table><thead><tr><th>Tema · tipo</th>${mostrados.map(b => `<th>${E(b.nombre)}</th>`).join('')}<th>Sin salir</th></tr></thead>
        <tbody>${filas.map(f => `<tr>
          <td><b>${f.g.icono} ${E(f.g.tema)} · ${E(f.g.etiqueta)}</b><div class="mute">en stock: ${f.g.stock}</div></td>
          ${mostrados.map(b => { const c = f.celdas[b.id], rot = c && c.llevo ? Math.round(c.vend / c.llevo * 100) : null;
            return `<td style="text-align:center;background:${colorRotacion(rot, reglas.rotacion)}">${c && c.llevo ? `<b>${c.vend}/${c.llevo}</b><div class="mute" style="font-size:.75rem">${rot}%</div>` : '<span class="mute">—</span>'}</td>`; }).join('')}
          <td style="text-align:center">${f.sinSalir >= reglas.bazares && f.g.stock > 0 ? `<span class="chip" style="--c:var(--amarillo-300)">🎁 ${f.sinSalir}</span>` : f.sinSalir}</td></tr>`).join('')
          || `<tr><td colspan="${mostrados.length + 2}" class="mute">Aún no hay datos: asigna mercancía a tus bazares (Bazares → abre un bazar → Mercancía que llevas).</td></tr>`}</tbody></table></div>`;

    cont.querySelector('#tema').onchange = e => { temaVista = e.target.value; CC.router.show(); };
    cont.querySelector('#rango').onchange = e => { ultimos = +e.target.value; CC.router.show(); };
    const ir = cont.querySelector('#irSorpresa');
    if (ir) ir.onclick = () => { vista = 'sorpresa'; CC.router.show(); };
  }

  // ---------------------------------------------------------------------------------------------
  // Pantalla
  // ---------------------------------------------------------------------------------------------
  CC.router.register('comparativa', 'Comparativa', '📊', el => {
    const a = CC.analisisBazares();
    const tabs = [['comparar', '⚖️ Comparar bazares'], ['matriz', '📋 Por tema y tipo'], ['sorpresa', `🎁 Bolsita sorpresa${a.candidatos.length ? ` (${a.candidatos.length})` : ''}`]];
    el.innerHTML = `<div class="seg" id="cm-tabs">${tabs.map(([v, t]) => `<button class="${vista === v ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div><div id="cm-cuerpo"></div>`;
    el.querySelector('#cm-tabs').onclick = e => {
      const b = e.target.closest('[data-v]');
      if (b) { vista = b.dataset.v; CC.router.show(); }
    };
    const cont = el.querySelector('#cm-cuerpo');
    if (vista === 'matriz') pintarMatriz(cont, a);
    else if (vista === 'sorpresa') CC.sorpresaUI(cont);
    else pintarComparar(cont, a);
  });
})();
