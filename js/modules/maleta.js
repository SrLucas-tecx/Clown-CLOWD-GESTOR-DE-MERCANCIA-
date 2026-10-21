// Maleta de evento (qué llevas, qué regresa y el faltante) y conteo físico del inventario.
(() => {
  const {db, ui} = CC, E = ui.esc, $ = ui.money, PEND = [
      'Mesa',
      'Fondo de caja',
      'Bolsas',
      'Terminal',
      'Cartelitos'
    ];
  const vend = (ev, vid) => CC.ventasOk().filter(v => v.eventoId === ev).reduce((s, v) => s + v.items.filter(i => i.varianteId === vid).reduce((a, i) => a + i.cant, 0), 0);
  const esp = (m, i) => Math.max(0, i.llevo - vend(m.eventoId, i.varianteId)), nom = id => CC.nombreVar(db.get('variantes', id) || {});
  function preparar() {
    const libres = db.all('eventos').filter(e => !db.all('maletas').some(m => m.eventoId === e.id)), vs = db.all('variantes');
    if (!libres.length)
      return ui.toast(db.all('eventos').length ? 'Ya hay una maleta para cada bazar. Crea otro bazar primero' : 'Primero crea un bazar en Negocio → Bazares');
    const linea = () => `<div class="cl2" style="display:grid;grid-template-columns:3fr 1fr;gap:8px;margin-bottom:8px"><select class="inp lv">${vs.map(v => `<option value="${v.id}">${E(CC.nombreVar(v))} (hay ${Math.max(0, CC.stock(v.id))})</option>`).join('')}</select><input class="inp lq" type="number" min="1" placeholder="Llevo"></div>`;
    ui.modal('Preparar maleta', `<label>Bazar<select class="inp" name="ev">${libres.map(e => `<option value="${e.id}">${E(e.nombre)}</option>`).join('')}</select></label><label>Qué llevas</label><div id="ls">${linea()}</div><button type="button" class="btn ghost sm" id="al">＋ Agregar producto</button>`, m => {
      const items = [...m.querySelectorAll('.cl2')].map(r => ({
        varianteId: r.querySelector('.lv').value,
        llevo: Math.floor(+r.querySelector('.lq').value) || 0
      })).filter(i => i.llevo);
      if (!items.length) {
        ui.toast('Agrega al menos un producto con cantidad');
        return false;
      }
      if (new Set(items.map(i => i.varianteId)).size < items.length) {
        ui.toast('Hay un producto repetido: usa una sola línea');
        return false;
      }
      const mal = items.find(i => i.llevo > CC.stock(i.varianteId));
      if (mal) {
        ui.toast(`No puedes llevar ${mal.llevo} de "${nom(mal.varianteId)}": solo hay ${Math.max(0, CC.stock(mal.varianteId))}`);
        return false;
      }
      db.add('maletas', {
        eventoId: ui.vals(m).ev,
        items,
        lista: PEND.map(t => ({
          t,
          ok: false
        })),
        cerrada: false
      });
      ui.toast('Maleta preparada');
      CC.router.show();
    });
    document.getElementById('al').onclick = () => document.getElementById('ls').insertAdjacentHTML('beforeend', linea());
  }
  function cerrar(m) {
    if (m.cerrada)
      return ui.toast('Esta maleta ya está cerrada');
    const ev = db.get('eventos', m.eventoId) || {};
    ui.modal('Cerrar maleta · ' + E(ev.nombre || ''), '<p class="mute">Cuenta lo que regresó. Si falta algo, se registra como merma.</p>' + m.items.map(i => `<div class="line"><span>${E(nom(i.varianteId))}<div class="mute">llevaste ${i.llevo} · vendiste ${vend(m.eventoId, i.varianteId)} · esperado ${esp(m, i)}</div></span><input class="inp rg" data-v="${i.varianteId}" type="number" min="0" value="${esp(m, i)}" style="width:90px"></div>`).join(''), el => {
      const reg = [...el.querySelectorAll('.rg')].map(r => ({
        varianteId: r.dataset.v,
        regreso: +r.value
      }));
      if (reg.some(r => !(r.regreso >= 0))) {
        ui.toast('No se puede: el regreso no puede ser negativo');
        return false;
      }
      const dif = reg.map(r => ({
          ...r,
          d: esp(m, m.items.find(i => i.varianteId === r.varianteId)) - r.regreso
        })), falta = dif.filter(f => f.d > 0), sobra = dif.filter(f => f.d < 0), nf = falta.reduce((s, f) => s + f.d, 0);
      const hecho = () => {
        const copia = JSON.stringify(db.crudo());
        falta.forEach(f => CC.mover(f.varianteId, -f.d, 'merma', 'Faltante de bazar ' + (ev.nombre || ''), m.id));
        db.update('maletas', m.id, {
          cerrada: true,
          cierre: reg
        });
        CC.router.show();
        ui.deshacer('Maleta cerrada' + (nf ? `: ${nf} pieza(s) como merma` : '') + '.', copia);
      };
      if (falta.length || sobra.length) {
        ui.confirm(`${nf ? `Faltan ${nf} pieza(s) y se registrarán como merma. ` : ''}${sobra.length ? `Sobran piezas en ${sobra.length} producto(s): revisa si anulaste ventas. ` : ''}¿Cerrar la maleta?`, 'Cerrar maleta').then(ok => ok && hecho());
        return false;
      }
      hecho();
    });
  }
  function ver(m) {
    const ev = db.get('eventos', m.eventoId) || {}, ck = m.lista || [];
    ui.detalle({
      icon: '🧳',
      title: 'Maleta · ' + (ev.nombre || ''),
      sub: m.cerrada ? 'Cerrada' : 'Preparada',
      secciones: [
        {
          t: 'Productos',
          f: m.items.map(i => [
            nom(i.varianteId),
            `llevo ${i.llevo} · vendidas ${vend(m.eventoId, i.varianteId)} · esperado ${esp(m, i)}`
          ])
        },
        {
          t: 'Pendientes por llevar',
          html: `<div class="bar" style="flex-wrap:wrap">${ck.map((x, i) => `<button class="btn ${x.ok ? '' : 'ghost'} sm" data-ck="${i}">${x.ok ? '✅' : '⬜'} ${E(x.t)}</button>`).join('')}</div>`
        }
      ],
      acciones: m.cerrada ? [] : [{
          label: '🔒 Cerrar maleta',
          fn: () => cerrar(m)
        }]
    });
    const md = document.getElementById('modal'), base = md.onclick;
    md.onclick = e => {
      const b = e.target.closest('[data-ck]');
      if (!b)
        return base(e);
      const l = ck.map(x => ({ ...x }));
      l[b.dataset.ck].ok = !l[b.dataset.ck].ok;
      db.update('maletas', m.id, { lista: l });
      ver(db.get('maletas', m.id));
    };
  }
  CC.router.register('maleta', 'Maleta', '🧳', el => {
    const ms = db.all('maletas').slice().reverse();
    el.innerHTML = `<div class="bar"><button class="btn" id="n">+ Preparar maleta</button><span class="mute">Anota lo que llevas a un bazar; al regresar, el sistema calcula lo esperado y registra el faltante.</span></div>` + (ms.map(m => {
      const ev = db.get('eventos', m.eventoId) || {}, ok = (m.lista || []).filter(x => x.ok).length;
      return `<div class="card"><div class="bar"><div style="flex:1"><h3 style="margin:0">🧳 ${E(ev.nombre || 'Bazar eliminado')}</h3><span class="mute">${m.items.length} producto(s) · ${m.items.reduce((s, i) => s + i.llevo, 0)} piezas · pendientes ${ok}/${(m.lista || []).length}</span></div><span class="chip" style="--c:${m.cerrada ? 'var(--color-success)' : 'var(--amarillo-300)'}">${m.cerrada ? 'Cerrada' : 'Abierta'}</span><button class="btn sm" data-v="${m.id}">Ver más</button>${m.cerrada ? '' : `<button class="btn ghost sm" data-c="${m.id}">Cerrar</button>`}</div></div>`;
    }).join('') || '<p class="mute">Aún no hay maletas.</p>');
    el.querySelector('#n').onclick = preparar;
    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b)
        return;
      if (b.dataset.v)
        ver(db.get('maletas', b.dataset.v));
      else if (b.dataset.c)
        cerrar(db.get('maletas', b.dataset.c));
    };
  });
  CC.router.register('conteo', 'Conteo físico', '🧮', el => {
    const vs = db.all('variantes');
    el.innerHTML = `<div class="bar"><span class="mute">Cuenta lo que hay en físico y escribe el número. Lo que dejes en blanco no se toca.</span><div style="flex:1"></div><button class="btn" id="ap">Aplicar ajustes</button></div>
      <div class="card"><table><thead><tr><th>Producto</th><th>Sistema</th><th>Contado ✎</th><th>Diferencia</th></tr></thead><tbody>${vs.map(v => `<tr><td>${E(CC.nombreVar(v))}</td><td>${CC.stock(v.id)}</td><td><input class="inp ed ct" data-v="${v.id}" type="number" min="0"></td><td id="d${v.id}">—</td></tr>`).join('') || '<tr><td colspan="4" class="mute">Sin productos.</td></tr>'}</tbody></table></div>`;
    const cuenta = () => [...el.querySelectorAll('.ct')].filter(i => i.value !== '').map(i => ({
      id: i.dataset.v,
      c: +i.value,
      d: +i.value - CC.stock(i.dataset.v)
    }));
    el.oninput = e => {
      const i = e.target.closest('.ct');
      if (!i)
        return;
      const c = el.querySelector('#d' + i.dataset.v), d = +i.value - CC.stock(i.dataset.v);
      c.textContent = i.value === '' ? '—' : d === 0 ? '✅ cuadra' : (d > 0 ? '+' : '') + d;
      c.className = i.value === '' || d === 0 ? '' : d < 0 ? 'neg' : 'warn';
    };
    el.querySelector('#ap').onclick = () => {
      const c = cuenta();
      if (c.some(x => !(x.c >= 0)))
        return ui.toast('No se puede: el conteo no puede ser negativo');
      const dif = c.filter(x => x.d !== 0);
      if (!c.length)
        return ui.toast('No has contado nada: escribe al menos un número');
      if (!dif.length)
        return ui.toast('Todo cuadra: no hay nada que ajustar');
      ui.confirm(`Se ajustarán ${dif.length} producto(s) al conteo físico.`, 'Aplicar').then(ok => {
        if (!ok)
          return;
        const copia = JSON.stringify(db.crudo());
        dif.forEach(x => CC.mover(x.id, x.d, 'ajuste', 'Conteo físico'));
        CC.router.show();
        ui.deshacer('Inventario ajustado al conteo.', copia);
      });
    };
  });
})();
