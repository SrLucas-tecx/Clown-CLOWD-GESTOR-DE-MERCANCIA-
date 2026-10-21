// Interés por producto: qué preguntan más, qué no había y cuánto de eso se convierte en venta.
(() => {
  const {db, ui} = CC, E = ui.esc, norm = s => String(s || '').trim().toLowerCase();
  let fil = 'all';
  const nom = c => c.varianteId ? CC.nombreVar(db.get('variantes', c.varianteId) || {}) : c.nombre || 'Sin nombre';
  const key = c => c.varianteId || 'txt:' + norm(c.nombre);
  const tagsBase = () => {
    if (!CC.tags.lista('consulta').length)
      [
        [
          'Preguntó precio',
          '#ffc933'
        ],
        [
          'Pidió otro diseño',
          '#6f86bd'
        ],
        [
          'No lo teníamos',
          '#e3363d'
        ],
        [
          'Muy interesado',
          '#3fd08f'
        ]
      ].forEach(([nombre, color]) => CC.db.add('etiquetas', {
        nombre,
        color,
        ambito: 'consulta'
      }));
  };
  function registrar() {
    tagsBase();
    const vs = db.all('variantes'), evs = db.all('eventos');
    ui.modal('Registrar consulta', `<label>Producto<select class="inp" name="v"><option value="">✍️ Otro / no lo teníamos</option>${vs.map(v => `<option value="${v.id}">${E(CC.nombreVar(v))}</option>`).join('')}</select></label><div id="nw">${ui.inp('nombre', 'Nombre de lo que preguntaron')}</div>
      <div class="grid2">${ui.inp('cant', '¿Cuántas veces preguntaron?', 1, 'number')}${ui.inp('fecha', 'Fecha', ui.hoy(), 'date')}</div>
      <label>Bazar (opcional)<select class="inp" name="ev"><option value="">Sin bazar</option>${evs.map(e => `<option value="${e.id}" ${e.id === fil ? 'selected' : ''}>${E(e.nombre)}</option>`).join('')}</select></label><label>Etiquetas</label>${CC.tags.picker('consulta')}`, m => {
      const o = ui.vals(m);
      if (!o.v && !o.nombre.trim()) {
        ui.toast('Elige un producto o escribe qué preguntaron');
        return false;
      }
      if (!(+o.cant >= 1)) {
        ui.toast('La cantidad debe ser al menos 1');
        return false;
      }
      db.add('consultas', {
        varianteId: o.v,
        nombre: o.v ? '' : o.nombre.trim(),
        cant: Math.floor(+o.cant),
        eventoId: o.ev,
        fecha: o.fecha,
        etiquetas: CC.tags.leer(m)
      });
      ui.toast('Consulta registrada');
      CC.router.show();
    });
    const m = document.getElementById('modal');
    CC.tags.bind(m);
    m.onchange = e => {
      if (e.target.name === 'v')
        m.querySelector('#nw').style.display = e.target.value ? 'none' : '';
    };
  }
  CC.interes = { registrar };
  CC.router.register('interes', 'Interés', '❓', el => {
    tagsBase();
    const evs = db.all('eventos');
    if (fil !== 'all' && fil !== 'none' && !evs.some(e => e.id === fil))
      fil = 'all';
    const cs = db.all('consultas').filter(c => fil === 'all' || (fil === 'none' ? !c.eventoId : c.eventoId === fil)), g = {};
    cs.forEach(c => {
      const k = key(c);
      g[k] = g[k] || {
        k,
        n: nom(c),
        id: c.varianteId,
        t: 0
      };
      g[k].t += c.cant;
    });
    const rank = Object.values(g).sort((a, b) => b.t - a.t), max = rank[0] ? rank[0].t : 1, tot = cs.reduce((s, c) => s + c.cant, 0), sin = cs.filter(c => !c.varianteId).reduce((s, c) => s + c.cant, 0), k = (t, b, s = '') => `<div class="kpi"><small>${t}</small><b>${b}</b>${s}</div>`;
    el.innerHTML = `<div class="bar"><select class="inp" id="f" style="max-width:280px"><option value="all">Todas las consultas</option><option value="none" ${fil === 'none' ? 'selected' : ''}>Solo sin bazar</option>${evs.map(e => `<option value="${e.id}" ${fil === e.id ? 'selected' : ''}>🎪 ${E(e.nombre)}</option>`).join('')}</select><div style="flex:1"></div><button class="btn ghost" id="et">🏷️ Etiquetas</button><button class="btn" id="n">+ Registrar consulta</button></div>
      <div class="kpis">${k('Consultas totales', tot)}${k('🔥 Más preguntado', E(rank[0] ? rank[0].n : '—'), `<span class="mute">${rank[0] ? rank[0].t + ' consulta(s)' : 'aún sin consultas'}</span>`)}${k('Lo que no teníamos', sin, '<span class="mute">preguntas por productos fuera del catálogo</span>')}</div>
      <div class="card"><h3>Ranking de interés (suma «+1» con un toque)</h3>${rank.map(r => {
      const v = r.id ? db.get('variantes', r.id) : null, vend = v ? CC.vendidos(v.id) : null, conv = vend === null ? null : Math.round(vend / r.t * 100);
      return `<div class="line"><div style="flex:1;min-width:0"><b>${E(r.n)}</b> ${v ? '' : '<span class="chip" style="--c:var(--rojo-300)">No lo teníamos</span>'}${v && r.t >= 3 && vend < r.t / 2 ? '<span class="chip" style="--c:var(--amarillo-300)">Preguntan más de lo que compran</span>' : ''}
          <div class="meter" style="margin:4px 0"><i style="width:${Math.round(r.t / max * 100)}%"></i></div><span class="mute">${r.t} consulta(s)${vend === null ? ' · candidato a producir' : ` · ${vend} vendida(s) · conversión ${conv}%`}</span></div>
          <button class="btn ghost sm" data-m="${r.k}">−1</button><button class="btn sm" data-p="${r.k}">+1</button></div>`;
    }).join('') || '<p class="mute">Registra consultas para ver qué preguntan más.</p>'}</div>
      <div class="card"><h3>Últimas consultas</h3>${db.all('consultas').slice(-8).reverse().map(c => `<div class="line"><span>${E(nom(c))} ×${c.cant} <span class="mute">${c.fecha}${c.eventoId ? ' · ' + E((db.get('eventos', c.eventoId) || {}).nombre || '') : ''}</span> ${CC.tags.chips(c.etiquetas)}</span><button class="btn ghost sm" data-d="${c.id}">Eliminar</button></div>`).join('') || '<p class="mute">Sin consultas.</p>'}</div>`;
    el.querySelector('#n').onclick = registrar;
    el.querySelector('#et').onclick = () => CC.tags.gestionar('consulta', () => CC.router.show());
    el.querySelector('#f').onchange = e => {
      fil = e.target.value;
      CC.router.show();
    };
    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b)
        return;
      const mismo = k2 => db.all('consultas').filter(c => key(c) === k2 && (fil === 'all' || (fil === 'none' ? !c.eventoId : c.eventoId === fil)));
      if (b.dataset.p) {
        const r = mismo(b.dataset.p).pop() || {};
        db.add('consultas', {
          varianteId: r.varianteId || '',
          nombre: r.nombre || '',
          cant: 1,
          eventoId: fil !== 'all' && fil !== 'none' ? fil : '',
          fecha: ui.hoy(),
          etiquetas: []
        });
        CC.router.show();
      } else if (b.dataset.m) {
        const r = mismo(b.dataset.m).pop();
        if (!r)
          return;
        r.cant > 1 ? db.update('consultas', r.id, { cant: r.cant - 1 }) : db.remove('consultas', r.id);
        CC.router.show();
      } else if (b.dataset.d) {
        db.remove('consultas', b.dataset.d);
        CC.router.show();
      }
    };
  });
})();
