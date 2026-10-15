// Clientes con etiquetas personalizables (VIP, coleccionista, mayorista…).
(() => {
  const { db, ui } = CC, E = ui.esc; let filtro = null;
  function form(c) {
    ui.modal(c ? 'Editar cliente' : 'Nuevo cliente', ui.inp('nombre', 'Nombre', c?.nombre) + ui.inp('contacto', 'Teléfono o Instagram', c?.contacto) +
      ui.inp('notas', 'Gustos y notas (series, personajes…)', c?.notas) + '<label>Etiquetas</label>' + CC.tags.picker('cliente', c?.etiquetas), m => {
      const o = ui.vals(m); if (!o.nombre.trim()) { ui.toast('Falta el nombre'); return false; }
      const d = { nombre: o.nombre.trim(), contacto: o.contacto, notas: o.notas, etiquetas: CC.tags.leer(m) };
      c ? db.update('clientes', c.id, d) : db.add('clientes', d); CC.router.show();
    });
    CC.tags.bind(document.getElementById('modal'));
  }
  function ver(c) {
    const vs = CC.ventasOk().filter(v => v.clienteId === c.id), cnt = {}; vs.forEach(v => v.items.forEach(i => cnt[i.nombre] = (cnt[i.nombre] || 0) + i.cant));
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3);
    ui.detalle({ icon: '👤', title: c.nombre, sub: c.contacto || 'Sin contacto', secciones: [
      { t: 'Compras', f: [['Pedidos', vs.length], ['Total gastado', ui.money(vs.reduce((s, v) => s + v.total, 0)), 'good'], ['Última compra', vs.length ? vs[vs.length - 1].fecha : '—']] },
      { t: 'Lo que más compra', f: top.length ? top.map(x => [x[0], x[1] + ' pzs']) : [['Aún sin compras', '']] },
      { html: `<div>${CC.tags.chips(c.etiquetas)}</div>${c.notas ? `<p class="mute">${E(c.notas)}</p>` : ''}` }], acciones: [{ label: '✏️ Editar', fn: () => form(c) }] });
  }
  CC.router.register('clientes', 'Clientes', '👥', el => {
    const cs = db.all('clientes').filter(c => !filtro || (c.etiquetas || []).includes(filtro));
    el.innerHTML = `<div class="bar"><div class="flt" style="flex:1;margin:0"><span class="chip ${filtro ? '' : 'on'}" data-t="" style="--c:#6c5ce7">Todos</span>
      ${CC.tags.lista('cliente').map(t => `<span class="chip ${filtro === t.id ? 'on' : ''}" data-t="${t.id}" style="--c:${t.color}">${E(t.nombre)}</span>`).join('')}</div><button class="btn" id="nuevo">+ Cliente</button></div>
      <div class="card"><table><thead><tr><th>Cliente</th><th>Etiquetas</th><th>Notas</th><th></th></tr></thead><tbody>
      ${cs.map(c => `<tr><td><b>${E(c.nombre)}</b><div class="mute">${E(c.contacto || '')}</div></td><td>${CC.tags.chips(c.etiquetas)}</td><td class="mute">${E(c.notas || '')}</td>
        <td class="end"><button class="btn sm" data-v="${c.id}">Ver más</button> <button class="btn ghost sm" data-e="${c.id}">Editar</button> <button class="btn ghost sm" data-d="${c.id}">Eliminar</button></td></tr>`).join('') || '<tr><td colspan="4" class="mute">Sin clientes todavía.</td></tr>'}</tbody></table></div>`;
    el.querySelector('#nuevo').onclick = () => form();
    el.onclick = e => {
      const t = e.target.closest('[data-t]'), b = e.target.closest('button');
      if (t) { filtro = t.dataset.t || null; return CC.router.show(); }
      if (!b) return;
      if (b.dataset.e) form(db.get('clientes', b.dataset.e));
      if (b.dataset.v) ver(db.get('clientes', b.dataset.v));
      if (b.dataset.d) ui.confirm('¿Eliminar este cliente?').then(ok => { if (ok) { db.remove('clientes', b.dataset.d); CC.router.show(); } });
    };
  });
})();
