// Inventario por movimientos: el stock es la suma de entradas, salidas, mermas y ajustes.
(() => {
  const { db, ui } = CC, E = ui.esc;
  CC.mover = (varianteId, cant, tipo, motivo = '', ref = '') => db.add('movimientos', { varianteId, cant, tipo, motivo, ref, fecha: ui.hoy() });

  function mov() {
    const opts = db.all('variantes').map(v => `<option value="${v.id}">${E(CC.nombreVar(v))}</option>`).join('');
    ui.modal('Movimiento de inventario', `<label>Variante<select class="inp" name="v">${opts}</select></label>
      <div class="grid2"><label>Tipo<select class="inp" name="tipo"><option value="entrada">Entrada (+)</option><option value="merma">Merma (−)</option><option value="ajuste">Ajuste (+ o −)</option></select></label>${ui.inp('cant', 'Cantidad', '', 'number')}</div>${ui.inp('motivo', 'Motivo')}`, m => {
      const o = ui.vals(m); let c = +o.cant;
      if (!o.v || !c) { ui.toast('Elige variante y cantidad'); return false; }
      if (o.tipo === 'merma') c = -Math.abs(c); if (o.tipo === 'entrada') c = Math.abs(c);
      CC.mover(o.v, c, o.tipo, o.motivo); CC.router.show();
    });
  }
  CC.router.register('inventario', 'Inventario', '📦', el => {
    const vs = db.all('variantes'), movs = db.all('movimientos').slice(-25).reverse();
    el.innerHTML = `<div class="bar"><button class="btn" id="mov">+ Movimiento</button></div>
      <div class="card"><h3>Existencias</h3><table><thead><tr><th>Producto</th><th>Stock</th><th>Mínimo</th><th>Estado</th></tr></thead><tbody>
      ${vs.map(v => { const s = CC.stock(v.id), bajo = v.minimo && s <= v.minimo;
        return `<tr><td>${E(CC.nombreVar(v))}</td><td>${s}</td><td>${v.minimo || '—'}</td><td class="${bajo ? 'neg' : 'pos-n'}">${bajo ? 'Resurtir' : 'Bien'}</td></tr>`; }).join('') || '<tr><td colspan="4" class="mute">Sin productos.</td></tr>'}
      </tbody></table></div>
      <div class="card"><h3>Últimos movimientos</h3><table><tbody>${movs.map(m => { const v = db.get('variantes', m.varianteId);
        return `<tr><td>${m.fecha}</td><td>${E(v ? CC.nombreVar(v) : '?')}</td><td>${m.tipo}</td><td class="${m.cant < 0 ? 'neg' : 'pos-n'}">${m.cant > 0 ? '+' : ''}${m.cant}</td><td class="mute">${E(m.motivo)}</td></tr>`; }).join('') || '<tr><td class="mute">Sin movimientos.</td></tr>'}</tbody></table></div>`;
    el.querySelector('#mov').onclick = mov;
  });
})();
