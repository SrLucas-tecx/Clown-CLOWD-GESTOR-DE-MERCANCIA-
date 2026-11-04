// Barra de secciones + pestañas de cada sección. Cada módulo se registra con CC.router.register.
// El ORDEN de las secciones y de sus pestañas va de lo más usado a lo menos usado.
CC.router = {
  views: [],
  ultima: {},
  secciones: [
    {
      id: 'inicio',
      icon: '🏠',
      label: 'Inicio',
      paginas: ['inicio']
    },
    {
      id: 'ventas',
      icon: '🛒',
      label: 'Ventas',
      paginas: [
        'ventas',
        'pedidos',
        'historial',
        'clientes',
        'promos',
        'lista'
      ]
    },
    {
      id: 'bazares',
      icon: '🎪',
      label: 'Bazares',
      paginas: [
        'eventos',
        'caja',
        'juegos',
        'comparativa'
      ]
    },
    {
      id: 'inventario',
      icon: '📦',
      label: 'Inventario',
      paginas: [
        'inventario',
        'temas',
        'materiales',
        'compras',
        'sorpresa',
        'conteo',
        'catalogo',
        'costos'
      ]
    },
    {
      id: 'reportes',
      icon: '📊',
      label: 'Reportes',
      paginas: [
        'reportes',
        'interes',
        'rentabilidad'
      ]
    },
    {
      id: 'ajustes',
      icon: '⚙️',
      label: 'Ajustes',
      paginas: [
        'general',
        'apariencia',
        'tipos',
        'reglas',
        'respaldo'
      ]
    }
  ],
  register(id, title, icon, render) {
    this.views.push({
      id,
      title,
      icon,
      render
    });
  },
  start() {
    const nav = document.getElementById('nav');
    nav.innerHTML = this.secciones.map(s => `<button class="nav-item" data-s="${s.id}"><span class="nav-ico">${s.icon}</span><span>${s.label}</span></button>`).join('');
    nav.onclick = e => {
      const b = e.target.closest('[data-s]');
      if (!b)
        return;
      const s = this.secciones.find(x => x.id === b.dataset.s);
      location.hash = this.ultima[s.id] || s.paginas[0];
    };
    document.getElementById('subnav').onclick = e => {
      const b = e.target.closest('[data-p]');
      if (b)
        location.hash = b.dataset.p;
    };
    window.onhashchange = () => this.show();
    this.show();
  },
  show() {
    const v = this.views.find(x => x.id === location.hash.slice(1)) || this.views[0];
    const s = this.secciones.find(x => x.paginas.includes(v.id)) || this.secciones[0];
    this.ultima[s.id] = v.id;

    // Sección activa en la barra principal
    document.querySelectorAll('#nav .nav-item').forEach(b => {
      const activa = b.dataset.s === s.id;
      b.classList.toggle('active', activa);
      if (activa)
        b.setAttribute('aria-current', 'page');
      else
        b.removeAttribute('aria-current');
    });

    // Pestañas de la sección (se ocultan si la sección tiene una sola pantalla)
    const sub = document.getElementById('subnav');
    sub.style.display = s.paginas.length > 1 ? 'flex' : 'none';
    sub.innerHTML = s.paginas.map(id => {
      const w = this.views.find(x => x.id === id);
      return `<button class="subnav-tab ${id === v.id ? 'active' : ''}" data-p="${id}"><span aria-hidden="true">${w.icon}</span> ${w.title}</button>`;
    }).join('');

    // Que la pestaña activa siempre quede a la vista en pantallas chicas
    const activa = sub.querySelector('.active');
    if (activa && activa.scrollIntoView)
      activa.scrollIntoView({ block: 'nearest', inline: 'center' });

    document.title = v.title + ' · CLOWN CLOUD';
    v.render(document.getElementById('view'));
  }
};
