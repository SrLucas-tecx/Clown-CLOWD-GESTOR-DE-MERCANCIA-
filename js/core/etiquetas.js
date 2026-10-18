// Etiquetas personalizables (nombre + color) compartidas por clientes y productos.
CC.tags = {
  lista: ambito => CC.db.all('etiquetas').filter(t => t.ambito === ambito),
  chips: ids => (ids || []).map(id => CC.db.get('etiquetas', id)).filter(t => t && !t.eliminado)
    .map(t => `<span class="chip" style="--c:${t.color}">${CC.ui.esc(t.nombre)}</span>`).join(''),
  picker(ambito, sel = []) {
    return `<div class="tagpick" data-a="${ambito}">${this.lista(ambito).map(t => `<label class="chip ${sel.includes(t.id) ? 'on' : ''}" style="--c:${t.color}"><input type="checkbox" value="${t.id}" hidden ${sel.includes(t.id) ? 'checked' : ''}>${CC.ui.esc(t.nombre)}</label>`).join('')}
      <div class="add"><input class="inp tn" placeholder="Nueva etiqueta (ej. pares)"><input class="tc" type="color" value="#ffc933"><button type="button" class="btn ghost sm" data-add>＋</button></div></div>`;
  },
  // Ventana para renombrar, recolorear y eliminar las etiquetas de un ámbito (cliente | producto).
  gestionar(ambito, fin) {
    const { db, ui } = CC, E = ui.esc, tabla = ambito === 'cliente' ? 'clientes' : ambito === 'consulta' ? 'consultas' : 'productos', self = this;
    const guardar = m => m.querySelectorAll('.tgr').forEach(r => { const n = r.querySelector('.tn').value.trim(); if (n) db.update('etiquetas', r.dataset.id, { nombre: n, color: r.querySelector('.tc').value }); });
    ui.modal('Etiquetas de ' + (ambito === 'cliente' ? 'clientes' : ambito === 'consulta' ? 'consultas' : 'productos'), this.lista(ambito).map(t => `<div class="tgr" data-id="${t.id}"><input class="inp tn" value="${E(t.nombre)}"><input class="tc" type="color" value="${t.color}"><button type="button" class="btn ghost sm" data-del>Eliminar</button></div>`).join('') || '<p class="mute">Aún no hay etiquetas. Créalas con el ＋ desde un cliente o producto.</p>', m => { guardar(m); fin && fin(); });
    const m = document.getElementById('modal'), base = m.onclick;
    m.onclick = e => {
      const b = e.target.closest('[data-del]'); if (!b) return base(e);
      const id = b.closest('.tgr').dataset.id, usos = db.all(tabla).filter(r => (r.etiquetas || []).includes(id)); guardar(m);
      ui.confirm(usos.length ? `Esta etiqueta está en ${usos.length} registro(s); se quitará de todos.` : '¿Eliminar esta etiqueta?').then(ok => {
        if (ok) { usos.forEach(r => db.update(tabla, r.id, { etiquetas: r.etiquetas.filter(x => x !== id) })); db.remove('etiquetas', id); }
        self.gestionar(ambito, fin); });
    };
  },
  leer: root => [...root.querySelectorAll('.tagpick input:checked')].map(i => i.value),
  bind(root) {
    const box = root.querySelector('.tagpick'); if (!box) return;
    box.onchange = e => { if (e.target.type === 'checkbox') e.target.parentElement.classList.toggle('on', e.target.checked); };
    box.onclick = e => {
      if (!e.target.closest('[data-add]')) return;
      const n = box.querySelector('.tn').value.trim(); if (!n) return;
      const sel = this.leer(box), t = CC.db.add('etiquetas', { nombre: n, color: box.querySelector('.tc').value, ambito: box.dataset.a });
      box.outerHTML = this.picker(box.dataset.a, [...sel, t.id]); this.bind(root);
    };
  }
};
