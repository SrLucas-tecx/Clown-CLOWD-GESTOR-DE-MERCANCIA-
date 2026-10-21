// Resumen del negocio.
(() => {
  const {db, ui} = CC;
  CC.router.register('inicio', 'Inicio', '🏠', el => {
    const hoy = ui.hoy(), vs = CC.ventasOk(), vh = vs.filter(v => v.fecha === hoy), vm = vs.filter(v => v.fecha.slice(0, 7) === hoy.slice(0, 7)), sum = a => a.reduce((s, v) => s + v.total, 0);
    const vars = db.all('variantes'), al = CC.alertas();
    const valor = vars.reduce((s, v) => s + Math.max(0, CC.stock(v.id)) * v.costo, 0);
    const k = (t, b) => `<div class="kpi"><small>${t}</small><b>${b}</b></div>`;
    el.innerHTML = `<div class="kpis">${k('Ventas de hoy', ui.money(sum(vh)))}${k('Ventas del mes', ui.money(sum(vm)))}${k('Ganancia del mes', ui.money(CC.utilidad(vm)))}${k('Valor del inventario (costo)', ui.money(valor))}</div>
      <div class="card"><h3>Alertas (${al.length})</h3>${al.map(x => `<div class="line"><span>${x[0]} ${ui.esc(x[1])}</span></div>`).join('') || '<p class="mute">Todo en orden ✅</p>'}</div>`;
  });
})();
