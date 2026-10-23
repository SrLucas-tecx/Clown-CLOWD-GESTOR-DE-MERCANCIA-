// Caja: por bazar o general. El CAMBIO INICIAL y el CONTEO REAL se cuentan por billetes y monedas;
// el efectivo que debería haber (cambio + ventas en efectivo + juegos) se compara contra lo que cuentas.
(() => {
  const {db, ui} = CC;
  const E = ui.esc, $ = ui.money;
  const CLAVE_GENERAL = 'clowncloud:cajaGeneral';
  const DENOMINACIONES = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];
  const nombreDenominacion = d => '$' + d.toLocaleString('es-MX', {minimumFractionDigits: d < 1 ? 2 : 0});
  CC.cajaSel = '';

  const general = () => { try { return JSON.parse(localStorage.getItem(CLAVE_GENERAL)) || {}; } catch (e) { return {}; } };
  const guardar = (sel, cambios) => sel ? db.update('eventos', sel, cambios) : localStorage.setItem(CLAVE_GENERAL, JSON.stringify({...general(), ...cambios}));
  const sumaDesglose = desglose => DENOMINACIONES.reduce((s, d) => s + d * (Math.floor(+(desglose || {})[d]) || 0), 0);

  // Todo lo de una caja: ventas por forma de pago, cambio, efectivo esperado, conteo y diferencia.
  function datos(sel) {
    const ventas = CC.ventasOk().filter(v => (v.eventoId || '') === sel);
    const suma = pago => ventas.filter(v => v.pago === pago).reduce((s, v) => s + v.total, 0);
    const caja = sel ? db.get('eventos', sel) : general();
    const efectivo = suma('Efectivo'), tarjeta = suma('Tarjeta'), transf = suma('Transferencia');
    const juegos = sel ? (caja.ingresos || []).reduce((s, x) => s + x.monto, 0) : 0;
    const cambio = +caja.fondoCaja || 0, esperado = cambio + efectivo + juegos;
    const contado = caja.efectivoContado === undefined || caja.efectivoContado === null || caja.efectivoContado === '' ? null : +caja.efectivoContado;
    return {
      vs: ventas, caja, efectivo, tarjeta, transf, juegos, total: efectivo + tarjeta + transf,
      comision: ventas.reduce((s, v) => s + (v.comision || 0), 0),
      fondo: cambio, cambio, esp: esperado, esperado, cont: contado, contado, dif: contado === null ? null : contado - esperado
    };
  }
  CC.datosCaja = datos;

  // Mensaje del cuadre según la diferencia.
  const mensajeDiferencia = dif => dif === null ? ['mute', 'Cuenta tu efectivo al cierre para ver si cuadra la caja.']
    : Math.abs(dif) < 0.01 ? ['pos-n', '✅ La caja cuadra exacto.']
    : dif > 0 ? ['warn', `Sobran ${$(dif)} respecto a lo esperado.`]
    : ['neg', `⚠️ Faltan ${$(-dif)} respecto a lo esperado.`];

  // Bloque de conteo por billetes y monedas (cambio inicial o conteo real).
  const bloqueConteo = (clave, icono, titulo, ayuda, desglose, total) => {
    const hayDesglose = DENOMINACIONES.some(d => (+desglose[d] || 0) > 0);
    return `
      <div class="card">
        <h3 style="margin:0 0 2px">${icono} ${titulo}</h3>
        <p class="mute" style="margin:0 0 6px">${ayuda}</p>
        ${DENOMINACIONES.map(d => `
          <div class="line" style="gap:8px;padding:4px 0">
            <b style="width:64px">${nombreDenominacion(d)}</b><span class="mute">×</span>
            <input class="inp den" data-b="${clave}" data-d="${d}" type="number" min="0" step="1" placeholder="0" value="${desglose[d] ?? ''}" style="width:84px">
            <span style="margin-left:auto" data-sub="${clave}-${d}" class="mute">${(+desglose[d] || 0) ? $(d * Math.floor(+desglose[d])) : ''}</span>
          </div>`).join('')}
        <div class="line"><span class="mute">Total directo (si no cuentas por billetes)</span>
          <input class="inp dir" data-b="${clave}" type="number" min="0" step="0.01" placeholder="0.00" value="${!hayDesglose && total ? total : ''}" style="width:120px"></div>
        <div class="line"><b>Total</b><b data-tot="${clave}">${$(total)}</b></div>
      </div>`;
  };

  CC.router.register('caja', 'Caja', '💰', el => {
    const sel = CC.cajaSel, d = datos(sel), [claseMsg, textoMsg] = mensajeDiferencia(d.dif);
    const bazares = db.all('eventos');
    const desgloseCambio = d.caja.cambioDesglose || {}, desgloseConteo = d.caja.conteoDesglose || {};
    const kpi = (titulo, valor, detalle = '') => `<div class="kpi"><small>${titulo}</small><b>${valor}</b>${detalle ? `<span class="mute">${detalle}</span>` : ''}</div>`;

    el.innerHTML = `
      <div class="bar">
        <select class="inp" id="s" style="max-width:300px"><option value="">💰 Caja general (sin bazar)</option>${bazares.map(b => `<option value="${b.id}" ${b.id === sel ? 'selected' : ''}>🎪 ${E(b.nombre)}</option>`).join('')}</select>
        <div style="flex:1"></div><button class="btn ghost" id="csv">⬇️ Descargar caja (Excel)</button>
      </div>

      <div class="kpis">
        ${kpi('Total vendido', $(d.total))}
        ${kpi('💵 Efectivo', $(d.efectivo))}
        ${kpi('💳 Tarjeta', $(d.tarjeta), 'comisión: ' + $(d.comision))}
        ${kpi('🏦 Transferencia', $(d.transf))}
        ${sel ? kpi('🎲 Juegos e ingresos extra', $(d.juegos), 'se cuentan como efectivo') : ''}
      </div>

      <div class="card" id="cuadre">
        <h3 style="margin:0 0 6px">Cuadre de caja</h3>
        <div class="line"><span>Cambio inicial</span><b id="cq-cambio">${$(d.cambio)}</b></div>
        <div class="line"><span>+ Ventas en efectivo</span><b>${$(d.efectivo)}</b></div>
        ${sel ? `<div class="line"><span>+ Juegos e ingresos extra</span><b>${$(d.juegos)}</b></div>` : ''}
        <div class="line"><span><b>Debería haber en caja</b></span><b id="cq-esp" style="font-size:1.15rem">${$(d.esperado)}</b></div>
        <div class="line"><span>Efectivo contado</span><b id="cq-cont">${d.contado === null ? '—' : $(d.contado)}</b></div>
        <div class="line"><span>Diferencia</span><b id="cq-dif" class="${claseMsg}">${d.dif === null ? '—' : $(d.dif)}</b></div>
        <p id="cq-msg" class="${claseMsg}" style="margin:8px 0 0">${textoMsg}</p>
      </div>

      <div class="grid2" style="align-items:start">
        ${bloqueConteo('c', '💵', 'Cambio inicial', 'El efectivo con el que empiezas (monedas y billetes para dar cambio).', desgloseCambio, d.cambio)}
        ${bloqueConteo('r', '🧮', 'Conteo real al cierre', 'Cuenta todo el efectivo que hay en la caja al terminar.', desgloseConteo, d.contado || 0)}
      </div>

      <div class="card"><div class="grid3">${ui.inp('com', 'Comisión de terminal (%)', ui.cfg.comision(), 'number', 'step="0.1"')}</div></div>`;

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
      const esperado = cambio.total + d.efectivo + d.juegos, dif = conteo.hayAlgo ? conteo.total - esperado : null;
      const [clase, texto] = mensajeDiferencia(dif);
      q('#cq-cambio').textContent = $(cambio.total);
      q('#cq-esp').textContent = $(esperado);
      q('#cq-cont').textContent = conteo.hayAlgo ? $(conteo.total) : '—';
      q('#cq-dif').textContent = dif === null ? '—' : $(dif);
      q('#cq-dif').className = clase;
      q('#cq-msg').className = clase;
      q('#cq-msg').textContent = texto;
      return {cambio, conteo};
    };

    el.oninput = e => { if (e.target.classList.contains('den') || e.target.classList.contains('dir')) actualizar(); };
    el.onchange = e => {
      if (e.target.id === 's') { CC.cajaSel = e.target.value; return CC.router.show(); }
      if (e.target.name === 'com') { localStorage.setItem('clowncloud:comision', +e.target.value || 0); return ui.toast('Comisión guardada: aplica a ventas nuevas'); }
      if (!e.target.classList.contains('den') && !e.target.classList.contains('dir')) return;
      const {cambio, conteo} = actualizar();
      guardar(sel, {fondoCaja: cambio.total, cambioDesglose: cambio.desglose, efectivoContado: conteo.hayAlgo ? conteo.total : null, conteoDesglose: conteo.desglose});
    };

    q('#csv').onclick = () => CC.excel.descargar('caja-' + ui.hoy(), {
      Resumen: [{
        'Total vendido': d.total, Efectivo: d.efectivo, Tarjeta: d.tarjeta, Transferencia: d.transf, 'Comisión de terminal': d.comision,
        'Cambio inicial': d.cambio, 'Juegos e ingresos extra': d.juegos, 'Efectivo esperado': d.esperado, 'Efectivo contado': d.contado ?? '', Diferencia: d.dif ?? ''
      }],
      'Billetes y monedas': DENOMINACIONES.map(x => ({
        'Denominación': x, 'Piezas de cambio inicial': +desgloseCambio[x] || 0, 'Piezas contadas al cierre': +desgloseConteo[x] || 0,
        'Subtotal cambio': x * (+desgloseCambio[x] || 0), 'Subtotal conteo': x * (+desgloseConteo[x] || 0)
      })),
      Ventas: d.vs.map(v => ({
        Fecha: v.fecha, Detalle: v.items.map(i => i.cant + 'x ' + i.nombre).join(' / '), Piezas: v.items.reduce((a, i) => a + i.cant, 0),
        Total: v.total, Pago: v.pago, 'Comisión': v.comision || 0
      }))
    });
  });
})();