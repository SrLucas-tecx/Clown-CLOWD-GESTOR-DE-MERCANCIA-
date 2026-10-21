// Temas de pines y stickers: tarjeta con imagen (se reduce sola; arrastrar y soltar) y sus productos.
// Un producto pertenece a un tema cuando su «Temática» tiene el mismo nombre.
(() => {
  const {db, ui} = CC, E = ui.esc, norm = s => String(s || '').trim().toLowerCase();
  const de = t => db.all('productos').filter(p => norm(p.coleccion) === norm(t.nombre));
  const esPin = p => /pin/i.test(p.categoria || ''), esSt = p => /stic?ker|stiker/i.test(p.categoria || '');
  const vars = p => db.all('variantes').filter(v => v.productoId === p.id);
  const stock = p => vars(p).reduce((s, v) => s + Math.max(0, CC.stock(v.id)), 0);
  // Crea los temas que falten a partir de las temáticas ya escritas en los productos.
  const sincronizar = () => {
    const ex = new Set(db.all('temas').map(t => norm(t.nombre)));
    db.all('productos').forEach(p => {
      const n = (p.coleccion || '').trim();
      if (n && !ex.has(norm(n))) {
        ex.add(norm(n));
        db.add('temas', {
          nombre: n,
          tipo: 'Ambos',
          notas: '',
          imagen: ''
        });
      }
    });
  };
  function zona(m, set) {
    const z = m.querySelector('#dz'), inp = m.querySelector('#fi');
    const tomar = files => {
      if (!files.length)
        return ui.toast('Arrastra el archivo de la imagen (no un enlace). Si viene de Pinterest, guárdala primero en tu equipo');
      if (files.length > 1)
        return ui.toast('Solo se puede agregar una imagen por tema');
      const f = files[0];
      if (!f.type.startsWith('image/'))
        return ui.toast('No se puede: el archivo no es una imagen');
      if (f.size > 8000000)
        return ui.toast(`La imagen pesa ${(f.size / 1000000).toFixed(1)} MB; el máximo es 8 MB`);
      ui.thumb(f, d => {
        set(d);
        z.innerHTML = `<img src="${d}"><div class="mute">Reducida de ${Math.round(f.size / 1024)} KB a ${Math.round(d.length * 0.75 / 1024)} KB</div>`;
      }, 320);
    };
    z.onclick = () => inp.click();
    inp.onchange = () => {
      tomar(inp.files);
      inp.value = '';
    };
    [
      'dragenter',
      'dragover'
    ].forEach(ev => z.addEventListener(ev, e => {
      e.preventDefault();
      z.classList.add('over');
    }));
    [
      'dragleave',
      'drop'
    ].forEach(ev => z.addEventListener(ev, e => {
      e.preventDefault();
      z.classList.remove('over');
    }));
    z.addEventListener('drop', e => tomar(e.dataTransfer.files));
  }
  function form(t) {
    let img = t ? t.imagen || '' : '';
    ui.modal(t ? 'Editar tema' : 'Nuevo tema', ui.inp('nombre', 'Nombre del tema (Gatos, Anime…)', t?.nombre) + `<label>Tipo<select class="inp" name="tipo">${[
      'Pines',
      'Stickers',
      'Ambos'
    ].map(x => `<option ${x === (t?.tipo || 'Ambos') ? 'selected' : ''}>${x}</option>`).join('')}</select></label>` + ui.inp('notas', 'Descripción (opcional)', t?.notas) + `<label>Imagen (opcional, se reduce sola)</label><div class="drop" id="dz">${img ? `<img src="${img}">` : '🖼️ Arrastra una imagen aquí o haz clic para elegirla'}</div><input type="file" accept="image/*" id="fi" hidden>`, m => {
      const o = ui.vals(m), n = o.nombre.trim();
      if (!n) {
        ui.toast('Falta el nombre del tema');
        return false;
      }
      if (db.all('temas').some(x => norm(x.nombre) === norm(n) && (!t || x.id !== t.id))) {
        ui.toast('No se puede: ya existe un tema con ese nombre');
        return false;
      }
      if (t && o.tipo === 'Pines' && de(t).some(esSt)) {
        ui.toast('No se puede cambiar a «Pines»: el tema ya tiene stickers');
        return false;
      }
      if (t && o.tipo === 'Stickers' && de(t).some(esPin)) {
        ui.toast('No se puede cambiar a «Stickers»: el tema ya tiene pines');
        return false;
      }
      if (t) {
        de(t).forEach(p => db.update('productos', p.id, { coleccion: n }));
        db.update('temas', t.id, {
          nombre: n,
          tipo: o.tipo,
          notas: o.notas,
          imagen: img
        });
      } else
        db.add('temas', {
          nombre: n,
          tipo: o.tipo,
          notas: o.notas,
          imagen: img
        });
      CC.router.show();
    });
    zona(document.getElementById('modal'), d => img = d);
  }
  function ver(t) {
    const ps = de(t), vend = ps.reduce((s, p) => s + vars(p).reduce((a, v) => a + CC.vendidos(v.id), 0), 0);
    ui.detalle({
      icon: '🗂️',
      title: t.nombre,
      sub: `${t.tipo}${t.notas ? ' · ' + t.notas : ''}`,
      secciones: [
        {
          t: 'Resumen',
          f: [
            [
              'Pines',
              ps.filter(esPin).length
            ],
            [
              'Stickers',
              ps.filter(esSt).length
            ],
            [
              'Piezas en stock',
              ps.reduce((s, p) => s + stock(p), 0)
            ],
            [
              'Piezas vendidas',
              vend,
              'good'
            ]
          ]
        },
        {
          t: 'Productos del tema',
          f: ps.length ? ps.map(p => [
            p.producto + ' (' + (p.categoria || '—') + ')',
            stock(p) + ' pzs'
          ]) : [[
              'Aún no hay productos',
              ''
            ]]
        }
      ],
      acciones: [{
          label: '✏️ Editar',
          fn: () => form(t)
        }]
    });
  }
  function agregar(t, cat) {
    if (cat === 'Stickers' && t.tipo === 'Pines')
      return ui.toast('Este tema es solo de pines. Edítalo y cámbialo a «Ambos» para agregar stickers');
    if (cat === 'Pines' && t.tipo === 'Stickers')
      return ui.toast('Este tema es solo de stickers. Edítalo y cámbialo a «Ambos» para agregar pines');
    CC.nuevoProducto({
      categoria: cat,
      coleccion: t.nombre
    });
  }
  CC.router.register('temas', 'Temas', '🗂️', el => {
    sincronizar();
    const ts = db.all('temas');
    el.innerHTML = `<div class="bar"><button class="btn" id="n">+ Tema</button><span class="mute">Agrupa pines y stickers por tema. Un producto se une al tema por su «Temática».</span></div><div class="cards">` + (ts.map(t => {
      const ps = de(t);
      return `<div class="pcard">${t.imagen ? `<img src="${t.imagen}">` : '<div class="ph"></div>'}<div class="pb"><b>${E(t.nombre)}</b> <span class="chip" style="--c:var(--azul-300)">${t.tipo}</span><div class="mute">${E(t.notas || '')}</div>
          <div class="line"><span>📍 Pines</span><b>${ps.filter(esPin).length}</b></div><div class="line"><span>🖼️ Stickers</span><b>${ps.filter(esSt).length}</b></div><div class="line"><span>Piezas en stock</span><b>${ps.reduce((s, p) => s + stock(p), 0)}</b></div>
          <div class="bar" style="margin:8px 0 0"><button class="btn sm" data-v="${t.id}">Ver más</button><button class="btn ghost sm" data-p="${t.id}">＋ Pin</button><button class="btn ghost sm" data-s="${t.id}">＋ Sticker</button><button class="btn ghost sm" data-e="${t.id}">Editar</button><button class="btn ghost sm" data-d="${t.id}">Eliminar</button></div></div></div>`;
    }).join('') || '<p class="mute">Crea tu primer tema.</p>') + '</div>';
    el.querySelector('#n').onclick = () => form();
    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b || b.id === 'n')
        return;
      const g = k => db.get('temas', b.dataset[k]);
      if (b.dataset.v)
        ver(g('v'));
      else if (b.dataset.e)
        form(g('e'));
      else if (b.dataset.p)
        agregar(g('p'), 'Pines');
      else if (b.dataset.s)
        agregar(g('s'), 'Stickers');
      else if (b.dataset.d) {
        const t = g('d'), n = de(t).length;
        if (n)
          return ui.toast(`No se puede eliminar "${t.nombre}": tiene ${n} producto(s). Cámbiales la temática primero`);
        ui.confirm(`¿Eliminar el tema "${t.nombre}"?`).then(ok => {
          if (ok) {
            const copia = JSON.stringify(db.crudo());
            db.remove('temas', t.id);
            CC.router.show();
            ui.deshacer('Tema eliminado.', copia);
          }
        });
      }
    };
  });
})();
