// Venta rápida táctil POR TEMAS: eliges un tema, ves sus Pines y Stickers por tipo (mini, estándar, gigante…)
// y vendes por cantidades, sin escribir el nombre de cada diseño. Al cobrar, las piezas se descuentan solas
// de los diseños de ese tema y tipo. El precio y el costo se congelan en cada venta; anular regresa el stock.
// El historial de ventas vive en su propia pestaña (historial.js).
(() => {
  const {db, ui} = CC;
  const E = ui.esc, $ = ui.money;
  const norm = s => String(s || '').trim().toLowerCase();
  const esPin = categoria => /^pines?$/i.test(String(categoria || '').trim());
  const esSticker = categoria => /stic?ker|stiker/i.test(categoria || '');

  // Estado de la pantalla (se conserva al cambiar de pestaña)
  let carrito = {};      // clave del grupo → cantidad
  let temaSel = 'todos'; // 'todos' o nombre de un tema
  let busqueda = '';

  CC.ventasOk = () => db.all('ventas').filter(v => !v.anulada);
  CC.utilidad = vs => vs.reduce((s, v) => s + v.items.reduce((a, i) => a + (i.precio - i.costo) * i.cant, 0), 0);

  // Anula una venta (con confirmación y «Deshacer»): las piezas regresan al inventario.
  CC.anularVenta = (id, despues) => {
    const venta = db.get('ventas', id);
    if (!venta || venta.anulada) return;
    ui.confirm('Las piezas de esta venta regresarán al inventario y dejará de contar en los totales.', 'Anular venta').then(ok => {
      if (!ok) return;
      const copia = JSON.stringify(db.crudo());
      db.update('ventas', venta.id, {anulada: true});
      venta.items.forEach(i => CC.mover(i.varianteId, i.cant, 'anulación', 'Venta anulada', venta.id));
      if (despues) despues(); else CC.router.show();
      ui.deshacer('Venta anulada.', copia);
    });
  };

  // ---------------------------------------------------------------------------------------------
  // Grupos: tema + sección (Pines / Stickers / otras) + tipo. Es lo que se vende por cantidades.
  // ---------------------------------------------------------------------------------------------
  function construirGrupos() {
    const mapa = new Map();
    db.all('variantes').forEach(v => {
      const p = db.get('productos', v.productoId);
      if (!p || p.eliminado) return;
      const tema = (p.coleccion || '').trim() || 'Sin tema';
      const seccion = esPin(p.categoria) ? 'Pines' : esSticker(p.categoria) ? 'Stickers' : ((p.categoria || '').trim() || 'Otros');
      const tipoObj = v.tipoId ? db.get('tipos', v.tipoId) : null;
      const tipo = tipoObj && !tipoObj.eliminado ? tipoObj.nombre : ((v.nombre || '').trim() || 'Único');
      const clave = [norm(tema), norm(seccion), norm(tipo)].join('|');
      const g = mapa.get(clave) || {clave, tema, seccion, tipo, variantes: [], disenos: [], stock: 0};
      g.variantes.push(v);
      g.disenos.push(p.producto);
      g.stock += Math.max(0, CC.stock(v.id));
      mapa.set(clave, g);
    });
    // Variante que fija el precio del grupo: la de más stock que tenga precio.
    mapa.forEach(g => {
      const conPrecio = g.variantes.filter(v => v.precio > 0).sort((a, b) => CC.stock(b.id) - CC.stock(a.id));
      g.rep = conPrecio[0] || g.variantes[0];
      g.precio = g.rep.precio || 0;
    });
    return [...mapa.values()];
  }

  const total = (g, n) => CC.linea(g.rep, n); // respeta el precio por cantidad («3 por $90»)

  // Reparte una venta de n piezas entre los diseños del grupo (primero los más antiguos).
  function repartir(g, n) {
    let falta = n;
    const partes = [];
    g.variantes.slice().sort((a, b) => String(a.creado).localeCompare(String(b.creado))).forEach(v => {
      const toma = Math.min(falta, Math.max(0, CC.stock(v.id)));
      if (toma > 0) { partes.push({v, cant: toma}); falta -= toma; }
    });
    return partes;
  }

  const icono = seccion => seccion === 'Pines' ? '📍' : seccion === 'Stickers' ? '🖼️' : '📦';

  // ---------------------------------------------------------------------------------------------
  // Pantalla
  // ---------------------------------------------------------------------------------------------
  CC.router.register('ventas', 'Venta', '🛒', el => {
    const eventos = db.all('eventos');
    const grupos = construirGrupos();
    const temas = [...new Set(grupos.map(g => g.tema))].sort((a, b) => a === 'Sin tema' ? 1 : b === 'Sin tema' ? -1 : a.localeCompare(b, 'es'));
    if (temaSel !== 'todos' && !temas.includes(temaSel)) temaSel = 'todos';
    // Si el stock cambió, el carrito no puede pasarse de lo que hay.
    Object.keys(carrito).forEach(k => { const g = grupos.find(x => x.clave === k); if (!g || g.stock <= 0) delete carrito[k]; else carrito[k] = Math.min(carrito[k], g.stock); });

    el.innerHTML = `
      <div class="pos">
        <section>
          <input class="inp" id="q" placeholder="Buscar tema, tipo o diseño…" value="${E(busqueda)}">
          <div class="tabs" id="temas" style="margin:8px 0"></div>
          <div id="catalogo"></div>
        </section>
        <div class="card"><h3>Venta actual</h3><div id="cart"></div><div class="tot"><span>Total</span><b id="tot"></b></div>
          <label>Pago<select class="inp" id="pay"><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option></select></label>
          <label>Bazar / evento<select class="inp" id="ev"><option value="">Sin evento</option>${eventos.map(e => `<option value="${e.id}">${E(e.nombre)}</option>`).join('')}</select></label>
          <label>Cliente (opcional)<select class="inp" id="cl"><option value="">Sin cliente</option>${db.all('clientes').map(c => `<option value="${c.id}">${E(c.nombre)}</option>`).join('')}</select></label>
          <button class="btn ghost sm" id="nc" type="button">＋ Cliente nuevo</button>
          <button class="btn big" id="ok">Cobrar</button></div>
      </div>
      <div class="bar"><button class="btn ghost" id="hv" type="button">📜 Ver historial de ventas</button></div>`;
    const q = s => el.querySelector(s);

    // Tiles de un tipo: toca el recuadro para sumar 1, o usa − y +.
    const tile = g => {
      const n = carrito[g.clave] || 0, agotado = g.stock <= 0;
      return `
        <div class="tile ${n ? 'on' : ''}" data-k="${E(g.clave)}" style="text-align:left;cursor:${agotado ? 'not-allowed' : 'pointer'};${agotado ? 'opacity:.45' : ''}">
          <b>${E(g.tipo)}</b>
          <div class="mute">${g.precio ? $(g.precio) : '<span class="warn">Sin precio</span>'} · ${agotado ? 'agotado' : 'quedan ' + g.stock}</div>
          ${g.rep.escCant > 1 && g.rep.escTotal ? `<div class="mute" style="font-size:.75rem">${g.rep.escCant} por ${$(g.rep.escTotal)}</div>` : ''}
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
            <button class="btn ghost sm" data-a="menos" data-k="${E(g.clave)}" ${n ? '' : 'disabled'}>−</button>
            <b style="font:800 1.5rem var(--font-display);min-width:28px;text-align:center">${n}</b>
            <button class="btn sm" data-a="mas" data-k="${E(g.clave)}" ${agotado ? 'disabled' : ''}>+</button>
          </div>
        </div>`;
    };

    const pintarTemas = () => {
      const cuenta = t => grupos.filter(g => g.tema === t).reduce((s, g) => s + g.stock, 0);
      q('#temas').innerHTML = [['todos', 'Todos']].concat(temas.map(t => [t, t])).map(([valor, texto]) =>
        `<button class="tab ${temaSel === valor ? 'on' : ''}" data-tema="${E(valor)}">${valor === 'todos' ? '🗂️ Todos' : E(texto)} <small>(${valor === 'todos' ? grupos.reduce((s, g) => s + g.stock, 0) : cuenta(valor)})</small></button>`).join('');
    };

    const pintarCatalogo = () => {
      const texto = norm(busqueda);
      const visibles = grupos.filter(g => (temaSel === 'todos' || g.tema === temaSel) && (!texto || norm(g.tema + ' ' + g.tipo + ' ' + g.seccion + ' ' + g.disenos.join(' ')).includes(texto)));
      const temasVisibles = temas.filter(t => visibles.some(g => g.tema === t));
      q('#catalogo').innerHTML = temasVisibles.map(t => {
        const delTema = visibles.filter(g => g.tema === t);
        // Primero Pines, luego Stickers y después las demás categorías.
        const peso = sec => sec === 'Pines' ? 0 : sec === 'Stickers' ? 1 : 2;
        const secciones = [...new Set(delTema.map(g => g.seccion))].sort((a, b) => peso(a) - peso(b) || a.localeCompare(b, 'es'));
        return `
          <div class="card" style="margin-bottom:10px">
            <h3 style="margin:0 0 6px">🗂️ ${E(t)} <small class="mute">· ${delTema.reduce((s, g) => s + g.stock, 0)} pzs</small></h3>
            ${secciones.map(sec => `
              <div class="mute" style="margin:8px 0 4px"><b>${icono(sec)} ${E(sec)}</b></div>
              <div class="tiles">${delTema.filter(g => g.seccion === sec).map(tile).join('')}</div>`).join('')}
          </div>`;
      }).join('') || '<p class="mute">No hay productos que coincidan. Agrega piezas en Inventario → Agregar varios.</p>';
    };

    const pintarCarrito = () => {
      const claves = Object.keys(carrito).filter(k => carrito[k] > 0);
      let suma = 0;
      q('#cart').innerHTML = claves.map(k => {
        const g = grupos.find(x => x.clave === k), n = carrito[k], t = total(g, n);
        suma += t;
        return `<div class="line"><span>${icono(g.seccion)} ${E(g.tema)} · ${E(g.tipo)}</span>
          <span><button class="btn ghost sm" data-a="menos" data-k="${E(k)}">−</button> <b>${n}</b> <button class="btn sm" data-a="mas" data-k="${E(k)}">+</button> ${$(t)}</span></div>`;
      }).join('') || '<p class="mute">Toca un tipo para agregarlo a la venta.</p>';
      q('#tot').textContent = $(suma);
    };

    const pintarTodo = () => { pintarTemas(); pintarCatalogo(); pintarCarrito(); };
    pintarTodo();

    // Suma o resta piezas de un grupo (sin pasarse del stock).
    const cambiar = (clave, delta) => {
      const g = grupos.find(x => x.clave === clave);
      if (!g) return;
      const actual = carrito[clave] || 0, nuevo = actual + delta;
      if (delta > 0 && !g.precio) return ui.toast(`"${g.tema} · ${g.tipo}" no tiene precio: defínelo en Catálogo o Tipos de producto`);
      if (delta > 0 && nuevo > g.stock) return ui.toast(`No hay más "${g.tema} · ${g.tipo}": quedan ${g.stock}`);
      if (nuevo <= 0) delete carrito[clave]; else carrito[clave] = nuevo;
      pintarCatalogo();
      pintarCarrito();
    };

    q('#q').oninput = e => { busqueda = e.target.value; pintarCatalogo(); };
    el.onclick = e => {
      const tema = e.target.closest('[data-tema]');
      if (tema) { temaSel = tema.dataset.tema; return pintarTodo(); }
      const boton = e.target.closest('button[data-a]');
      if (boton) return cambiar(boton.dataset.k, boton.dataset.a === 'mas' ? 1 : -1);
      const recuadro = e.target.closest('.tile');
      if (recuadro) cambiar(recuadro.dataset.k, 1);
    };

    q('#nc').onclick = () => CC.clienteForm();
    q('#hv').onclick = () => { location.hash = 'historial'; };

    q('#ok').onclick = () => {
      const claves = Object.keys(carrito).filter(k => carrito[k] > 0);
      if (!claves.length) return ui.toast('La venta está vacía');
      const items = [];
      for (const k of claves) {
        const g = grupos.find(x => x.clave === k), n = carrito[k];
        if (!g || n > g.stock) return ui.toast(`No se puede cobrar: "${g ? g.tema + ' · ' + g.tipo : 'un producto'}" ya no tiene stock suficiente`);
        const precioUnitario = total(g, n) / n;
        repartir(g, n).forEach(({v, cant}) => items.push({varianteId: v.id, nombre: `${g.tema} · ${g.tipo}`, cant, precio: precioUnitario, costo: v.costo || 0}));
      }
      const totalVenta = items.reduce((s, i) => s + i.precio * i.cant, 0), pago = q('#pay').value;
      const venta = db.add('ventas', {items, total: totalVenta, pago, eventoId: q('#ev').value, clienteId: q('#cl').value, fecha: ui.hoy()});
      if (pago === 'Tarjeta') db.update('ventas', venta.id, {comision: totalVenta * ui.cfg.comision() / 100});
      items.forEach(i => CC.mover(i.varianteId, -i.cant, 'venta', '', venta.id));
      carrito = {};
      ui.toast('Venta registrada');
      CC.router.show();
    };
  });
})();