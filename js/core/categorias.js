// Categorías propias (Pines, Stickers, Llaveros, Pinzas…): pestañas del inventario y lista de los formularios.
CC.categorias = {
  lista() { this.sincronizar(); return CC.db.all('categorias'); },
  icono: n => /llavero/i.test(n) ? '🔑' : /pinza/i.test(n) ? '🎀' : /monedero/i.test(n) ? '👛' : /pin/i.test(n) ? '📍' : /stic?ker/i.test(n) ? '🖼️' : '📦',
  // Crea las categorías base y las que ya aparecen escritas en los productos.
  sincronizar() {
    const { db } = CC, n = s => String(s || '').trim().toLowerCase();
    if (!db.all('categorias').length) [['Pines', '📍'], ['Stickers', '🖼️']].forEach(([nombre, icono]) => db.add('categorias', { nombre, icono }));
    const ex = new Set(db.all('categorias').map(c => n(c.nombre)));
    db.all('productos').forEach(p => { const c = (p.categoria || '').trim(); if (c && !ex.has(n(c))) { ex.add(n(c)); db.add('categorias', { nombre: c, icono: this.icono(c) }); } });
  },
  // Ventana para agregar, renombrar (actualiza sus productos), cambiar el ícono y eliminar categorías.
  gestionar(fin) {
    const { db, ui } = CC, E = ui.esc, n = s => String(s || '').trim().toLowerCase(), self = this;
    const usos = c => db.all('productos').filter(p => n(p.categoria) === n(c.nombre));
    const fila = c => `<div class="tgr cgr" ${c ? `data-id="${c.id}"` : 'data-new="1"'}><input class="inp ci" maxlength="2" value="${E(c ? c.icono : '📦')}" style="text-align:center"><input class="inp cn" value="${E(c ? c.nombre : '')}" placeholder="Nueva categoría"><button type="button" class="btn ghost sm" data-del>${c ? 'Eliminar' : 'Quitar'}</button></div>`;
    const guardar = m => {
      const rows = [...m.querySelectorAll('.cgr')], nombres = rows.map(r => n(r.querySelector('.cn').value)).filter(Boolean);
      if (new Set(nombres).size < nombres.length) { ui.toast('No se puede: hay dos categorías con el mismo nombre'); return false; }
      rows.forEach(r => { const nom = r.querySelector('.cn').value.trim(), ic = r.querySelector('.ci').value.trim() || '📦';
        if (r.dataset.id) { const c = db.get('categorias', r.dataset.id); if (!nom) return; if (n(nom) !== n(c.nombre)) usos(c).forEach(p => db.update('productos', p.id, { categoria: nom })); db.update('categorias', c.id, { nombre: nom, icono: ic }); }
        else if (nom) db.add('categorias', { nombre: nom, icono: ic }); });
      return true;
    };
    ui.modal('Categorías de productos', `<div id="cl">${this.lista().map(c => fila(c)).join('')}</div><button type="button" class="btn ghost sm" id="addcat">＋ Agregar categoría</button>`, m => { if (guardar(m) === false) return false; fin && fin(); });
    const m = document.getElementById('modal'), base = m.onclick;
    m.onclick = e => {
      if (e.target.id === 'addcat') return m.querySelector('#cl').insertAdjacentHTML('beforeend', fila());
      const b = e.target.closest('[data-del]'); if (!b) return base(e);
      const r = b.closest('.cgr'); if (r.dataset.new) return r.remove();
      const c = db.get('categorias', r.dataset.id), k = usos(c).length;
      if (k) return ui.toast(`No se puede eliminar "${c.nombre}": tiene ${k} producto(s). Cámbiales la categoría primero`);
      if (guardar(m) === false) return;
      ui.confirm(`¿Eliminar la categoría "${c.nombre}"?`).then(ok => { if (ok) db.remove('categorias', c.id); self.gestionar(fin); });
    };
  }
};
