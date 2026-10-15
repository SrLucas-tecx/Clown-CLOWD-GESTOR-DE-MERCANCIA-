// Menú por secciones + pestañas de cada sección (como LUCXSTUDIO). Cada módulo se registra con CC.router.register.
CC.router = {
  views: [], ultima: {},
  secciones: [
    { id: 'inicio', icon: '🏠', label: 'Inicio', paginas: ['inicio'] },
    { id: 'ventas', icon: '🛒', label: 'Ventas', paginas: ['ventas', 'clientes'] },
    { id: 'inventario', icon: '📦', label: 'Inventario', paginas: ['inventario', 'materiales', 'catalogo'] },
    { id: 'negocio', icon: '🎪', label: 'Negocio', paginas: ['eventos', 'caja', 'costos'] },
    { id: 'ajustes', icon: '⚙️', label: 'Ajustes', paginas: ['respaldo'] }
  ],
  register(id, title, icon, render) { this.views.push({ id, title, icon, render }); },
  start() {
    const nav = document.getElementById('nav');
    nav.innerHTML = this.secciones.map(s => `<button class="nav-item" data-s="${s.id}"><span class="nav-ico">${s.icon}</span>${s.label}</button>`).join('');
    nav.onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; const s = this.secciones.find(x => x.id === b.dataset.s); location.hash = this.ultima[s.id] || s.paginas[0]; };
    document.getElementById('subnav').onclick = e => { const b = e.target.closest('[data-p]'); if (b) location.hash = b.dataset.p; };
    window.onhashchange = () => this.show(); this.show();
  },
  show() {
    const v = this.views.find(x => x.id === location.hash.slice(1)) || this.views[0];
    const s = this.secciones.find(x => x.paginas.includes(v.id)) || this.secciones[0]; this.ultima[s.id] = v.id;
    document.querySelectorAll('#nav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.s === s.id));
    const sub = document.getElementById('subnav'); sub.style.display = s.paginas.length > 1 ? 'flex' : 'none';
    sub.innerHTML = s.paginas.map(id => { const w = this.views.find(x => x.id === id); return `<button class="subnav-tab ${id === v.id ? 'active' : ''}" data-p="${id}">${w.icon} ${w.title}</button>`; }).join('');
    document.getElementById('title').textContent = v.title;
    document.getElementById('side').classList.remove('open'); document.getElementById('ov').classList.remove('open');
    v.render(document.getElementById('view'));
  }
};
