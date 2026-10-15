// Bazares: duración, mesa, costos opcionales (＋), pagado/saldo, ingresos extra, caja y ventana «Ver más».
(() => {
  const { db, ui } = CC, E = ui.esc, $ = ui.money;
  const mesa = e => +e.mesa || +e.espacio || 0;
  const calc = e => {
    const vs = CC.ventasOk().filter(v => v.eventoId === e.id), gs = db.all('gastos').filter(g => g.eventoId === e.id), cs = e.costos || [];
    const sum = a => a.reduce((s, x) => s + x.monto, 0), prod = sum(gs.filter(g => g.tipo === 'produccion')), gas = mesa(e) + sum(cs) + sum(gs);
    const util = CC.utilidad(vs), extra = sum(e.ingresos || []), com = vs.reduce((s, v) => s + (v.comision || 0), 0);
    return { n: vs.length, venta: vs.reduce((s, v) => s + v.total, 0), gas, prod, util, extra, com, neto: util + extra - gas - com, pend: Math.max(0, gas - (+e.pagado || 0)), pct: gas ? Math.min(100, Math.round((util + extra) / gas * 100)) : 100, lineas: [[mesa(e) ? 'Mesa / puesto' : '', mesa(e)], ...cs.map(x => [x.concepto, x.monto]), ...gs.map(g => [g.concepto + (g.tipo === 'produccion' ? ' (producción)' : ''), g.monto])].filter(l => l[0]) };
  };
  const fila = '<div class="grid2 cr"><input class="inp cc" placeholder="Concepto (gasolina, comida…)"><input class="inp cm" type="number" step="0.01" placeholder="$ Monto"></div>';
  function nuevo() {
    ui.modal('Nuevo bazar / evento', ui.inp('nombre', 'Nombre del evento') + `<div class="grid3">${ui.inp('fecha', 'Fecha de inicio', ui.hoy(), 'date')}${ui.inp('dias', 'Duración (días)', '', 'number')}${ui.inp('mesa', 'Costo de la mesa', '', 'number', 'step="0.01"')}</div>
      <div class="grid2">${ui.inp('pagado', 'Ya pagado / apartado', '', 'number', 'step="0.01"')}${ui.inp('fondoCaja', 'Fondo de caja inicial', '', 'number', 'step="0.01"')}</div>
      <label>Otros costos (opcional)</label><div id="filas">${fila}</div><button type="button" class="btn ghost sm" id="addc">＋ Agregar costo</button>`, m => {
      const o = ui.vals(m); if (!o.nombre.trim()) { ui.toast('Falta el nombre'); return false; }
      const costos = [...m.querySelectorAll('.cr')].map(r => ({ concepto: r.querySelector('.cc').value.trim() || 'Otro', monto: +r.querySelector('.cm').value || 0 })).filter(c => c.monto > 0);
      db.add('eventos', { nombre: o.nombre.trim(), fecha: o.fecha, dias: +o.dias || 0, mesa: +o.mesa || 0, pagado: +o.pagado || 0, fondoCaja: +o.fondoCaja || 0, costos, ingresos: [] }); CC.router.show(); });
    document.getElementById('addc').onclick = () => document.getElementById('filas').insertAdjacentHTML('beforeend', fila);
  }
  const costo = id => ui.modal('Agregar costo', ui.inp('concepto', 'Concepto') + ui.inp('monto', 'Monto', '', 'number') + '<label>Tipo<select class="inp" name="tipo"><option value="evento">🎪 Evento (mesa, transporte)</option><option value="produccion">🧵 Producción (material)</option></select></label>', m => {
    const o = ui.vals(m); if (!(+o.monto > 0)) { ui.toast('Pon un monto'); return false; }
    db.add('gastos', { eventoId: id, concepto: o.concepto || 'Otro', monto: +o.monto, tipo: o.tipo }); CC.router.show(); });
  const ingreso = id => ui.modal('Ingreso extra', ui.inp('concepto', 'Concepto (rifa, juegos, propinas…)') + ui.inp('monto', 'Monto', '', 'number'), m => {
    const o = ui.vals(m), e = db.get('eventos', id); if (!(+o.monto > 0)) { ui.toast('Pon un monto'); return false; }
    db.update('eventos', id, { ingresos: [...(e.ingresos || []), { concepto: o.concepto || 'Otro', monto: +o.monto }] }); CC.router.show(); });
  const caja = id => { CC.cajaSel = id; location.hash = 'caja'; };
  function ver(e) {
    const c = calc(e);
    ui.detalle({ icon: '🎪', title: e.nombre, sub: `${e.fecha || ''}${e.dias ? ' · ' + e.dias + ' día(s)' : ''}`, secciones: [
      { t: 'Resultado', f: [['Ventas', $(c.venta)], ['Utilidad de lo vendido', $(c.util)], ['Ingresos extra', $(c.extra)], ['Costos del bazar', '− ' + $(c.gas)], ['Comisión de terminal', '− ' + $(c.com)], ['Ganancia real', $(c.neto), c.neto >= 0 ? 'good' : 'bad']] },
      { t: 'Costos', f: c.lineas.length ? c.lineas.map(l => [l[0], $(l[1])]) : [['Sin costos registrados', '']] },
      { t: 'Pagos y caja', f: [['Ya pagado / apartado', $(+e.pagado || 0)], ['Saldo pendiente', $(c.pend), c.pend ? 'bad' : 'good'], ['Fondo de caja', $(+e.fondoCaja || 0)]] }],
      acciones: [{ label: '💰 Ver caja', fn: () => caja(e.id) }, { label: '＋ Costo', ghost: 1, fn: () => costo(e.id) }, { label: '＋ Ingreso', ghost: 1, fn: () => ingreso(e.id) }] });
  }
  CC.router.register('eventos', 'Bazares', '🎪', el => {
    const evs = db.all('eventos').slice().reverse();
    el.innerHTML = `<div class="bar"><button class="btn" id="nuevo">+ Bazar / evento</button></div>` + (evs.map(e => { const c = calc(e);
      return `<div class="card"><div class="bar"><div style="flex:1"><h3 style="margin:0">${E(e.nombre)}</h3><span class="mute">${e.fecha || ''}${e.dias ? ' · ' + e.dias + (e.dias === 1 ? ' día' : ' días') : ''}</span></div><button class="btn sm" data-v="${e.id}">Ver más</button><button class="btn ghost sm" data-c="${e.id}">Caja</button><button class="btn ghost sm" data-g="${e.id}">＋ Costo</button></div>
        <div class="meter"><i style="width:${c.pct}%"></i></div><div class="mute">${c.pct >= 100 ? 'Costos cubiertos' : 'Equilibrio: ' + c.pct + '% de los costos cubiertos'}</div>
        <div class="kpis" style="margin:10px 0 0"><div class="kpi"><small>Ventas (${c.n})</small><b>${$(c.venta)}</b></div><div class="kpi"><small>Costos</small><b>${$(c.gas)}</b></div><div class="kpi"><small>Ganancia real</small><b class="${c.neto < 0 ? 'neg' : 'pos-n'}">${$(c.neto)}</b></div></div></div>`; }).join('') || '<p class="mute">Registra tu primer bazar para ver su rendimiento.</p>');
    el.querySelector('#nuevo').onclick = nuevo;
    el.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.v) ver(db.get('eventos', b.dataset.v)); else if (b.dataset.c) caja(b.dataset.c); else if (b.dataset.g) costo(b.dataset.g); };
  });
})();
