// Clientes individuales con etiquetas personalizables, búsqueda e historial («Ver más»).
(() => {
  const { db, ui } = CC, E = ui.esc; let filtro = null, q = '';
  const norm = s => String(s || '').trim().toLowerCase();
  function form(c) {
    ui.modal(c ? 'Editar cliente' : 'Nuevo cliente', ui.inp('nombre', 'Nombre', c?.nombre) + ui.inp('contacto', 'Teléfono o Instagram', c?.contacto) +
      ui.inp('notas', 'Gustos y notas (series, personajes…)', c?.notas) + '<label>Etiquetas</label>' + CC.tags.picker('cliente', c?.etiquetas), m => {
      const o = ui.vals(m), n = o.nombre.trim(); if (!n) { ui.toast('Falta el nombre'); return false; }
      if (db.all('clientes').some(x => norm(x.nombre) === norm(n) && (!c || x.id !== c.id))) { ui.toast('No se puede: ya existe un cliente con ese nombre'); return false; }
      const d = { nombre: n, contacto: o.contacto, notas: o.notas, etiquetas: CC.tags.leer(m) };
      c ? db.update('clientes', c.id, d) : db.add('clientes', d); ui.toast(c ? 'Cliente actualizado' : 'Cliente agregado'); CC.router.show();
    });
    CC.tags.bind(document.getElementById('modal'));
  }
  CC.clienteForm = form;
  function ver(c) {
    const vs = CC.ventasOk().filter(v => v.clienteId === c.id), cnt = {}; vs.forEach(v => v.items.forEach(i => cnt[i.nombre] = (cnt[i.nombre] || 0) + i.cant));
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3);
    ui.detalle({ icon: '👤', title: c.nombre, sub: c.contacto || 'Sin contacto', secciones: [
      { t: 'Compras', f: [['Pedidos', vs.length], ['Total gastado', ui.money(vs.reduce((s, v) => s + v.total, 0)), 'good'], ['Última compra', vs.length ? vs[vs.length - 1].fecha : '—']] },
      { t: 'Lo que más compra', f: top.length ? top.map(x => [x[0], x[1] + ' pzs']) : [['Aún sin compras', '']] },
      { html: `<div>${CC.tags.chips(c.etiquetas)}</div>${c.notas ? `<p class="mute">${E(c.notas)}</p>` : ''}` }], acciones: [{ label: '✏️ Editar', fn: () => form(c) }] });
  }
  CC.router.register('clientes', 'Clientes', '👥', el => {
    el.innerHTML = `<div class="bar"><input class="inp" id="q" placeholder="Buscar cliente…" value="${E(q)}" style="max-width:260px"><div style="flex:1"></div><button class="btn ghost" id="et">🏷️ Etiquetas</button><button class="btn" id="nuevo">+ Cliente</button></div>
      <div class="flt"><span class="chip ${filtro ? '' : 'on'}" data-t="" style="--c:#ffc933">Todos</span>${CC.tags.lista('cliente').map(t => `<span class="chip ${filtro === t.id ? 'on' : ''}" data-t="${t.id}" style="--c:${t.color}">${E(t.nombre)}</span>`).join('')}</div>
      <div class="card"><table><thead><tr><th>Cliente</th><th>Etiquetas</th><th>Notas</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>`;
    const filas = () => {
      const cs = db.all('clientes').filter(c => (!filtro || (c.etiquetas || []).includes(filtro)) && norm(c.nombre + ' ' + (c.contacto || '')).includes(norm(q)));
      el.querySelector('#rows').innerHTML = cs.map(c => `<tr><td><b>${E(c.nombre)}</b><div class="mute">${E(c.contacto || '')}</div></td><td>${CC.tags.chips(c.etiquetas)}</td><td class="mute">${E(c.notas || '')}</td>
        <td class="end"><button class="btn sm" data-v="${c.id}">Ver más</button> <button class="btn ghost sm" data-e="${c.id}">Editar</button> <button class="btn ghost sm" data-d="${c.id}">Eliminar</button></td></tr>`).join('')
        || `<tr><td colspan="4" class="mute">${q || filtro ? 'Ningún cliente coincide.' : 'Sin clientes todavía. Agrega el primero con «+ Cliente».'}</td></tr>`;
    };
    filas();
    el.querySelector('#q').oninput = e => { q = e.target.value; filas(); };
    el.querySelector('#nuevo').onclick = () => form();
    el.querySelector('#et').onclick = () => CC.tags.gestionar('cliente', () => CC.router.show());
    el.onclick = e => {
      const t = e.target.closest('[data-t]'), b = e.target.closest('button');
      if (t) { filtro = t.dataset.t || null; return CC.router.show(); }
      if (!b) return;
      if (b.dataset.e) form(db.get('clientes', b.dataset.e));
      if (b.dataset.v) ver(db.get('clientes', b.dataset.v));
      if (b.dataset.d) ui.confirm('¿Eliminar este cliente?').then(ok => { if (ok) { const copia = JSON.stringify(db.crudo()); db.remove('clientes', b.dataset.d); CC.router.show(); ui.deshacer('Cliente eliminado.', copia); } });
    };
  });
})();
