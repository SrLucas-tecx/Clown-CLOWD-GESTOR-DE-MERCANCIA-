// Comparativa de bazares: qué temas y tipos llevaste a cada bazar, cuánto salió y qué rotación tuvo.
// También decide qué piezas son candidatas a la bolsita sorpresa: las que llevas a varios bazares y no salen.
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

  CC.router.register('comparativa', 'Comparativa', '📊', el => {
    const a = CC.analisisBazares(), reglas = a.reglas;
    const mostrados = ultimos ? a.bazares.slice(-ultimos) : a.bazares;
    const temas = G.temasDe(a.filas.map(f => f.g));
    if (temaVista !== 'todos' && !temas.includes(temaVista)) temaVista = 'todos';
    const filas = a.filas.filter(f => temaVista === 'todos' || f.g.tema === temaVista)
      .sort((x, y) => y.sinSalir - x.sinSalir || x.g.tema.localeCompare(y.g.tema, 'es') || x.g.etiqueta.localeCompare(y.g.etiqueta, 'es'));
    const resumenMostrado = a.resumen.filter(r => mostrados.includes(r.b));

    el.innerHTML = `
      <div class="bar">
        <div style="flex:1;min-width:240px"><h3 style="margin:0">Comparativa de bazares</h3>
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
          || `<tr><td colspan="${mostrados.length + 2}" class="mute">Aún no hay datos: asigna mercancía a tus bazares (Negocio → Bazares → Mercancía que llevas).</td></tr>`}</tbody></table></div>`;

    el.querySelector('#tema').onchange = e => { temaVista = e.target.value; CC.router.show(); };
    el.querySelector('#rango').onchange = e => { ultimos = +e.target.value; CC.router.show(); };
    const ir = el.querySelector('#irSorpresa');
    if (ir) ir.onclick = () => { location.hash = 'sorpresa'; };
  });
})();
