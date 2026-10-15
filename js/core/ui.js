// Utilidades de interfaz: dinero, escape, avisos, ventanas y miniaturas.
CC.ui = {
  money: n => '$' + (+n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  esc: s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  hoy: () => new Date().toLocaleDateString('sv'),
  toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2500); },
  vals(m) { const o = {}; m.querySelectorAll('[name]').forEach(i => o[i.name] = i.value); return o; },
  modal(title, body, onSave) {
    const m = document.getElementById('modal'), close = () => m.classList.remove('open');
    m.innerHTML = `<div class="modal-box"><div class="modal-header"><h2 class="modal-title">${title}</h2><button class="modal-close" data-x aria-label="Cerrar">✕</button></div><div class="modal-body">${body}</div><div class="modal-footer"><button class="btn ghost" data-x>Cancelar</button>${onSave ? '<button class="btn" data-ok>Guardar</button>' : ''}</div></div>`;
    m.classList.add('open');
    m.onclick = e => { if (e.target === m || e.target.closest('[data-x]')) close(); };
    if (onSave) m.querySelector('[data-ok]').onclick = () => { if (onSave(m) !== false) close(); };
  },
  cfg: { comision: () => +localStorage.getItem('clowncloud:comision') || 3.5 },
  // Pregunta de confirmación con el formato de la página (sustituye a confirm()).
  confirm(msg, ok = 'Eliminar') {
    return new Promise(res => {
      const m = document.getElementById('modal'), f = v => { m.classList.remove('open'); res(v); };
      m.innerHTML = `<div class="modal-box" style="max-width:400px"><div class="modal-header"><h2 class="modal-title">¿Seguro?</h2></div><div class="modal-body"><p>${msg}</p></div><div class="modal-footer"><button class="btn ghost" data-n>Cancelar</button><button class="btn" data-y>${ok}</button></div></div>`;
      m.classList.add('open'); m.onclick = e => { if (e.target === m || e.target.closest('[data-n]')) f(false); };
      m.querySelector('[data-y]').onclick = () => f(true);
    });
  },
  // Ventana «Ver más»: secciones con filas [etiqueta, valor, tono(good|bad)] y botones de acción.
  detalle({ icon, title, sub, secciones = [], acciones = [] }) {
    const m = document.getElementById('modal'), E = CC.ui.esc;
    m.innerHTML = `<div class="modal-box"><div class="modal-header"><h2 class="modal-title">${E(title)}</h2><button class="modal-close" data-x>✕</button></div><div class="modal-body">
      <div class="qd-hero"><span class="qd-icon">${icon || ''}</span><span class="mute">${E(sub || '')}</span></div>
      ${secciones.map(s => `<div class="qd-sec">${s.t ? `<b>${E(s.t)}</b>` : ''}${(s.f || []).map(r => `<div class="qd-row ${r[2] || ''}"><span>${E(r[0])}</span><b>${E(r[1])}</b></div>`).join('')}${s.html || ''}</div>`).join('')}</div>
      <div class="modal-footer">${acciones.map((a, i) => `<button class="btn ${a.ghost ? 'ghost' : ''}" data-a="${i}">${a.label}</button>`).join('')}<button class="btn ghost" data-x>Cerrar</button></div></div>`;
    m.classList.add('open');
    m.onclick = e => { const b = e.target.closest('[data-a]'); if (e.target === m || e.target.closest('[data-x]')) m.classList.remove('open'); else if (b) { m.classList.remove('open'); acciones[b.dataset.a].fn(); } };
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
