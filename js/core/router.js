// Menú y navegación por hash. Cada módulo se registra con CC.router.register.
CC.router = {
  views: [],
  register(id, title, icon, render) { this.views.push({ id, title, icon, render }); },
  start() {
    document.getElementById('nav').innerHTML = this.views.map(v => `<a href="#${v.id}" data-id="${v.id}">${v.icon} ${v.title}</a>`).join('');
    window.onhashchange = () => this.show(); this.show();
  },
  show() {
    const v = this.views.find(x => x.id === location.hash.slice(1)) || this.views[0];
    document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.id === v.id));
    document.getElementById('title').textContent = v.title;
    v.render(document.getElementById('view'));
  }
};
