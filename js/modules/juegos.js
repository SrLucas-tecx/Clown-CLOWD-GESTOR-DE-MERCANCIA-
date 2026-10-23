// Juegos: tus tipos de juego (ruleta, pesca, rifa…) y cuánto dinero se contó en cada uno, por bazar.
// Los registros viven dentro de cada bazar (sus «ingresos»); aquí se administran los tipos y se comparan.
(() => {
  const {db, ui} = CC;
  const E = ui.esc, $ = ui.money;
  const norm = s => String(s || '').trim().toLowerCase();
  const BASE = [['Ruleta', '🎡'], ['Pesca de patitos', '🦆'], ['Rifa', '🎟️'], ['Lotería', '🎴'], ['Dardos', '🎯'], ['Tiro al blanco', '🏹']];
  const MARCA_BASE = 'clowncloud:juegosBase';

  // La primera vez se crean unos juegos de ejemplo; después puedes editarlos o borrarlos.
  const juegosBase = () => {
    if (localStorage.getItem(MARCA_BASE)) return;
    localStorage.setItem(MARCA_BASE, '1');
    if (!db.all('juegos').length) BASE.forEach(([nombre, icono]) => db.add('juegos', {nombre, icono, nota: ''}));
  };

  // Vuelve a dibujar la pantalla sin perder el lugar donde estabas.
  const refrescar = () => {
    const y = window.scrollY, contenedor = document.querySelector('.page-content'), yc = contenedor ? contenedor.scrollTop : 0;
    CC.router.show();
    window.scrollTo(0, y);
    if (contenedor) contenedor.scrollTop = yc;
  };

  // Todos los registros de dinero de juegos de todos los bazares.
  const registros = () => db.all('eventos').flatMap(b => (b.ingresos || []).map((x, i) => ({...x, bazarId: b.id, bazar: b.nombre, i})));

  // ---------------------------------------------------------------------------------------------
  // Tipo de juego: crear y editar
  // ---------------------------------------------------------------------------------------------
  function formJuego(juego) {
    ui.modal(juego ? 'Editar juego' : 'Nuevo tipo de juego',
      ui.inp('nombre', 'Nombre del juego', juego ? juego.nombre : '', 'text', 'placeholder="Ej. Ruleta, Pesca de patitos"') +
      `<div class="grid2">${ui.inp('icono', 'Ícono (un emoji)', juego ? juego.icono : '🎲', 'text', 'maxlength="2"')}${ui.inp('nota', 'Nota (opcional)', juego ? juego.nota : '', 'text', 'placeholder="Ej. $10 por jugada"')}</div>`, m => {
        const o = ui.vals(m), nombre = o.nombre.trim();
        if (!nombre) { ui.toast('Falta el nombre'); return false; }
        if (db.all('juegos').some(j => norm(j.nombre) === norm(nombre) && (!juego || j.id !== juego.id))) { ui.toast('Ya existe un juego con ese nombre'); return false; }
        const datos = {nombre, icono: o.icono.trim() || '🎲', nota: o.nota.trim()};
        if (juego) db.update('juegos', juego.id, datos); else db.add('juegos', datos);
        refrescar();
      });
  }

  function eliminarJuego(juego) {
    const usos = registros().filter(r => r.juegoId === juego.id).length;
    ui.confirm(usos ? `«${juego.nombre}» tiene ${usos} registro(s). Se conservan en sus bazares, pero el juego ya no saldrá en la lista.` : `¿Eliminar el juego «${juego.nombre}»?`).then(ok => {
      if (!ok) return;
      const copia = JSON.stringify(db.crudo());
      db.remove('juegos', juego.id);
      refrescar();
      ui.deshacer('Juego eliminado.', copia);
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Agregar juegos a un bazar (lo usa también el detalle del bazar)
  // ---------------------------------------------------------------------------------------------
  CC.agregarJuego = (bazarId = '') => {
    juegosBase();
    const juegos = db.all('juegos'), bazares = db.all('eventos');
    if (!bazares.length) return ui.toast('Primero crea un bazar en Negocio → Bazares');

    ui.modal('Agregar juegos', `
      ${bazarId ? '' : `<label>Bazar<select class="inp" name="bazar">${bazares.slice().reverse().map(b => `<option value="${b.id}">🎪 ${E(b.nombre)}</option>`).join('')}</select></label>`}
      ${ui.inp('fecha', 'Fecha', ui.hoy(), 'date')}
      <p class="mute" style="margin:8px 0 4px">Escribe lo que se contó en cada juego. Deja vacíos los que no usaste.</p>
      ${juegos.map(j => `
        <div class="line" style="gap:8px"><span style="flex:1;min-width:0">${E(j.icono)} ${E(j.nombre)}${j.nota ? `<div class="mute">${E(j.nota)}</div>` : ''}</span>
          <input class="inp jg-m" data-j="${j.id}" type="number" min="0" step="0.01" placeholder="$ 0.00" style="width:120px"></div>`).join('') || '<p class="mute">Aún no tienes tipos de juego: créalos en la pestaña Juegos.</p>'}
      <label style="margin-top:10px">Otro ingreso (propinas, comida, otro juego…)</label>
      <div class="grid2"><input class="inp" name="otroN" placeholder="Concepto"><input class="inp" name="otroM" type="number" min="0" step="0.01" placeholder="$ 0.00"></div>
      <div class="card" id="jg-total" style="margin:12px 0 0;font-size:.9rem"></div>`, m => {
      const o = ui.vals(m), destino = bazarId || o.bazar, bazar = db.get('eventos', destino);
      const nuevos = [...m.querySelectorAll('.jg-m')].filter(i => +i.value > 0).map(i => {
        const j = db.get('juegos', i.dataset.j);
        return {concepto: j.nombre, monto: +i.value, juegoId: j.id, fecha: o.fecha};
      });
      if (+o.otroM > 0) nuevos.push({concepto: o.otroN.trim() || 'Otro ingreso', monto: +o.otroM, fecha: o.fecha});
      if (!nuevos.length) { ui.toast('Escribe al menos un monto'); return false; }
      db.update('eventos', destino, {ingresos: [...(bazar.ingresos || []), ...nuevos]});
      ui.toast(`Agregado: ${$(nuevos.reduce((s, x) => s + x.monto, 0))} en ${nuevos.length} registro(s)`);
      refrescar();
    });

    const raiz = document.getElementById('modal');
    const total = () => {
      const suma = [...raiz.querySelectorAll('.jg-m, [name=otroM]')].reduce((s, i) => s + (+i.value || 0), 0);
      raiz.querySelector('#jg-total').innerHTML = suma ? `Total contado: <b>${$(suma)}</b>` : '<span class="mute">Aún no hay montos.</span>';
    };
    raiz.oninput = total;
    total();
    const primero = raiz.querySelector('.jg-m');
    if (primero) primero.focus();
  };

  // ---------------------------------------------------------------------------------------------
  // Pantalla
  // ---------------------------------------------------------------------------------------------
  CC.router.register('juegos', 'Juegos', '🎲', el => {
    juegosBase();
    const juegos = db.all('juegos'), todos = registros();
    const deJuego = j => todos.filter(r => r.juegoId === j.id);
    const total = todos.filter(r => r.juegoId).reduce((s, r) => s + r.monto, 0); // solo juegos (sin propinas ni otros)
    const resumen = juegos.map(j => {
      const regs = deJuego(j), bazares = new Set(regs.map(r => r.bazarId)).size, suma = regs.reduce((s, r) => s + r.monto, 0);
      return {j, suma, bazares, promedio: bazares ? suma / bazares : 0};
    });
    const mejor = resumen.slice().sort((a, b) => b.suma - a.suma)[0];
    const kpi = (titulo, valor, detalle = '', clase = '') => `<div class="kpi"><small>${titulo}</small><b class="${clase}">${valor}</b>${detalle ? `<span class="mute">${detalle}</span>` : ''}</div>`;
    const recientes = todos.slice().sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || ''))).slice(0, 12);

    el.innerHTML = `
      <div class="bar">
        <div style="flex:1;min-width:240px"><h3 style="margin:0">Juegos</h3>
          <p class="mute" style="margin:2px 0 0">Tus tipos de juego y cuánto se contó en cada uno. Los montos se registran dentro de cada bazar con «Agregar juegos».</p></div>
        <button class="btn ghost" data-a="registrar">＋ Agregar juegos a un bazar</button>
        <button class="btn" data-a="nuevo">+ Tipo de juego</button>
      </div>

      <div class="kpis">
        ${kpi('🎲 Total contado en juegos', $(total), 'en todos los bazares', 'pos-n')}
        ${kpi('🏆 Mejor juego', mejor && mejor.suma ? E(mejor.j.icono + ' ' + mejor.j.nombre) : '—', mejor && mejor.suma ? $(mejor.suma) + ' contados' : 'aún sin registros')}
        ${kpi('Tipos de juego', juegos.length)}
      </div>

      <div class="cards">${resumen.map(({j, suma, bazares, promedio}) => `
        <div class="pcard"><div class="pb">
          <div style="font-size:1.8rem">${E(j.icono)}</div>
          <b>${E(j.nombre)}</b>${j.nota ? `<div class="mute">${E(j.nota)}</div>` : ''}
          <div style="font:800 1.4rem var(--font-display);margin-top:4px">${$(suma)}</div>
          <div class="mute">${bazares ? `${bazares} bazar(es) · promedio ${$(promedio)} por bazar` : 'aún sin registros'}</div>
          <div class="bar" style="margin:8px 0 0"><button class="btn ghost sm" data-a="editar" data-id="${j.id}">Editar</button><button class="btn ghost sm" data-a="borrar" data-id="${j.id}">Eliminar</button></div>
        </div></div>`).join('') || '<p class="mute">Aún no tienes tipos de juego. Crea el primero con «+ Tipo de juego».</p>'}</div>

      <div class="card">
        <h3>🕒 Registros recientes</h3>
        ${recientes.map(r => `
          <div class="line"><span>${E((db.get('juegos', r.juegoId) || {}).icono || (r.juegoId ? '🎲' : '💵'))} <b>${E(r.concepto)}</b>
            <span class="mute">· 🎪 ${E(r.bazar)}${r.fecha ? ' · ' + E(r.fecha) : ''}</span></span>
            <span><b>${$(r.monto)}</b> <button class="btn ghost sm" data-a="quitar" data-b="${r.bazarId}" data-i="${r.i}">✕</button></span></div>`).join('') || '<p class="mute">Aún no hay registros de juegos.</p>'}
      </div>`;

    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b || !b.dataset.a) return;
      const d = b.dataset;
      if (d.a === 'nuevo') formJuego();
      else if (d.a === 'registrar') CC.agregarJuego();
      else if (d.a === 'editar') formJuego(db.get('juegos', d.id));
      else if (d.a === 'borrar') eliminarJuego(db.get('juegos', d.id));
      else if (d.a === 'quitar') {
        const bazar = db.get('eventos', d.b), copia = JSON.stringify(db.crudo());
        db.update('eventos', bazar.id, {ingresos: (bazar.ingresos || []).filter((_, k) => k !== +d.i)});
        refrescar();
        ui.deshacer('Registro quitado.', copia);
      }
    };
  });
})();
