// Interés: qué preguntan los clientes (tema + tipo), en qué bazar lo preguntaron y cuánto de eso se vende.
// Cada consulta guarda: tema, tipo (Pin · Sticker · Otro + especificación), diseño opcional, veces, bazar,
// fecha, etiquetas y notas. Las consultas de versiones anteriores (por producto) se siguen leyendo.
(() => {
  const {db, ui} = CC;
  const E = ui.esc;
  const norm = s => String(s || '').trim().toLowerCase();
  const OTRO_TEMA = '__otro__';
  let filtro = 'all'; // 'all' = todas · 'none' = sin bazar · id de un bazar

  // ---------------------------------------------------------------------------------------------
  // Tipos y datos derivados
  // ---------------------------------------------------------------------------------------------
  const esPin = categoria => /^pines?$/i.test(String(categoria || '').trim());
  const esSticker = categoria => /stic?ker|stiker/i.test(categoria || '');
  const tipoDeCategoria = categoria => esPin(categoria) ? 'Pin' : esSticker(categoria) ? 'Sticker' : (String(categoria || '').trim() || 'Otro');
  const icono = tipo => tipo === 'Pin' ? '📍' : tipo === 'Sticker' ? '🖼️' : '✍️';

  // Normaliza una consulta (nueva o anterior) a {tema, tipo, diseno, conocido}.
  const info = c => {
    if (c.tipo) {
      const tema = c.temaId ? db.get('temas', c.temaId) : null;
      const vigente = tema && !tema.eliminado;
      return {
        tema: vigente ? tema.nombre : (c.tema || 'Sin tema'),
        tipo: c.tipo === 'Otro' ? (c.otro || 'Otro') : c.tipo,
        diseno: c.nombre || '',
        conocido: !!vigente
      };
    }
    const variante = c.varianteId ? db.get('variantes', c.varianteId) : null;
    const producto = variante ? db.get('productos', variante.productoId) : null;
    return producto
      ? {tema: producto.coleccion || 'Sin tema', tipo: tipoDeCategoria(producto.categoria), diseno: producto.producto, conocido: true}
      : {tema: 'Sin tema', tipo: 'Otro', diseno: c.nombre || 'Sin nombre', conocido: false};
  };

  const claveDe = i => norm(i.tema) + '|' + norm(i.tipo);

  // Piezas vendidas de un tema y tipo (para comparar con lo que preguntan).
  const vendidas = (tema, tipo) => db.all('productos')
    .filter(p => norm(p.coleccion) === norm(tema) && norm(tipoDeCategoria(p.categoria)) === norm(tipo))
    .reduce((suma, p) => suma + db.all('variantes').filter(v => v.productoId === p.id).reduce((a, v) => a + CC.vendidos(v.id), 0), 0);

  const enFiltro = c => filtro === 'all' || (filtro === 'none' ? !c.eventoId : c.eventoId === filtro);
  const nombreBazar = id => (db.get('eventos', id) || {}).nombre || 'Bazar eliminado';

  const etiquetasBase = () => {
    if (CC.tags.lista('consulta').length) return;
    [['Preguntó precio', '#ffc933'], ['Pidió otro diseño', '#6f86bd'], ['No lo teníamos', '#e3363d'], ['Muy interesado', '#3fd08f']]
      .forEach(([nombre, color]) => db.add('etiquetas', {nombre, color, ambito: 'consulta'}));
  };

  // ---------------------------------------------------------------------------------------------
  // Formulario: Registrar consulta
  // ---------------------------------------------------------------------------------------------
  function registrar() {
    etiquetasBase();
    const temas = db.all('temas').slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const bazares = db.all('eventos');
    let tipo = 'Pin';

    ui.modal('Registrar consulta', `
      <label>Tema
        <select class="inp" name="tema">
          ${temas.map(t => `<option value="${t.id}">${E(t.nombre)}</option>`).join('')}
          <option value="${OTRO_TEMA}">✍️ Otro tema (escribir)</option>
        </select>
      </label>
      <div id="ic-tema-otro">${ui.inp('temaOtro', 'Nombre del tema', '', 'text', 'placeholder="Ej. Pokémon (aún no lo tengo)"')}</div>

      <label>Tipo</label>
      <div class="seg" id="ic-tipo" style="margin-bottom:8px">
        <button type="button" data-t="Pin" class="on">📍 Pin</button>
        <button type="button" data-t="Sticker">🖼️ Sticker</button>
        <button type="button" data-t="Otro">✍️ Otro</button>
      </div>
      <div id="ic-otro">${ui.inp('otro', 'Especifica qué fue', '', 'text', 'placeholder="Ej. llavero, pinza, playera"')}</div>

      ${ui.inp('diseno', 'Diseño específico (opcional)', '', 'text', 'placeholder="Ej. Gato astronauta"')}
      <div class="grid2">
        ${ui.inp('cant', '¿Cuántas veces preguntaron?', 1, 'number', 'min="1" step="1"')}
        ${ui.inp('fecha', 'Fecha', ui.hoy(), 'date')}
      </div>
      <label>Bazar donde fue
        <select class="inp" name="ev">
          <option value="">Sin bazar</option>
          ${bazares.map(b => `<option value="${b.id}" ${b.id === filtro ? 'selected' : ''}>🎪 ${E(b.nombre)}</option>`).join('')}
        </select>
      </label>
      <label>Etiquetas</label>${CC.tags.picker('consulta')}
      ${ui.inp('notas', 'Notas', '', 'text', 'placeholder="Opcional"')}`, m => {
      const o = ui.vals(m);
      const esTemaNuevo = o.tema === OTRO_TEMA;
      const tema = esTemaNuevo ? o.temaOtro.trim() : (db.get('temas', o.tema) || {}).nombre;
      const cant = Math.floor(+o.cant);
      if (!tema) { ui.toast('Elige un tema o escribe cuál fue'); return false; }
      if (tipo === 'Otro' && !o.otro.trim()) { ui.toast('Especifica qué fue en «Otro»'); return false; }
      if (!(cant >= 1)) { ui.toast('La cantidad debe ser al menos 1'); return false; }
      db.add('consultas', {
        varianteId: '', tema, temaId: esTemaNuevo ? '' : o.tema,
        tipo, otro: tipo === 'Otro' ? o.otro.trim() : '', nombre: o.diseno.trim(),
        cant, eventoId: o.ev, fecha: o.fecha, etiquetas: CC.tags.leer(m), notas: o.notas.trim()
      });
      ui.toast('Consulta registrada');
      CC.router.show();
    });

    const modal = document.getElementById('modal');
    CC.tags.bind(modal);
    const baseClick = modal.onclick;
    const actualizar = () => {
      modal.querySelector('#ic-tema-otro').style.display = modal.querySelector('[name=tema]').value === OTRO_TEMA ? '' : 'none';
      modal.querySelector('#ic-otro').style.display = tipo === 'Otro' ? '' : 'none';
    };
    modal.onchange = actualizar;
    modal.onclick = e => {
      const boton = e.target.closest('#ic-tipo [data-t]');
      if (!boton) return baseClick(e);
      tipo = boton.dataset.t;
      modal.querySelectorAll('#ic-tipo button').forEach(b => b.classList.toggle('on', b === boton));
      actualizar();
    };
    if (!temas.length) modal.querySelector('[name=tema]').value = OTRO_TEMA;
    actualizar();
  }

  // ---------------------------------------------------------------------------------------------
  // Etiquetas de consulta (crear, editar, quitar)
  // ---------------------------------------------------------------------------------------------
  function formEtiqueta(etiqueta) {
    ui.modal(etiqueta ? 'Editar etiqueta' : 'Nueva etiqueta',
      ui.inp('nombre', 'Nombre', etiqueta ? etiqueta.nombre : '') +
      `<label>Color<input type="color" name="color" value="${etiqueta ? etiqueta.color : '#ffc933'}"
        style="width:100%;height:46px;margin-top:6px;border:1px solid var(--line);border-radius:10px;background:var(--bg);padding:3px"></label>`, m => {
        const o = ui.vals(m), nombre = o.nombre.trim();
        if (!nombre) { ui.toast('Falta el nombre'); return false; }
        const repetida = db.all('etiquetas').some(x => x.ambito === 'consulta' && norm(x.nombre) === norm(nombre) && (!etiqueta || x.id !== etiqueta.id));
        if (repetida) { ui.toast('Ya existe una etiqueta con ese nombre'); return false; }
        if (etiqueta) db.update('etiquetas', etiqueta.id, {nombre, color: o.color});
        else db.add('etiquetas', {nombre, color: o.color, ambito: 'consulta'});
        CC.router.show();
      });
  }

  function quitarEtiqueta(etiqueta) {
    const usos = db.all('consultas').filter(c => (c.etiquetas || []).includes(etiqueta.id));
    const mensaje = usos.length ? `Esta etiqueta está en ${usos.length} consulta(s); se quitará de todas.` : '¿Eliminar esta etiqueta?';
    ui.confirm(mensaje).then(ok => {
      if (!ok) return;
      const copia = JSON.stringify(db.crudo());
      usos.forEach(c => db.update('consultas', c.id, {etiquetas: c.etiquetas.filter(x => x !== etiqueta.id)}));
      db.remove('etiquetas', etiqueta.id);
      CC.router.show();
      ui.deshacer('Etiqueta eliminada.', copia);
    });
  }

  CC.interes = {registrar};

  // ---------------------------------------------------------------------------------------------
  // Pantalla
  // ---------------------------------------------------------------------------------------------
  CC.router.register('interes', 'Interés', '❓', el => {
    etiquetasBase();
    const bazares = db.all('eventos');
    if (filtro !== 'all' && filtro !== 'none' && !bazares.some(b => b.id === filtro)) filtro = 'all';

    const consultas = db.all('consultas').filter(enFiltro);
    const total = consultas.reduce((s, c) => s + c.cant, 0);
    const sinTema = consultas.filter(c => !info(c).conocido).reduce((s, c) => s + c.cant, 0);

    // Ranking por tema + tipo
    const grupos = {};
    consultas.forEach(c => {
      const i = info(c), clave = claveDe(i);
      grupos[clave] = grupos[clave] || {clave, tema: i.tema, tipo: i.tipo, conocido: i.conocido, total: 0};
      grupos[clave].total += c.cant;
    });
    const ranking = Object.values(grupos).sort((a, b) => b.total - a.total);
    const maximo = ranking.length ? ranking[0].total : 1;

    // Consultas por etiqueta
    const etiquetas = CC.tags.lista('consulta');
    const porEtiqueta = etiquetas
      .map(t => ({t, total: consultas.filter(c => (c.etiquetas || []).includes(t.id)).reduce((s, c) => s + c.cant, 0)}))
      .sort((a, b) => b.total - a.total);
    const maxEtiqueta = Math.max(1, ...porEtiqueta.map(x => x.total));

    const kpi = (titulo, valor, detalle = '') => `<div class="kpi"><small>${titulo}</small><b>${valor}</b><span class="mute">${detalle}</span></div>`;

    const filaRanking = g => {
      const vend = g.conocido ? vendidas(g.tema, g.tipo) : null;
      const alerta = g.conocido && g.total >= 3 && vend < g.total / 2 ? '<span class="chip" style="--c:var(--amarillo-300)">Preguntan más de lo que compran</span>' : '';
      const nuevo = g.conocido ? '' : '<span class="chip" style="--c:var(--rojo-300)">No lo teníamos</span>';
      return `
        <div class="line" style="align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <b>${icono(g.tipo)} ${E(g.tema)} · ${E(g.tipo)}</b> ${nuevo}${alerta}
            <div class="meter" style="margin:4px 0"><i style="width:${Math.round(g.total / maximo * 100)}%"></i></div>
            <span class="mute">${g.total} consulta(s)${vend === null ? ' · candidato a producir' : ` · ${vend} pieza(s) vendida(s)`}</span>
          </div>
          <button class="btn ghost sm" data-m="${E(g.clave)}">−1</button>
          <button class="btn sm" data-p="${E(g.clave)}">+1</button>
        </div>`;
    };

    const ultimas = consultas.slice().reverse().slice(0, 10);
    const filaUltima = c => {
      const i = info(c);
      const detalle = [i.diseno, c.fecha, c.eventoId ? '🎪 ' + nombreBazar(c.eventoId) : 'Sin bazar'].filter(Boolean).map(E).join(' · ');
      return `
        <div class="line" style="align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <b>${icono(i.tipo)} ${E(i.tema)} · ${E(i.tipo)}</b> ×${c.cant}
            <div class="mute">${detalle}</div>
            <div>${CC.tags.chips(c.etiquetas)}</div>
            ${c.notas ? `<div class="mute" style="font-style:italic">${E(c.notas)}</div>` : ''}
          </div>
          <button class="btn ghost sm" data-d="${c.id}">Eliminar</button>
        </div>`;
    };

    el.innerHTML = `
      <div class="bar">
        <div style="flex:1;min-width:240px">
          <h3 style="margin:0">Interés por producto</h3>
          <p class="mute" style="margin:2px 0 0">Qué diseños preguntan más tus clientes, aunque no los compren. Úsalo en un bazar o fuera de él.</p>
        </div>
        <select class="inp" id="f" style="max-width:260px">
          <option value="all">Todas las consultas</option>
          <option value="none" ${filtro === 'none' ? 'selected' : ''}>Solo sin bazar</option>
          ${bazares.map(b => `<option value="${b.id}" ${filtro === b.id ? 'selected' : ''}>🎪 ${E(b.nombre)}</option>`).join('')}
        </select>
        <button class="btn" id="n">+ Registrar consulta</button>
      </div>

      <div class="kpis">
        ${kpi('❓ Consultas totales', total, 'según el filtro elegido')}
        ${kpi('🔥 Más preguntado', ranking.length ? E(ranking[0].tema + ' · ' + ranking[0].tipo) : '—', ranking.length ? ranking[0].total + ' consulta(s)' : 'aún sin consultas')}
        ${kpi('🆕 Temas que no teníamos', sinTema, 'consultas por temas fuera de tu catálogo')}
      </div>

      <div class="bar" style="margin-top:6px">
        <b style="flex:1;text-transform:uppercase;letter-spacing:.04em;font-size:.78rem" class="mute">Etiquetas de consulta</b>
        <button class="btn ghost sm" id="ne">🏷️ + Etiqueta</button>
      </div>
      <div class="flt">
        ${etiquetas.map(t => `
          <span class="chip" style="--c:${t.color}">
            ${E(t.nombre)}
            <button class="btn ghost sm" style="padding:0 6px;min-height:0;border:0" data-et="${t.id}" title="Editar">✏️</button>
            <button class="btn ghost sm" style="padding:0 6px;min-height:0;border:0" data-eq="${t.id}" title="Eliminar">✕</button>
          </span>`).join('') || '<span class="mute">Sin etiquetas todavía.</span>'}
      </div>

      <div class="grid2" style="align-items:start">
        <div class="card">
          <h3>🏆 Ranking de temas</h3>
          <p class="mute" style="margin-top:-6px">Suma o resta con un toque.</p>
          ${ranking.map(filaRanking).join('') || `
            <div style="text-align:center;padding:24px 8px">
              <div style="font-size:2.4rem">❓</div>
              <b>Aún no hay consultas</b>
              <p class="mute">Registra lo que preguntan los clientes para ver qué diseños tienen más interés.</p>
              <button class="btn" data-nuevo>+ Registrar consulta</button>
            </div>`}
        </div>
        <div class="card">
          <h3>🏷️ Consultas por etiqueta</h3>
          ${porEtiqueta.filter(x => x.total).map(x => `
            <div class="line" style="display:block">
              <div style="display:flex;justify-content:space-between"><span>${E(x.t.nombre)}</span><b>${x.total}</b></div>
              <div class="meter" style="margin:4px 0;--c:${x.t.color}"><i style="width:${Math.round(x.total / maxEtiqueta * 100)}%"></i></div>
            </div>`).join('') || '<p class="mute">Aún no hay consultas con etiquetas.</p>'}
        </div>
      </div>

      <div class="card">
        <h3>🕒 Últimas consultas</h3>
        ${ultimas.map(filaUltima).join('') || '<p class="mute">Sin consultas.</p>'}
      </div>`;

    el.querySelector('#n').onclick = registrar;
    el.querySelector('#ne').onclick = () => formEtiqueta();
    el.querySelector('#f').onchange = e => { filtro = e.target.value; CC.router.show(); };

    el.onclick = e => {
      const boton = e.target.closest('button');
      if (!boton) return;
      const d = boton.dataset;
      const delGrupo = clave => consultas.filter(c => claveDe(info(c)) === clave);

      if (d.nuevo !== undefined) registrar();
      else if (d.et) formEtiqueta(db.get('etiquetas', d.et));
      else if (d.eq) quitarEtiqueta(db.get('etiquetas', d.eq));
      else if (d.p) {
        // +1: repite la última consulta de ese tema y tipo (en el bazar del filtro, si hay uno).
        const base = delGrupo(d.p).pop();
        const {id, creado, editado, eliminado, ...datos} = base;
        db.add('consultas', {...datos, cant: 1, eventoId: filtro !== 'all' && filtro !== 'none' ? filtro : '', fecha: ui.hoy(), etiquetas: [], notas: ''});
        CC.router.show();
      } else if (d.m) {
        // −1: resta a la última consulta de ese tema y tipo (si llega a 0, se elimina).
        const ultima = delGrupo(d.m).pop();
        if (!ultima) return;
        if (ultima.cant > 1) db.update('consultas', ultima.id, {cant: ultima.cant - 1});
        else db.remove('consultas', ultima.id);
        CC.router.show();
      } else if (d.d) {
        const copia = JSON.stringify(db.crudo());
        db.remove('consultas', d.d);
        CC.router.show();
        ui.deshacer('Consulta eliminada.', copia);
      }
    };
  });
})();
