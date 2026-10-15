// Utilidades de interfaz: dinero, escape, avisos, ventanas y miniaturas.
CC.ui = {
  money: n => '$' + (+n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  esc: s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  hoy: () => new Date().toLocaleDateString('sv'),
  toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2500); },
  vals(m) { const o = {}; m.querySelectorAll('[name]').forEach(i => o[i.name] = i.value); return o; },
  modal(title, body, onSave) {
    const m = document.getElementById('modal'), close = () => m.classList.remove('on');
    m.innerHTML = `<div class="box"><h3>${title}</h3>${body}<div class="row"><button class="btn ghost" data-x>Cancelar</button>${onSave ? '<button class="btn" data-ok>Guardar</button>' : ''}</div></div>`;
    m.classList.add('on');
    m.querySelector('[data-x]').onclick = close;
    if (onSave) m.querySelector('[data-ok]').onclick = () => { if (onSave(m) !== false) close(); };
  },
  thumb(file, cb) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { const i = new Image(); i.onload = () => {
      const k = Math.min(1, 160 / Math.max(i.width, i.height)), c = document.createElement('canvas');
      c.width = i.width * k; c.height = i.height * k; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', .7)); }; i.src = r.result; };
    r.readAsDataURL(file);
  },
  inp: (n, l, v = '', t = 'text', x = '') => `<label>${l}<input class="inp" name="${n}" type="${t}" value="${CC.ui.esc(v)}" ${x}></label>`
};
