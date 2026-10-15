// Bazares: gastos, punto de equilibrio en vivo y ganancia real por evento.
(() => {
  const { db, ui } = CC, E = ui.esc;
  const calc = e => { const vs = CC.ventasOk().filter(v => v.eventoId === e.id), util = CC.utilidad(vs);
    const gas = (+e.espacio || 0) + db.all('gastos').filter(g => g.eventoId === e.id).reduce((s, g) => s + g.monto, 0);
    return { n: vs.length, venta: vs.reduce((s, v) => s + v.total, 0), gas, neto: util - gas, pct: gas ? Math.min(100, Math.round(util / gas * 100)) : 100 }; };
  const nuevo = () => ui.modal('Nuevo evento', ui.inp('nombre', 'Nombre del bazar') + `<div class="grid2">${ui.inp('fecha', 'Fecha', ui.hoy(), 'date')}${ui.inp('espacio', 'Costo del espacio', '', 'number')}</div>`, m => {
    const o = ui.vals(m); if (!o.nombre.trim()) { ui.toast('Falta el nombre'); return false; }
    db.add('eventos', { nombre: o.nombre.trim(), fecha: o.fecha, espacio: +o.espacio || 0 }); CC.router.show(); });
  const gasto = id => ui.modal('Gasto del evento', ui.inp('concepto', 'Concepto (transporte, comida…)') + ui.inp('monto', 'Monto', '', 'number'), m => {
    const o = ui.vals(m); if (!(+o.monto > 0)) { ui.toast('Pon un monto'); return false; }
    db.add('gastos', { eventoId: id, concepto: o.concepto, monto: +o.monto }); CC.router.show(); });

  CC.router.register('eventos', 'Eventos', '🎪', el => {
    const evs = db.all('eventos').slice().reverse();
    el.innerHTML = `<div class="bar"><button class="btn" id="nuevo">+ Evento</button></div>` + (evs.map(e => { const c = calc(e);
      return `<div class="card"><div class="bar"><div style="flex:1"><h3 style="margin:0">${E(e.nombre)}</h3><span class="mute">${e.fecha}</span></div><button class="btn ghost sm" data-g="${e.id}">+ Gasto</button></div>
        <div class="meter"><i style="width:${c.pct}%"></i></div><div class="mute">${c.pct >= 100 ? 'Gastos cubiertos' : 'Equilibrio: ' + c.pct + '% de los gastos cubiertos'}</div>
        <div class="kpis" style="margin:10px 0 0"><div class="kpi"><small>Ventas (${c.n})</small><b>${ui.money(c.venta)}</b></div><div class="kpi"><small>Gastos</small><b>${ui.money(c.gas)}</b></div><div class="kpi"><small>Ganancia real</small><b class="${c.neto < 0 ? 'neg' : 'pos-n'}">${ui.money(c.neto)}</b></div></div></div>`; }).join('') || '<p class="mute">Registra tu primer bazar para ver su rendimiento.</p>');
    el.querySelector('#nuevo').onclick = nuevo;
    el.onclick = e => { const b = e.target.closest('[data-g]'); if (b) gasto(b.dataset.g); };
  });
})();
