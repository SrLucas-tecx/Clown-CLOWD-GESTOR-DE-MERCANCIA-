// Bolsita sorpresa: las piezas que no salen en varios bazares pasan a una RESERVA, y de ahí se arman bolsitas
// (ej. 3 pines + 1 sticker) que se venden como cualquier producto en Venta y Modo bazar.
// La regla de «cuántos bazares sin salir» se cambia en Ajustes → Reglas.
(() => {
  const {db, ui} = CC;
  const E = ui.esc, $ = ui.money, G = CC.grupos;
  const norm = s => String(s || '').trim().toLowerCase();
  const NOMBRE_PRODUCTO = 'Bolsita sorpresa', CATEGORIA = 'Bolsitas';
  const SECCIONES = [['Pines', 'pines'], ['Stickers', 'stickers'], ['Otros', 'otras piezas']];

  const refrescar = () => {
    const y = window.scrollY, contenedor = document.querySelector('.page-content'), yc = contenedor ? contenedor.scrollTop : 0;
    CC.router.show();
    window.scrollTo(0, y);
    if (contenedor) contenedor.scrollTop = yc;
  };

  // ---------------------------------------------------------------------------------------------
  // Reserva: piezas sueltas que ya no están en el inventario normal
  // ---------------------------------------------------------------------------------------------
  const reservaDe = v => db.all('sorpresa').filter(x => x.varianteId === v.id).reduce((s, x) => s + x.cant, 0);
  const esBolsita = v => { const p = db.get('productos', v.productoId); return !!p && !p.eliminado && p.producto === NOMBRE_PRODUCTO && p.categoria === CATEGORIA; };

  // Reserva agrupada por tema y tipo, con la sección de cada pieza (Pines / Stickers / Otros).
  const reservaPorGrupo = () => G.construir().map(g => {
    const piezas = g.variantes.map(v => ({v, n: reservaDe(v)})).filter(x => x.n > 0);
    return {g, piezas, total: piezas.reduce((s, x) => s + x.n, 0)};
  }).filter(x => x.total > 0);

  // Pasa piezas del inventario normal a la reserva (salen primero las más antiguas).
  function pasarAReserva(g, cantidad) {
    G.repartir(g, cantidad).forEach(({v, cant}) => {
      CC.mover(v.id, -cant, 'sorpresa', 'Pasó a bolsita sorpresa');
      db.add('sorpresa', {varianteId: v.id, cant, nota: 'entrada', fecha: ui.hoy()});
    });
  }

  function regresar(item) {
    const copia = JSON.stringify(db.crudo());
    item.piezas.forEach(({v, n}) => {
      CC.mover(v.id, n, 'sorpresa', 'Regresó de bolsita sorpresa');
      db.add('sorpresa', {varianteId: v.id, cant: -n, nota: 'regreso', fecha: ui.hoy()});
    });
    refrescar();
    ui.deshacer('Piezas regresadas al inventario.', copia);
  }

  // Ventana para pasar piezas a la reserva (desde un candidato o a mano).
  function formPasar(clavePre = '') {
    const grupos = G.construir().filter(g => g.stock > 0 && !esBolsita(g.variantes[0]));
    if (!grupos.length) return ui.toast('No hay piezas con stock para pasar');
    const inicial = clavePre && grupos.some(g => g.clave === clavePre) ? clavePre : grupos[0].clave;
    ui.modal('Pasar piezas a la bolsita sorpresa', `
      <label>Tema y tipo<select class="inp" name="g">${grupos.map(g => `<option value="${E(g.clave)}" ${g.clave === inicial ? 'selected' : ''}>${E(g.tema)} · ${E(g.etiqueta)} (hay ${g.stock})</option>`).join('')}</select></label>
      ${ui.inp('n', 'Cuántas piezas pasan', '', 'number', 'min="1" step="1"')}`, m => {
      const o = ui.vals(m), g = grupos.find(x => x.clave === o.g), n = Math.floor(+o.n);
      if (!(n >= 1)) { ui.toast('Escribe cuántas piezas pasan'); return false; }
      if (n > g.stock) { ui.toast(`Solo hay ${g.stock} de "${g.tema} · ${g.etiqueta}"`); return false; }
      const copia = JSON.stringify(db.crudo());
      pasarAReserva(g, n);
      refrescar();
      ui.deshacer(`${n} pieza(s) pasaron a la bolsita sorpresa.`, copia);
    });
    const raiz = document.getElementById('modal');
    raiz.querySelector('[name=n]').value = (grupos.find(g => g.clave === inicial) || {}).stock || '';
    raiz.onchange = () => { const g = grupos.find(x => x.clave === raiz.querySelector('[name=g]').value); raiz.querySelector('[name=n]').value = g ? g.stock : ''; };
  }

  // ---------------------------------------------------------------------------------------------
  // Armar bolsitas con las piezas de la reserva
  // ---------------------------------------------------------------------------------------------
  function formArmar() {
    const reserva = reservaPorGrupo(), bolsas = db.all('variantes').filter(esBolsita);
    const disponible = Object.fromEntries(SECCIONES.map(([s]) => [s, reserva.filter(r => r.g.seccion === s).reduce((t, r) => t + r.total, 0)]));
    if (!Object.values(disponible).some(n => n > 0)) return ui.toast('La reserva está vacía: primero pasa piezas a la bolsita sorpresa');

    ui.modal('Armar bolsitas sorpresa', `
      <label>Tipo de bolsita
        <select class="inp" name="bolsa"><option value="__nueva__">➕ Bolsita nueva…</option>${bolsas.map(v => `<option value="${v.id}">${E(v.nombre)} (hay ${Math.max(0, CC.stock(v.id))})</option>`).join('')}</select></label>
      <div id="ar-nueva"><div class="grid2">${ui.inp('nombre', 'Nombre (ej. Chica, 3 pines + 1 sticker)')}${ui.inp('precio', 'Precio de venta', '', 'number', 'min="0" step="0.01"')}</div></div>
      <p class="mute" style="margin:8px 0 2px">¿Qué lleva cada bolsita?</p>
      <div class="grid3">${SECCIONES.map(([s, texto]) => ui.inp('c_' + s, `${texto[0].toUpperCase() + texto.slice(1)} por bolsita (hay ${disponible[s]})`, 0, 'number', 'min="0" step="1"')).join('')}</div>
      ${ui.inp('cantidad', '¿Cuántas bolsitas armas?', 1, 'number', 'min="1" step="1"')}
      <div class="card" id="ar-res" style="margin:10px 0 0;font-size:.9rem"></div>`, m => {
      const e = calcular();
      if (e.error) { ui.toast(e.error); return false; }
      guardar(e);
    });

    const raiz = document.getElementById('modal'), q = s => raiz.querySelector(s);
    // Qué piezas se usarán de cada sección (primero las más antiguas) y cuánto cuestan.
    function calcular() {
      const o = ui.vals(raiz), nueva = o.bolsa === '__nueva__', cantidad = Math.floor(+o.cantidad) || 0;
      const porBolsa = Object.fromEntries(SECCIONES.map(([s]) => [s, Math.floor(+o['c_' + s]) || 0]));
      const usos = [];
      let costoTotal = 0, error = '';
      SECCIONES.forEach(([s, texto]) => {
        let falta = porBolsa[s] * cantidad;
        if (falta > disponible[s]) error = error || `Faltan ${texto} en la reserva: necesitas ${falta} y hay ${disponible[s]}.`;
        reserva.filter(r => r.g.seccion === s).forEach(r => r.piezas.slice().sort((a, b) => String(a.v.creado).localeCompare(String(b.v.creado))).forEach(({v, n}) => {
          const toma = Math.min(falta, n);
          if (toma > 0) { usos.push({v, cant: toma}); costoTotal += toma * (v.costo || 0); falta -= toma; }
        }));
      });
      const piezasPorBolsa = Object.values(porBolsa).reduce((a, b) => a + b, 0);
      if (!error && nueva && !o.nombre.trim()) error = 'Ponle un nombre a la bolsita.';
      if (!error && nueva && !(+o.precio > 0)) error = 'Pon el precio de venta de la bolsita.';
      if (!error && !(cantidad >= 1)) error = 'Escribe cuántas bolsitas armas.';
      if (!error && !piezasPorBolsa) error = 'Cada bolsita debe llevar al menos una pieza.';
      const costoBolsa = cantidad ? costoTotal / cantidad : 0;
      return {error, o, nueva, cantidad, usos, costoBolsa, piezasPorBolsa};
    }
    const pintar = () => {
      q('#ar-nueva').style.display = q('[name=bolsa]').value === '__nueva__' ? '' : 'none';
      const e = calcular(), sugerido = CC.precioSugerido ? CC.precioSugerido(e.costoBolsa) : null;
      q('#ar-res').innerHTML = e.error ? `<span class="neg">${E(e.error)}</span>`
        : `Se usarán <b>${e.usos.reduce((s, u) => s + u.cant, 0)}</b> pieza(s) de la reserva · costo por bolsita <b>${$(e.costoBolsa)}</b>${sugerido ? ` · precio sugerido <b>${$(sugerido)}</b>` : ''}`;
    };
    raiz.oninput = raiz.onchange = pintar;
    pintar();

    function guardar(e) {
      const copia = JSON.stringify(db.crudo());
      let v = e.nueva ? null : db.get('variantes', e.o.bolsa);
      if (!v) {
        let p = db.all('productos').find(x => x.producto === NOMBRE_PRODUCTO && x.categoria === CATEGORIA);
        if (!p) p = db.add('productos', {producto: NOMBRE_PRODUCTO, categoria: CATEGORIA, coleccion: NOMBRE_PRODUCTO, etiquetas: [], porConfirmar: false});
        v = db.all('variantes').find(x => x.productoId === p.id && norm(x.nombre) === norm(e.o.nombre));
        if (!v) v = db.add('variantes', {productoId: p.id, nombre: e.o.nombre.trim(), sku: '', tipoId: '', costo: 0, precio: +e.o.precio, minimo: 0, extra: 0, escCant: 0, escTotal: 0, receta: [], origen: 'sorpresa'});
      }
      const stock = Math.max(0, CC.stock(v.id)), costoAntes = v.costo || 0;
      const costo = stock && costoAntes ? (stock * costoAntes + e.costoBolsa * e.cantidad) / (stock + e.cantidad) : e.costoBolsa;
      db.update('variantes', v.id, {costo: Math.round(costo * 100) / 100});
      CC.mover(v.id, e.cantidad, 'entrada', 'Bolsitas sorpresa armadas');
      e.usos.forEach(u => db.add('sorpresa', {varianteId: u.v.id, cant: -u.cant, nota: 'armado', fecha: ui.hoy()}));
      refrescar();
      ui.deshacer(`${e.cantidad} bolsita(s) lista(s) para vender en Venta → Bolsita sorpresa.`, copia);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Pantalla: Inventario → Bolsita sorpresa
  // ---------------------------------------------------------------------------------------------
  CC.router.register('sorpresa', 'Bolsita sorpresa', '🎁', el => {
    const a = CC.analisisBazares(), reglas = a.reglas, reserva = reservaPorGrupo();
    const bolsas = db.all('variantes').filter(esBolsita);
    const kpi = (t, v, d = '') => `<div class="kpi"><small>${t}</small><b>${v}</b>${d ? `<span class="mute">${d}</span>` : ''}</div>`;
    const sinBolsas = a.candidatos.filter(f => !esBolsita(f.g.variantes[0]));

    el.innerHTML = `
      <div class="bar">
        <div style="flex:1;min-width:240px"><h3 style="margin:0">Bolsita sorpresa</h3>
          <p class="mute" style="margin:2px 0 0">Las piezas que no salen en varios bazares pasan a una reserva, y de ahí armas bolsitas para vender.</p></div>
        <button class="btn ghost" data-a="pasar">＋ Pasar piezas</button>
        <button class="btn" data-a="armar">🎁 Armar bolsitas</button>
      </div>

      <div class="kpis">
        ${kpi('Piezas en reserva', reserva.reduce((s, r) => s + r.total, 0), 'listas para armar')}
        ${kpi('Bolsitas en stock', bolsas.reduce((s, v) => s + Math.max(0, CC.stock(v.id)), 0), 'para vender')}
        ${kpi('Candidatos', sinBolsas.length, `${reglas.bazares} bazares con rotación < ${reglas.rotacion}%`)}
      </div>

      <div class="card"><div class="bar" style="margin:0 0 6px"><h3 style="margin:0;flex:1">Candidatos por la regla</h3>
        <button class="btn ghost sm" data-a="comparativa">📊 Ver comparativa</button><button class="btn ghost sm" data-a="reglas">⚙️ Cambiar regla</button></div>
        ${sinBolsas.map(f => `
          <div class="line" style="gap:8px;flex-wrap:wrap"><span style="flex:1;min-width:200px"><b>${f.g.icono} ${E(f.g.tema)} · ${E(f.g.etiqueta)}</b>
            <div class="mute">en stock ${f.g.stock} · no salió en ${f.sinSalir} de ${f.bazaresLlevado} bazar(es) · rotación ${f.rotacion}%</div></span>
            <button class="btn sm" data-a="pasarEste" data-k="${E(f.g.clave)}">Pasar a bolsita</button></div>`).join('')
          || `<p class="mute">Ninguna pieza cumple la regla todavía. Se llenará cuando lleves piezas a bazares y no salgan. También puedes usar «＋ Pasar piezas» a mano.</p>`}
      </div>

      <div class="card"><h3>Reserva (piezas sueltas)</h3>
        ${reserva.map(r => `<div class="line"><span>${r.g.icono} ${E(r.g.tema)} · ${E(r.g.etiqueta)}</span>
          <span><b>${r.total}</b> pzs <button class="btn ghost sm" data-a="regresar" data-k="${E(r.g.clave)}">↩️ Regresar</button></span></div>`).join('') || '<p class="mute">La reserva está vacía.</p>'}
      </div>

      <div class="card"><h3>Bolsitas armadas</h3>
        ${bolsas.map(v => `<div class="line"><span><b>🎁 ${E(v.nombre)}</b><div class="mute">costo ${$(v.costo)} · precio ${$(v.precio)}</div></span><b>${Math.max(0, CC.stock(v.id))} en stock</b></div>`).join('')
          || '<p class="mute">Aún no armas bolsitas. Pasa piezas a la reserva y pulsa «🎁 Armar bolsitas»: aparecerán en Venta como «Bolsita sorpresa».</p>'}
      </div>`;

    el.onclick = e => {
      const b = e.target.closest('button[data-a]');
      if (!b) return;
      const d = b.dataset;
      if (d.a === 'pasar') formPasar();
      else if (d.a === 'pasarEste') formPasar(d.k);
      else if (d.a === 'armar') formArmar();
      else if (d.a === 'comparativa') location.hash = 'comparativa';
      else if (d.a === 'reglas') location.hash = 'reglas';
      else if (d.a === 'regresar') regresar(reserva.find(r => r.g.clave === d.k));
    };
  });

  // ---------------------------------------------------------------------------------------------
  // Pantalla: Ajustes → Reglas (cuándo una pieza se vuelve candidata a la bolsita sorpresa)
  // ---------------------------------------------------------------------------------------------
  CC.router.register('reglas', 'Reglas', '📏', el => {
    const r = CC.reglasSorpresa();
    el.innerHTML = `
      <div class="card" style="max-width:720px">
        <h3 style="margin:0 0 4px">🎁 Bolsita sorpresa: ¿cuándo una pieza es candidata?</h3>
        <p class="mute" style="margin:0 0 10px">Una pieza «no sale» en un bazar cuando su rotación queda por debajo del porcentaje mínimo. Si no sale en varios bazares seguidos de este tipo, se propone para la bolsita sorpresa.</p>
        <div class="grid2">
          ${ui.inp('bazares', 'A partir de cuántos bazares sin salir', r.bazares, 'number', 'min="1" step="1"')}
          ${ui.inp('rotacion', 'Rotación mínima por bazar (%)', r.rotacion, 'number', 'min="0" max="100" step="1"')}
        </div>
        <p class="mute" style="margin:10px 0 0">Ejemplo con 3 bazares y 30%: si llevas «Gatos · Mini pin» a 3 bazares y en cada uno vendes menos del 30% de lo que llevaste, aparece como candidato en Inventario → Bolsita sorpresa.</p>
      </div>`;
    el.onchange = () => {
      const bazares = Math.floor(+el.querySelector('[name=bazares]').value), rotacion = +el.querySelector('[name=rotacion]').value;
      if (!(bazares >= 1)) { ui.toast('Pon al menos 1 bazar'); return CC.router.show(); }
      if (!(rotacion >= 0 && rotacion <= 100)) { ui.toast('La rotación debe estar entre 0 y 100 %'); return CC.router.show(); }
      CC.guardarReglasSorpresa({bazares, rotacion});
      ui.toast('Regla guardada');
    };
  });
})();
