// Juegos: tus tipos de juego (ruleta, pesca, rifa…), cuánto dinero se contó, cuántas personas jugaron y qué día.
// Los registros viven dentro de cada bazar (sus «ingresos»); aquí se administran los tipos, se eligen los
// juegos que lleva cada bazar y se comparan los resultados.
(() => {
  const {db, ui} = CC;
  const E = ui.esc, $ = ui.money;
  const norm = s => String(s || '').trim().toLowerCase();
  const BASE = [['Ruleta', '🎡'], ['Pesca de patitos', '🦆'], ['Rifa', '🎟️'], ['Lotería', '🎴'], ['Dardos', '🎯'], ['Tiro al blanco', '🏹']];
  const MARCA_BASE = 'clowncloud:juegosBase';
  let filtro = 'all'; // 'all' o id de un bazar

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

  // Juegos que lleva un bazar: los que elegiste para él o, si no elegiste ninguno, todos.
  CC.juegosDeBazar = id => {
    juegosBase();
    const bazar = id ? db.get('eventos', id) : null, ids = (bazar && bazar.juegosIds) || [];
    const todos = db.all('juegos');
    return ids.length ? todos.filter(j => ids.includes(j.id)) : todos;
  };

  // Todos los registros de dinero de juegos de todos los bazares.
  const registros = () => db.all('eventos').flatMap(b => (b.ingresos || []).map((x, i) => ({...x, personas: +x.personas || 0, bazarId: b.id, bazar: b.nombre, i})));
  const personasTexto = n => n ? `${n} persona${n === 1 ? '' : 's'}` : 'sin dato de personas';

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
  // Agregar lo que se contó en cada juego (lo usa también el detalle del bazar)
  // ---------------------------------------------------------------------------------------------
  CC.agregarJuego = (bazarId = '') => {
    juegosBase();
    const bazares = db.all('eventos');
    if (!bazares.length) return ui.toast('Primero crea un bazar en Bazares');
    const inicial = bazarId || (filtro !== 'all' ? filtro : (CC.grupos.bazarActivo() || bazares[bazares.length - 1].id));

    ui.modal('Agregar juegos', `
      ${bazarId ? '' : `<label>Bazar<select class="inp" name="bazar">${bazares.slice().reverse().map(b => `<option value="${b.id}" ${b.id === inicial ? 'selected' : ''}>🎪 ${E(b.nombre)}</option>`).join('')}</select></label>`}
      ${ui.inp('fecha', 'Día en que se jugó', ui.hoy(), 'date')}
      <p class="mute" style="margin:8px 0 4px">Escribe el dinero que se contó y cuántas personas jugaron en cada juego. Deja vacíos los que no usaste.</p>
      <div id="jg-lista"></div>
      <label style="margin-top:10px">Otro ingreso (propinas, comida, otro juego…)</label>
      <div class="grid2"><input class="inp" name="otroN" placeholder="Concepto"><input class="inp" name="otroM" type="number" min="0" step="0.01" placeholder="$ 0.00"></div>
      <div class="card" id="jg-total" style="margin:12px 0 0;font-size:.9rem"></div>`, m => {
      const o = ui.vals(m), destino = bazarId || o.bazar, bazar = db.get('eventos', destino);
      const nuevos = [...m.querySelectorAll('.jg-m')].filter(i => +i.value > 0).map(i => {
        const j = db.get('juegos', i.dataset.j), personas = Math.floor(+m.querySelector(`.jg-p[data-j="${i.dataset.j}"]`).value) || 0;
        return {concepto: j.nombre, monto: +i.value, juegoId: j.id, personas, fecha: o.fecha};
      });
      if (+o.otroM > 0) nuevos.push({concepto: o.otroN.trim() || 'Otro ingreso', monto: +o.otroM, fecha: o.fecha});
      if (!nuevos.length) { ui.toast('Escribe al menos un monto'); return false; }
      db.update('eventos', destino, {ingresos: [...(bazar.ingresos || []), ...nuevos]});
      ui.toast(`Agregado: ${$(nuevos.reduce((s, x) => s + x.monto, 0))} en ${nuevos.length} registro(s)`);
      refrescar();
    });

    const raiz = document.getElementById('modal'), q = s => raiz.querySelector(s);
    // La lista depende del bazar elegido (sus juegos); al cambiarlo se conservan los valores ya escritos.
    const pintarLista = () => {
      const guardados = {};
      raiz.querySelectorAll('.jg-m').forEach(i => { guardados[i.dataset.j] = [i.value, (raiz.querySelector(`.jg-p[data-j="${i.dataset.j}"]`) || {}).value || '']; });
      const destino = bazarId || (q('[name=bazar]') ? q('[name=bazar]').value : inicial);
      q('#jg-lista').innerHTML = CC.juegosDeBazar(destino).map(j => `
        <div class="line" style="gap:8px;flex-wrap:wrap"><span style="flex:1;min-width:150px">${E(j.icono)} ${E(j.nombre)}${j.nota ? `<div class="mute">${E(j.nota)}</div>` : ''}</span>
          <input class="inp jg-m" data-j="${j.id}" type="number" min="0" step="0.01" placeholder="$ contado" value="${E((guardados[j.id] || [''])[0])}" style="width:120px">
          <input class="inp jg-p" data-j="${j.id}" type="number" min="0" step="1" placeholder="Personas" value="${E((guardados[j.id] || ['', ''])[1])}" style="width:100px"></div>`).join('') || '<p class="mute">Aún no tienes tipos de juego: créalos en la pestaña Juegos.</p>';
      total();
    };
    const total = () => {
      const suma = [...raiz.querySelectorAll('.jg-m, [name=otroM]')].reduce((s, i) => s + (+i.value || 0), 0);
      const gente = [...raiz.querySelectorAll('.jg-p')].reduce((s, i) => s + (Math.floor(+i.value) || 0), 0);
      q('#jg-total').innerHTML = suma ? `Total contado: <b>${$(suma)}</b>${gente ? ` · <b>${gente}</b> persona(s) jugaron` : ''}` : '<span class="mute">Aún no hay montos.</span>';
    };
    raiz.oninput = total;
    raiz.onchange = e => { if (e.target.name === 'bazar') pintarLista(); };
    pintarLista();
    const primero = raiz.querySelector('.jg-m');
    if (primero) primero.focus();
  };

  // ---------------------------------------------------------------------------------------------
  // Pantalla
  // ---------------------------------------------------------------------------------------------
  CC.router.register('juegos', 'Juegos', '🎲', el => {
    juegosBase();
    const bazares = db.all('eventos');
    if (filtro !== 'all' && !bazares.some(b => b.id === filtro)) filtro = 'all';
    const juegos = db.all('juegos'), todos = registros().filter(r => filtro === 'all' || r.bazarId === filtro);
    const deJuego = j => todos.filter(r => r.juegoId === j.id);
    const deJuegos = todos.filter(r => r.juegoId); // solo juegos (sin propinas ni otros)
    const total = deJuegos.reduce((s, r) => s + r.monto, 0), gente = deJuegos.reduce((s, r) => s + r.personas, 0);
    const resumen = juegos.map(j => {
      const regs = deJuego(j), bz = new Set(regs.map(r => r.bazarId)).size, suma = regs.reduce((s, r) => s + r.monto, 0), personas = regs.reduce((s, r) => s + r.personas, 0);
      return {j, suma, personas, bz, porPersona: personas ? suma / personas : 0, promedio: bz ? suma / bz : 0};
    });
    const mejor = resumen.slice().sort((a, b) => b.suma - a.suma)[0];
    const kpi = (titulo, valor, detalle = '', clase = '') => `<div class="kpi"><small>${titulo}</small><b class="${clase}">${valor}</b>${detalle ? `<span class="mute">${detalle}</span>` : ''}</div>`;
    const recientes = todos.slice().sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || ''))).slice(0, 12);
    const bazarSel = filtro !== 'all' ? db.get('eventos', filtro) : null, asignados = (bazarSel && bazarSel.juegosIds) || [];

    el.innerHTML = `
      <div class="bar">
        <div style="flex:1;min-width:240px"><h3 style="margin:0">Juegos</h3>
          <p class="mute" style="margin:2px 0 0">Tus tipos de juego: cuánto se contó, cuántas personas jugaron y qué día. Los montos se registran dentro de cada bazar.</p></div>
        <select class="inp" id="f" style="max-width:240px"><option value="all">Todos los bazares</option>${bazares.map(b => `<option value="${b.id}" ${filtro === b.id ? 'selected' : ''}>🎪 ${E(b.nombre)}</option>`).join('')}</select>
        <button class="btn ghost" data-a="registrar">＋ Agregar juegos</button>
        <button class="btn" data-a="nuevo">+ Tipo de juego</button>
      </div>

      <div class="kpis">
        ${kpi('🎲 Total contado en juegos', $(total), filtro === 'all' ? 'en todos los bazares' : 'en este bazar', 'pos-n')}
        ${kpi('👥 Personas que jugaron', gente, gente ? 'según lo que registraste' : 'aún sin dato')}
        ${kpi('Promedio por persona', gente ? $(total / gente) : '—', 'dinero contado ÷ personas')}
        ${kpi('🏆 Mejor juego', mejor && mejor.suma ? E(mejor.j.icono + ' ' + mejor.j.nombre) : '—', mejor && mejor.suma ? $(mejor.suma) + ' contados' : 'aún sin registros')}
      </div>

      ${bazarSel ? `
      <div class="card">
        <h3 style="margin:0 0 2px">🎪 Juegos que lleva «${E(bazarSel.nombre)}»</h3>
        <p class="mute" style="margin:0 0 8px">Toca para elegir cuáles llevas. Solo esos aparecen al registrar y en el Modo bazar. Sin elegir ninguno, salen todos.</p>
        <div class="flt" style="margin:0">${juegos.map(j => `<span class="chip ${asignados.includes(j.id) ? 'on' : ''}" data-a="asignar" data-j="${j.id}" style="--c:var(--amarillo)">${E(j.icono)} ${E(j.nombre)}</span>`).join('')}</div>
      </div>` : ''}

      <div class="cards">${resumen.map(({j, suma, personas, bz, porPersona, promedio}) => `
        <div class="pcard"><div class="pb">
          <div style="font-size:1.8rem">${E(j.icono)}</div>
          <b>${E(j.nombre)}</b>${j.nota ? `<div class="mute">${E(j.nota)}</div>` : ''}
          <div style="font:800 1.4rem var(--font-display);margin-top:4px">${$(suma)}</div>
          <div class="mute">${bz ? `👥 ${personasTexto(personas)}${personas ? ` · ${$(porPersona)} por persona` : ''}` : 'aún sin registros'}</div>
          ${bz && filtro === 'all' ? `<div class="mute">${bz} bazar(es) · promedio ${$(promedio)} por bazar</div>` : ''}
          <div class="bar" style="margin:8px 0 0"><button class="btn ghost sm" data-a="editar" data-id="${j.id}">Editar</button><button class="btn ghost sm" data-a="borrar" data-id="${j.id}">Eliminar</button></div>
        </div></div>`).join('') || '<p class="mute">Aún no tienes tipos de juego. Crea el primero con «+ Tipo de juego».</p>'}</div>

      <div class="card">
        <h3>🕒 Registros recientes</h3>
        ${recientes.map(r => `
          <div class="line" style="gap:8px;flex-wrap:wrap"><span style="flex:1;min-width:200px">${E((db.get('juegos', r.juegoId) || {}).icono || (r.juegoId ? '🎲' : '💵'))} <b>${E(r.concepto)}</b>
            <div class="mute">📅 ${E(r.fecha || 'sin fecha')} · 🎪 ${E(r.bazar)}${r.juegoId ? ` · 👥 ${personasTexto(r.personas)}` : ''}</div></span>
            <span><b>${$(r.monto)}</b> <button class="btn ghost sm" data-a="quitar" data-b="${r.bazarId}" data-i="${r.i}">✕</button></span></div>`).join('') || '<p class="mute">Aún no hay registros de juegos.</p>'}
      </div>`;

    el.querySelector('#f').onchange = e => { filtro = e.target.value; refrescar(); };
    el.onclick = e => {
      const b = e.target.closest('button, [data-a]');
      if (!b || !b.dataset.a) return;
      const d = b.dataset;
      if (d.a === 'nuevo') formJuego();
      else if (d.a === 'registrar') CC.agregarJuego(filtro !== 'all' ? filtro : '');
      else if (d.a === 'editar') formJuego(db.get('juegos', d.id));
      else if (d.a === 'borrar') eliminarJuego(db.get('juegos', d.id));
      else if (d.a === 'asignar') {
        const ids = asignados.includes(d.j) ? asignados.filter(x => x !== d.j) : [...asignados, d.j];
        db.update('eventos', bazarSel.id, {juegosIds: ids});
        refrescar();
      } else if (d.a === 'quitar') {
        const bazar = db.get('eventos', d.b), copia = JSON.stringify(db.crudo());
        db.update('eventos', bazar.id, {ingresos: (bazar.ingresos || []).filter((_, k) => k !== +d.i)});
        refrescar();
        ui.deshacer('Registro quitado.', copia);
      }
    };
  });
})();
