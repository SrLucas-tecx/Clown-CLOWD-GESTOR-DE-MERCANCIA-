// Resumen del negocio.
(() => {
  const {db, ui} = CC;
  CC.router.register('inicio', 'Inicio', '🏠', el => {
    const hoy = ui.hoy(), vs = CC.ventasOk(), vh = vs.filter(v => v.fecha === hoy), vm = vs.filter(v => v.fecha.slice(0, 7) === hoy.slice(0, 7)), sum = a => a.reduce((s, v) => s + v.total, 0);
    const vars = db.all('variantes'), al = CC.alertas();
    const valor = vars.reduce((s, v) => s + Math.max(0, CC.stock(v.id)) * v.costo, 0);
    const iconoVentas = '<svg class="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
    const k = (t, b, icono = '') => `<div class="kpi">${icono}<small>${t}</small><b>${b}</b></div>`;
    const alertas = al.map(([nivel, mensaje]) => {
      const estado = nivel === '🔴' ? 'bad' : nivel === '🟡' ? 'warn' : 'ok';
      const etiqueta = nivel === '🔴' ? 'Alerta' : nivel === '🟡' ? 'Revisar' : 'Correcto';
      return `<div class="line"><span><i class="led-dot ${estado}" role="img" aria-label="${etiqueta}"></i>${ui.esc(mensaje)}</span></div>`;
    }).join('');
    el.innerHTML = `<div class="kpis">${k('Ventas de hoy', ui.money(sum(vh)), iconoVentas)}${k('Ventas del mes', ui.money(sum(vm)))}${k('Ganancia del mes', ui.money(CC.utilidad(vm)))}${k('Valor del inventario (costo)', ui.money(valor))}</div>
      <div class="dashboard-grid">
        <section class="card"><h3>Alertas (${al.length})</h3>${alertas || '<p class="mute">Todo en orden ✅</p>'}</section>
        <section class="card"><h3>Acciones rápidas</h3>
          <div class="bar">
            <a class="btn ghost" href="#ventas">Registrar venta</a>
            <a class="btn ghost" href="#inventario">Ver inventario</a>
            <a class="btn ghost" href="#eventos">Ver bazares</a>
          </div>
        </section>
      </div>`;
  });
})();
