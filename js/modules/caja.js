// Caja (como en LUCXSTUDIO): por bazar o general; efectivo esperado contra contado y descarga en CSV.
(() => {
  const { db, ui } = CC, E = ui.esc, $ = ui.money, KG = 'clowncloud:cajaGeneral';
  const gen = () => { try { return JSON.parse(localStorage.getItem(KG)) || {}; } catch (e) { return {}; } };
  CC.cajaSel = '';
  function datos(sel) {
    const vs = CC.ventasOk().filter(v => (v.eventoId || '') === sel), suma = p => vs.filter(v => v.pago === p).reduce((s, v) => s + v.total, 0), c = sel ? db.get('eventos', sel) : gen();
    const efectivo = suma('Efectivo'), tarjeta = suma('Tarjeta'), transf = suma('Transferencia'), fondo = +c.fondoCaja || 0, esp = fondo + efectivo;
    const cont = c.efectivoContado === undefined || c.efectivoContado === null || c.efectivoContado === '' ? null : +c.efectivoContado;
    return { vs, efectivo, tarjeta, transf, total: efectivo + tarjeta + transf, comision: vs.reduce((s, v) => s + (v.comision || 0), 0), fondo, esp, cont, dif: cont === null ? null : cont - esp };
  }
  const guardar = (sel, p) => sel ? db.update('eventos', sel, p) : localStorage.setItem(KG, JSON.stringify({ ...gen(), ...p }));
  CC.datosCaja = datos;

  CC.router.register('caja', 'Caja', '💰', el => {
    const sel = CC.cajaSel, d = datos(sel);
    const dif = d.dif === null ? 'Captura el efectivo contado para ver si cuadra la caja.' : Math.abs(d.dif) < .01 ? '✅ La caja cuadra exacto.' : d.dif > 0 ? `Sobran ${$(d.dif)} respecto a lo esperado.` : `⚠️ Faltan ${$(-d.dif)} respecto a lo esperado.`;
    el.innerHTML = `<div class="bar"><select class="inp" id="s" style="max-width:300px"><option value="">💰 Caja general (sin bazar)</option>${db.all('eventos').map(e => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>🎪 ${E(e.nombre)}</option>`).join('')}</select><div style="flex:1"></div><button class="btn ghost" id="csv">⬇️ Descargar caja (Excel)</button></div>
      <div class="kpis"><div class="kpi"><small>Total vendido</small><b>${$(d.total)}</b></div><div class="kpi"><small>💵 Efectivo</small><b>${$(d.efectivo)}</b></div><div class="kpi"><small>💳 Tarjeta</small><b>${$(d.tarjeta)}</b><span class="mute">comisión: ${$(d.comision)}</span></div><div class="kpi"><small>🏦 Transferencia</small><b>${$(d.transf)}</b></div>
      <div class="kpi" style="border-color:var(--acc);background:var(--color-accent-soft)"><small>Debería haber en caja</small><b>${$(d.esp)}</b><span class="mute">fondo + ventas en efectivo</span></div></div>
      <div class="card"><div class="grid3">${ui.inp('fondo', 'Fondo de caja inicial', d.fondo || '', 'number', 'step="0.01"')}${ui.inp('cont', 'Efectivo contado ahora', d.cont ?? '', 'number', 'step="0.01"')}${ui.inp('com', 'Comisión de terminal (%)', ui.cfg.comision(), 'number', 'step="0.1"')}</div><p class="mute">${dif}</p></div>`;
    const f = n => el.querySelector(`[name=${n}]`);
    el.querySelector('#s').onchange = e => { CC.cajaSel = e.target.value; CC.router.show(); };
    f('fondo').onchange = e => { guardar(sel, { fondoCaja: +e.target.value || 0 }); CC.router.show(); };
    f('cont').onchange = e => { guardar(sel, { efectivoContado: e.target.value === '' ? null : +e.target.value }); CC.router.show(); };
    f('com').onchange = e => { localStorage.setItem('clowncloud:comision', +e.target.value || 0); ui.toast('Comisión guardada: aplica a ventas nuevas'); };
    el.querySelector('#csv').onclick = () => CC.excel.descargar('caja-' + ui.hoy(), {
      Resumen: [{ 'Total vendido': d.total, 'Efectivo': d.efectivo, 'Tarjeta': d.tarjeta, 'Transferencia': d.transf, 'Comisión de terminal': d.comision, 'Fondo de caja': d.fondo, 'Efectivo esperado': d.esp, 'Efectivo contado': d.cont ?? '', 'Diferencia': d.dif ?? '' }],
      Ventas: d.vs.map(v => ({ Fecha: v.fecha, Detalle: v.items.map(i => i.cant + 'x ' + i.nombre).join(' / '), Piezas: v.items.reduce((a, i) => a + i.cant, 0), Total: v.total, Pago: v.pago, 'Comisión': v.comision || 0 })) });
  });
})();
