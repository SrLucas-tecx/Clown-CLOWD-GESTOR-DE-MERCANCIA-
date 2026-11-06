// Caja real, por bazar o general:
//   Cambio inicial (apertura) + ventas en efectivo + juegos + entradas − salidas = efectivo que debería haber.
// Ese total se compara contra lo que cuentas al cierre. Billetes y monedas se cuentan en un bloque compacto.
(() => {
  const {db, ui} = CC;
  const E = ui.esc, $ = ui.money;
  const CLAVE_GENERAL = 'clowncloud:cajaGeneral';
  const DENOMINACIONES = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];
  const nombreDenominacion = d => '$' + d.toLocaleString('es-MX', {minimumFractionDigits: d < 1 ? 2 : 0});
  CC.cajaSel = CC.cajaSel || '';
  let iniciada = false;

  const general = () => { try { return JSON.parse(localStorage.getItem(CLAVE_GENERAL)) || {}; } catch (e) { return {}; } };
  const guardar = (sel, cambios) => sel ? db.update('eventos', sel, cambios) : localStorage.setItem(CLAVE_GENERAL, JSON.stringify({...general(), ...cambios}));
  const movimientos = sel => db.all('cajaMovs').filter(m => (m.cajaId || '') === sel)
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.creado).localeCompare(String(a.creado)));

  // Todo lo de una caja: ventas por forma de pago, cambio, movimientos, efectivo esperado, conteo y diferencia.
  function datos(sel) {
    const ventas = CC.ventasOk().filter(v => (v.eventoId || '') === sel);
    const suma = pago => ventas.filter(v => v.pago === pago).reduce((s, v) => s + v.total, 0);
    const caja = sel ? db.get('eventos', sel) : general();
    const efectivo = suma('Efectivo'), tarjeta = suma('Tarjeta'), transf = suma('Transferencia');
    const juegos = sel ? (caja.ingresos || []).reduce((s, x) => s + x.monto, 0) : 0;
    const movs = movimientos(sel);
    const entradas = movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.monto, 0);
    const salidas = movs.filter(m => m.tipo === 'salida').reduce((s, m) => s + m.monto, 0);
    const cambio = +caja.fondoCaja || 0, esperado = cambio + efectivo + juegos + entradas - salidas;
    const contado = caja.efectivoContado === undefined || caja.efectivoContado === null || caja.efectivoContado === '' ? null : +caja.efectivoContado;
    return {
      vs: ventas, caja, movs, efectivo, tarjeta, transf, juegos, entradas, salidas, total: efectivo + tarjeta + transf,
      comision: ventas.reduce((s, v) => s + (v.comision || 0), 0),
      fondo: cambio, cambio, esp: esperado, esperado, cont: contado, contado, dif: contado === null ? null : contado - esperado,
      cerrada: !!caja.cerrada
    };
  }
  CC.datosCaja = datos;
  CC.cajaGuardar = guardar;                                  // lo usa el Modo bazar
  CC.cajaMovimiento = (sel, tipo, despues) => formMovimiento(sel, tipo, despues);

  // Mensaje del cuadre según la diferencia.
  const mensajeDiferencia = dif => dif === null ? ['mute', 'Cuenta tu efectivo al cierre para ver si cuadra la caja.']
    : Math.abs(dif) < 0.01 ? ['pos-n', '✅ La caja cuadra exacto.']
    : dif > 0 ? ['warn', `Sobran ${$(dif)} respecto a lo esperado.`]
    : ['neg', `⚠️ Faltan ${$(-dif)} respecto a lo esperado.`];

  // Bloque de efectivo: un total directo y, si lo prefieres, el conteo por billetes y monedas (compacto).
  const bloqueConteo = (clave, icono, titulo, ayuda, desglose, total, bloqueada) => {
    const hayDesglose = DENOMINACIONES.some(d => (+desglose[d] || 0) > 0), off = bloqueada ? 'disabled' : '';
    return `
      <div class="card">
        <h3 style="margin:0 0 2px">${icono} ${titulo}</h3>
        <p class="mute" style="margin:0 0 8px">${ayuda}</p>
        <label>Total en efectivo
          <input class="inp dir" data-b="${clave}" type="number" min="0" step="0.01" placeholder="0.00" value="${!hayDesglose && total ? total : ''}" ${off}></label>
        <details class="conteo" ${hayDesglose ? 'open' : ''}>
          <summary>🧮 Contar por billetes y monedas (si lo llenas, se usa esa suma)</summary>
          <div class="den-grid">${DENOMINACIONES.map(d => `
            <div class="den-celda"><span>${nombreDenominacion(d)}</span>
              <input class="inp den" data-b="${clave}" data-d="${d}" type="number" min="0" step="1" placeholder="0" value="${desglose[d] ?? ''}" ${off}>
              <small data-sub="${clave}-${d}">${(+desglose[d] || 0) ? $(d * Math.floor(+desglose[d])) : ''}</small></div>`).join('')}
          </div>
        </details>
        <div class="line"><b>Total</b><b data-tot="${clave}">${$(total)}</b></div>
      </div>`;
  };

  // Entrada o salida de efectivo (compré cambio, pagué la mesa, retiré dinero…).
  function formMovimiento(sel, tipo, despues) {
    ui.modal(tipo === 'salida' ? 'Salida de efectivo' : 'Entrada de efectivo', `
      <label>Tipo<select class="inp" name="tipo"><option value="entrada" ${tipo === 'entrada' ? 'selected' : ''}>⬆️ Entra efectivo a la caja</option><option value="salida" ${tipo === 'salida' ? 'selected' : ''}>⬇️ Sale efectivo de la caja</option></select></label>
      ${ui.inp('concepto', 'Concepto', '', 'text', 'placeholder="Ej. compré cambio, pagué la mesa, retiré ganancia"')}
      <div class="grid2">${ui.inp('monto', 'Monto', '', 'number', 'step="0.01" min="0"')}${ui.inp('fecha', 'Fecha', ui.hoy(), 'date')}</div>`, m => {
      const o = ui.vals(m), monto = +o.monto;
      if (!(monto > 0)) { ui.toast('Pon el monto del movimiento'); return false; }
      db.add('cajaMovs', {cajaId: sel, tipo: o.tipo, concepto: o.concepto.trim() || (o.tipo === 'entrada' ? 'Entrada de efectivo' : 'Salida de efectivo'), monto, fecha: o.fecha || ui.hoy()});
      (despues || (() => CC.router.show()))();
    });
  }

  CC.router.register('caja', 'Caja', '💰', el => {
    if (!iniciada) {
      iniciada = true;
      if (!CC.cajaSel) CC.cajaSel = CC.grupos.bazarActivo();
    }
    if (CC.cajaSel && !db.get('eventos', CC.cajaSel)) CC.cajaSel = '';
    const sel = CC.cajaSel, d = datos(sel), [claseMsg, textoMsg] = mensajeDiferencia(d.dif);
    const bazares = db.all('eventos'), bloqueada = d.cerrada;
    const desgloseCambio = d.caja.cambioDesglose || {}, desgloseConteo = d.caja.conteoDesglose || {};
    const kpi = (titulo, valor, detalle = '') => `<div class="kpi"><small>${titulo}</small><b>${valor}</b>${detalle ? `<span class="mute">${detalle}</span>` : ''}</div>`;

    el.innerHTML = `
      <div class="bar">
        <select class="inp" id="s" style="max-width:300px"><option value="">💰 Caja general (sin bazar)</option>${bazares.map(b => `<option value="${b.id}" ${b.id === sel ? 'selected' : ''}>🎪 ${E(b.nombre)}</option>`).join('')}</select>
        ${bloqueada ? '<span class="chip estado-caja">🔒 Caja cerrada</span>' : ''}
        <div style="flex:1"></div><button class="btn ghost" id="csv">⬇️ Descargar caja (Excel)</button>
      </div>

      <div class="kpis">
        ${kpi('Total vendido', $(d.total))}
        ${kpi('💵 Efectivo', $(d.efectivo))}
        ${kpi('💳 Tarjeta', $(d.tarjeta), 'comisión: ' + $(d.comision) + ' (el % se cambia en Ajustes → General)')}
        ${kpi('🏦 Transferencia', $(d.transf))}
        ${sel ? kpi('🎲 Juegos e ingresos extra', $(d.juegos), 'se cuentan como efectivo') : ''}
      </div>

      <div class="grid2" style="align-items:start">
        <div>
          <div class="card" id="cuadre">
            <h3 style="margin:0 0 6px">Cuadre de caja</h3>
            <div class="line"><span>Cambio inicial</span><b id="cq-cambio">${$(d.cambio)}</b></div>
            <div class="line"><span>+ Ventas en efectivo</span><b>${$(d.efectivo)}</b></div>
            ${sel ? `<div class="line"><span>+ Juegos e ingresos extra</span><b>${$(d.juegos)}</b></div>` : ''}
            <div class="line"><span>+ Entradas de efectivo</span><b>${$(d.entradas)}</b></div>
            <div class="line"><span>− Salidas de efectivo</span><b>${$(d.salidas)}</b></div>
            <div class="line"><span><b>Debería haber en caja</b></span><b id="cq-esp" style="font-size:1.15rem">${$(d.esperado)}</b></div>
            <div class="line"><span>Efectivo contado</span><b id="cq-cont">${d.contado === null ? '—' : $(d.contado)}</b></div>
            <div class="line"><span>Diferencia</span><b id="cq-dif" class="${claseMsg}">${d.dif === null ? '—' : $(d.dif)}</b></div>
            <p id="cq-msg" class="${claseMsg}" style="margin:8px 0 0">${textoMsg}</p>
            <div class="bar" style="margin:10px 0 0">
              ${bloqueada ? '<button class="btn ghost" id="reabrir">🔓 Reabrir caja</button>' : '<button class="btn" id="cerrar">🔒 Cerrar caja</button>'}
              ${d.caja.cierre ? `<span class="mute">Último cierre: ${E(new Date(d.caja.cierre.en).toLocaleString('es-MX', {dateStyle: 'medium', timeStyle: 'short'}))}</span>` : ''}
            </div>
          </div>

          <div class="card">
            <div class="bar" style="margin:0 0 6px"><div style="flex:1"><h3 style="margin:0">Entradas y salidas de efectivo</h3>
              <span class="mute">Todo lo que entra o sale de la caja sin ser una venta.</span></div>
              ${bloqueada ? '' : '<button class="btn sm" data-a="entrada">⬆️ Entrada</button><button class="btn ghost sm" data-a="salida">⬇️ Salida</button>'}</div>
            ${d.movs.map(m => `
              <div class="line"><span>${m.tipo === 'entrada' ? '⬆️' : '⬇️'} ${E(m.concepto)} <span class="mute">· ${E(m.fecha || '')}</span></span>
                <span><b class="${m.tipo === 'entrada' ? 'pos-n' : 'neg'}">${m.tipo === 'entrada' ? '+' : '−'}${$(m.monto)}</b>
                ${bloqueada ? '' : `<button class="btn ghost sm" data-a="quitar" data-id="${m.id}" title="Quitar">✕</button>`}</span></div>`).join('') || '<p class="mute">Aún no hay movimientos.</p>'}
          </div>
        </div>

        <div>
          ${bloqueConteo('c', '💵', 'Cambio inicial', 'El efectivo con el que empiezas (monedas y billetes para dar cambio).', desgloseCambio, d.cambio, bloqueada)}
          ${bloqueConteo('r', '🧮', 'Conteo real al cierre', 'Cuenta todo el efectivo que hay en la caja al terminar.', desgloseConteo, d.contado || 0, bloqueada)}
        </div>
      </div>`;

    // ------- Cálculo en vivo y guardado --------
    const q = s => el.querySelector(s);
    const leerBloque = clave => {
      const desglose = {};
      let suma = 0, hayAlgo = false;
      el.querySelectorAll(`.den[data-b="${clave}"]`).forEach(i => {
        const n = Math.floor(+i.value) || 0;
        if (i.value !== '') hayAlgo = true;
        if (n > 0) { desglose[i.dataset.d] = n; suma += n * (+i.dataset.d); }
      });
      const directo = q(`.dir[data-b="${clave}"]`);
      if (directo.value !== '') hayAlgo = true;
      return {desglose, total: suma > 0 ? suma : (+directo.value || 0), hayAlgo};
    };

    const actualizar = () => {
      const cambio = leerBloque('c'), conteo = leerBloque('r');
      ['c', 'r'].forEach(clave => el.querySelectorAll(`.den[data-b="${clave}"]`).forEach(i => {
        const n = Math.floor(+i.value) || 0;
        q(`[data-sub="${clave}-${i.dataset.d}"]`).textContent = n ? $(n * (+i.dataset.d)) : '';
      }));
      q('[data-tot="c"]').textContent = $(cambio.total);
      q('[data-tot="r"]').textContent = $(conteo.total);
      const esperado = cambio.total + d.efectivo + d.juegos + d.entradas - d.salidas, dif = conteo.hayAlgo ? conteo.total - esperado : null;
      const [clase, texto] = mensajeDiferencia(dif);
      q('#cq-cambio').textContent = $(cambio.total);
      q('#cq-esp').textContent = $(esperado);
      q('#cq-cont').textContent = conteo.hayAlgo ? $(conteo.total) : '—';
      q('#cq-dif').textContent = dif === null ? '—' : $(dif);
      q('#cq-dif').className = clase;
      q('#cq-msg').className = clase;
      q('#cq-msg').textContent = texto;
      return {cambio, conteo, esperado, dif};
    };

    el.oninput = e => { if (e.target.classList.contains('den') || e.target.classList.contains('dir')) actualizar(); };
    el.onchange = e => {
      if (e.target.id === 's') { CC.cajaSel = e.target.value; return CC.router.show(); }
      if (!e.target.classList.contains('den') && !e.target.classList.contains('dir')) return;
      const {cambio, conteo} = actualizar();
      guardar(sel, {fondoCaja: cambio.total, cambioDesglose: cambio.desglose, efectivoContado: conteo.hayAlgo ? conteo.total : null, conteoDesglose: conteo.desglose});
    };

    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.a === 'entrada' || b.dataset.a === 'salida') return formMovimiento(sel, b.dataset.a);
      if (b.dataset.a === 'quitar') {
        const copia = JSON.stringify(db.crudo());
        db.remove('cajaMovs', b.dataset.id);
        CC.router.show();
        return ui.deshacer('Movimiento quitado.', copia);
      }
      if (b.id === 'cerrar') {
        const {conteo, esperado, dif} = actualizar();
        if (!conteo.hayAlgo) return ui.toast('Primero cuenta el efectivo para poder cerrar la caja');
        const [, texto] = mensajeDiferencia(dif);
        return ui.confirm(`${texto} Ya no podrás cambiar montos hasta reabrirla.`, 'Cerrar caja').then(ok => {
          if (!ok) return;
          guardar(sel, {cerrada: true, cierre: {en: new Date().toISOString(), esperado, contado: conteo.total, dif}});
          CC.router.show();
          ui.toast('Caja cerrada');
        });
      }
      if (b.id === 'reabrir') { guardar(sel, {cerrada: false}); CC.router.show(); }
    };

    q('#csv').onclick = () => CC.excel.descargar('caja-' + ui.hoy(), {
      Resumen: [{
        'Total vendido': d.total, Efectivo: d.efectivo, Tarjeta: d.tarjeta, Transferencia: d.transf, 'Comisión de terminal': d.comision,
        'Cambio inicial': d.cambio, 'Juegos e ingresos extra': d.juegos, 'Entradas de efectivo': d.entradas, 'Salidas de efectivo': d.salidas,
        'Efectivo esperado': d.esperado, 'Efectivo contado': d.contado ?? '', Diferencia: d.dif ?? ''
      }],
      'Billetes y monedas': DENOMINACIONES.map(x => ({
        'Denominación': x, 'Piezas de cambio inicial': +desgloseCambio[x] || 0, 'Piezas contadas al cierre': +desgloseConteo[x] || 0,
        'Subtotal cambio': x * (+desgloseCambio[x] || 0), 'Subtotal conteo': x * (+desgloseConteo[x] || 0)
      })),
      Movimientos: d.movs.map(m => ({Fecha: m.fecha, Tipo: m.tipo === 'entrada' ? 'Entrada' : 'Salida', Concepto: m.concepto, Monto: m.monto})),
      Ventas: d.vs.map(v => ({
        Fecha: v.fecha, Detalle: v.items.map(i => i.cant + 'x ' + i.nombre).join(' / '), Piezas: v.items.reduce((a, i) => a + i.cant, 0),
        Total: v.total, Pago: v.pago, 'Comisión': v.comision || 0
      }))
    });
  });
})();
