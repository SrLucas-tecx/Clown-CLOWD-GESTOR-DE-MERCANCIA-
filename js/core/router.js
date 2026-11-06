// Barra de secciones + pestañas de cada sección. Cada módulo se registra con CC.router.register.
// El ORDEN de las secciones y de sus pestañas va de lo más usado a lo menos usado.
CC.router = {
  views: [],
  ultima: {},
  secciones: [
    {
      id: 'inicio',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-ico" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      label: 'Inicio',
      paginas: ['inicio']
    },
    {
      id: 'ventas',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-ico" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
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
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-ico" aria-hidden="true"><path d="M3 10h18"/><path d="M4 10l1-6h14l1 6"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/></svg>',
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
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-ico" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M3 8v9l9 5 9-5V8"/><path d="M12 13v9"/></svg>',
      label: 'Inventario',
      paginas: [
        'inventario',
        'temas',
        'materiales',
        'compras',
        'conteo',
        'catalogo',
        'costos'
      ]
    },
    {
      id: 'reportes',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-ico" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
      label: 'Reportes',
      paginas: [
        'reportes',
        'reportes-ventas',
        'reportes-productos',
        'reportes-bazares',
        'interes',
        'rentabilidad'
      ]
    },
    {
      id: 'ajustes',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-ico" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2z"/></svg>',
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
    nav.innerHTML = this.secciones.map(s => `<button class="nav-item" data-s="${s.id}">${s.icon}<span>${s.label}</span></button>`).join('');
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
