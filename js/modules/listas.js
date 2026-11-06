// Lista de precios para compartir (PDF o imagen con el logo) y etiquetas de precio para imprimir.
//   · Lista: con precio unitario. Si escribes cantidades, se vuelve cotización: solo esas piezas, con subtotales y total.
//   · Etiquetas: para recortar. Puedes elegir solo pines o solo stickers y el tamaño (chicas por defecto).
(() => {
  const {db, ui} = CC, E = ui.esc, $ = ui.money, norm = s => String(s || '').trim().toLowerCase();
  const esPin = c => /^pines?$/i.test(String(c || '').trim()), esSt = c => /stic?ker|stiker/i.test(c || '');
  const categoriaDe = v => (db.get('productos', v.productoId) || {}).categoria;
  const cabecera = t => `<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid #e3363d;padding-bottom:12px"><img src="${CC.logos.nube}" style="height:84px"><div style="text-align:right"><div style="font-size:24px;font-weight:800;color:#1a2f61">${t}</div><div style="font-size:12px;color:#555">${ui.hoy()}</div></div></div>`;
  let cant = {}; // variante → piezas para cotizar

  const filtrar = o => db.all('variantes').filter(v =>
    (!o.cat || norm(categoriaDe(v)) === o.cat) &&
    (!o.soloStock || CC.stock(v.id) > 0) &&
    (!o.tipo || (o.tipo === 'pines' ? esPin(categoriaDe(v)) : esSt(categoriaDe(v)))));

  // Cotización: lo que tenga cantidad (con el precio por cantidad, «3 por $90», ya aplicado).
  const lineasCotizadas = ok => ok.filter(v => (cant[v.id] || 0) > 0).map(v => ({v, n: cant[v.id], total: CC.linea(v, cant[v.id])}));

  function lista(o) {
    const vs = filtrar(o), ok = vs.filter(v => v.precio > 0), cot = lineasCotizadas(ok), cotiza = cot.length > 0;
    const base = cotiza ? cot.map(x => x.v) : ok, g = {};
    base.forEach(v => {
      const c = (db.get('productos', v.productoId) || {}).categoria || 'Sin categoría';
      (g[c] = g[c] || []).push(v);
    });
    const combos = o.cat || cotiza || o.tipo ? [] : db.all('combos'), td = 'padding:7px 6px;border-bottom:1px solid #e5e8f0;font-size:13px;';
    const disp = v => {
      const s = CC.stock(v.id);
      return o.disp === 'cant' ? s > 0 ? s + ' pzs' : 'Agotado' : o.disp === 'si' ? s > 0 ? 'Disponible' : 'Agotado' : '';
    };
    const escala = v => v.escCant > 1 ? `<br><span style="font-size:11px;color:#e3363d">${v.escCant} por ${$(v.escTotal)}</span>` : '';
    const fila = v => cotiza
      ? `<tr><td style="${td}">${E(CC.nombreVar(v))}${escala(v)}</td><td style="${td}text-align:right">${$(v.precio)}</td><td style="${td}text-align:center">${cant[v.id]}</td><td style="${td}text-align:right;font-weight:800">${$(CC.linea(v, cant[v.id]))}</td></tr>`
      : `<tr><td style="${td}">${E(CC.nombreVar(v))}${escala(v)}</td><td style="${td}text-align:center;color:#777">${disp(v)}</td><td style="${td}text-align:right;font-weight:800">${$(v.precio)}</td></tr>`;
    const encabezado = cotiza ? `<tr style="color:#777;font-size:11px"><td style="padding:2px 6px">PRODUCTO</td><td style="padding:2px 6px;text-align:right">PRECIO UNIT.</td><td style="padding:2px 6px;text-align:center">CANT.</td><td style="padding:2px 6px;text-align:right">TOTAL</td></tr>` : '';
    const total = cot.reduce((s, x) => s + x.total, 0), piezas = cot.reduce((s, x) => s + x.n, 0);
    const html = `<div style="font-family:Arial,sans-serif;color:#1c2540;padding:28px;background:#fff">${cabecera(cotiza ? 'COTIZACIÓN' : 'LISTA DE PRECIOS')}` + Object.keys(g).sort().map(c => `<h3 style="color:#1a2f61;border-bottom:2px solid #ffc933;margin:18px 0 6px;font-size:15px">${E(c)}</h3><table style="width:100%;border-collapse:collapse">${encabezado}${g[c].map(fila).join('')}</table>`).join('')
      + (cotiza ? `<table style="width:100%;border-collapse:collapse;margin-top:14px"><tr style="background:#ffc933"><td style="padding:10px 8px;font-weight:800">Total · ${piezas} pieza(s)</td><td style="padding:10px 8px;text-align:right;font-weight:800;font-size:16px">${$(total)}</td></tr></table>` : '')
      + (combos.length ? `<h3 style="color:#1a2f61;border-bottom:2px solid #ffc933;margin:18px 0 6px;font-size:15px">🎁 Combos</h3><table style="width:100%;border-collapse:collapse">${combos.map(c => `<tr><td style="${td}">${E(c.nombre)}<br><span style="font-size:11px;color:#777">${c.items.map(i => i.cant + '× ' + E(CC.nombreVar(db.get('variantes', i.varianteId) || {}))).join(' + ')}</span></td><td style="${td}text-align:right;font-weight:800">${$(c.precio)}</td></tr>`).join('')}</table>` : '')
      + `<div style="margin-top:22px;text-align:center;font-size:12px;color:#777">Precios sujetos a cambio · Clown Cloud</div></div>`;
    return {html, n: base.length + combos.length, omit: vs.length - ok.length};
  }

  // Tamaños de etiqueta: [columnas, alto, letra del nombre, letra del precio]
  const TAMANOS = {ch: [5, 74, 10, 17], me: [4, 90, 11, 21], gr: [3, 112, 13, 26]};
  function etiquetas(o, k, tam) {
    const [cols, alto, fn, fp] = TAMANOS[tam] || TAMANOS.me;
    const vs = filtrar(o).filter(v => v.precio > 0), lbl = v => `<div class="lbl" style="width:${100 / cols}%;box-sizing:border-box;padding:3px;display:inline-block;vertical-align:top"><div style="border:1px dashed #999;border-radius:8px;padding:6px;height:${alto}px;text-align:center;overflow:hidden"><div style="font-weight:800;font-size:${fn}px;color:#1a2f61">${E((db.get('productos', v.productoId) || {}).producto || '')}</div><div style="font-size:${fn - 1}px;color:#555">${E(v.nombre || '')}</div><div style="font-size:${fp}px;font-weight:800;color:#e3363d;margin-top:3px">${$(v.precio)}</div><div style="font-size:8px;color:#999">${E(v.sku || '')}</div></div></div>`;
    return {
      html: `<div style="font-family:Arial,sans-serif;padding:14px;background:#fff;font-size:0">${vs.map(v => Array(k).fill(lbl(v)).join('')).join('')}</div>`,
      n: vs.length,
      omit: filtrar(o).length - vs.length
    };
  }

  CC.router.register('lista', 'Lista de precios', '🏷️', el => {
    const cats = CC.categorias.lista();
    el.innerHTML = `
      <div class="card"><h3>Catálogo para compartir</h3>
        <p class="mute">Genera la lista con tu logo para mandarla por WhatsApp. Si escribes cantidades abajo, se convierte en una cotización con totales.</p>
        <div class="grid3">
          <label>Categoría<select class="inp" id="c"><option value="">Todas</option>${cats.map(c => `<option value="${E(norm(c.nombre))}">${E(c.nombre)}</option>`).join('')}</select></label>
          <label>Disponibilidad<select class="inp" id="d"><option value="">No mostrar</option><option value="si">Disponible / Agotado</option><option value="cant">Cantidad en stock</option></select></label>
          <label style="display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0;margin-top:22px"><input type="checkbox" id="s" checked> Solo productos con stock</label>
        </div>
      </div>

      <div class="card">
        <div class="bar" style="margin-bottom:6px"><h3 style="margin:0;flex:1">Productos</h3>
          <button class="btn ghost sm" id="limpiar">Limpiar cantidades</button></div>
        <table class="tabla-resp"><thead><tr><th>Producto</th><th>Stock</th><th>Precio unitario</th><th>Cantidad ✎</th><th class="end">Total</th></tr></thead><tbody id="tb"></tbody></table>
        <div class="bar" style="margin:10px 0 0"><div style="flex:1" id="tt" class="mute"></div>
          <button class="btn" id="pdf">📄 Lista en PDF</button><button class="btn ghost" id="img">🖼️ Lista como imagen</button></div>
      </div>

      <div class="card"><h3>Etiquetas de precio para recortar</h3>
        <div class="grid3">
          <label>Mostrar<select class="inp" id="tp"><option value="">Pines y stickers (todo)</option><option value="pines">Solo pines</option><option value="stickers">Solo stickers</option></select></label>
          <label>Tamaño<select class="inp" id="tm"><option value="ch">Chicas (5 por fila)</option><option value="me" selected>Medianas (4 por fila)</option><option value="gr">Grandes (3 por fila)</option></select></label>
          <label>Etiquetas por producto<input class="inp" id="k" type="number" min="1" max="12" value="1"></label>
        </div>
        <div class="bar"><button class="btn ghost" id="et">🏷️ Etiquetas (PDF)</button><span class="mute">Usa los mismos filtros de categoría y stock de arriba.</span></div>
      </div>`;

    const q = s => el.querySelector(s);
    const o = () => ({cat: q('#c').value, soloStock: q('#s').checked, disp: q('#d').value, tipo: q('#tp').value});

    // Tabla de productos con cantidad editable y totales en vivo.
    const totales = () => {
      const cot = lineasCotizadas(filtrar(o()).filter(v => v.precio > 0));
      cot.forEach(x => { const c = q('#t-' + x.v.id); if (c) c.textContent = $(x.total); });
      q('#tt').innerHTML = cot.length ? `Cotización: <b>${cot.reduce((s, x) => s + x.n, 0)}</b> pieza(s) · Total <b style="font-size:1.1rem">${$(cot.reduce((s, x) => s + x.total, 0))}</b>` : 'Sin cantidades: se genera la lista de precios normal.';
    };
    const pintarTabla = () => {
      const vs = filtrar(o()).filter(v => v.precio > 0);
      q('#tb').innerHTML = vs.map(v => `<tr>
        <td data-l="Producto"><b>${E(CC.nombreVar(v))}</b></td><td data-l="Stock">${Math.max(0, CC.stock(v.id))}</td>
        <td data-l="Precio">${$(v.precio)}${v.escCant > 1 ? ` <span class="mute">(${v.escCant} por ${$(v.escTotal)})</span>` : ''}</td>
        <td data-l="Cantidad"><input class="inp ed ct" data-v="${v.id}" type="number" min="0" step="1" value="${cant[v.id] || ''}" placeholder="0"></td>
        <td data-l="Total" class="end" id="t-${v.id}">${cant[v.id] ? $(CC.linea(v, cant[v.id])) : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="mute">No hay productos con precio para esos filtros.</td></tr>';
      totales();
    };
    pintarTabla();

    el.oninput = e => {
      if (!e.target.classList.contains('ct')) return;
      const n = Math.floor(+e.target.value) || 0;
      if (n > 0) cant[e.target.dataset.v] = n; else delete cant[e.target.dataset.v];
      const v = db.get('variantes', e.target.dataset.v), c = q('#t-' + v.id);
      if (c) c.textContent = n ? $(CC.linea(v, n)) : '—';
      totales();
    };
    el.onchange = e => { if (['c', 'd', 's'].includes(e.target.id)) pintarTabla(); };
    q('#limpiar').onclick = () => { cant = {}; pintarTabla(); };

    const hacer = (imagen, etq) => {
      const op = o(), k = Math.floor(+q('#k').value);
      if (etq && !(k >= 1 && k <= 12))
        return ui.toast('No se puede: las etiquetas por producto deben ser de 1 a 12');
      const r = etq ? etiquetas(op, k, q('#tm').value) : lista(op);
      if (!r.n)
        return ui.toast('No hay productos con precio para esos filtros');
      if (r.omit)
        ui.toast(`Se omitieron ${r.omit} producto(s) sin precio definido`);
      CC.pdf.render(r.html, (etq ? 'etiquetas-' : 'lista-de-precios-') + ui.hoy(), {
        imagen,
        ancho: etq ? 780 : 760
      });
    };
    q('#pdf').onclick = () => hacer(false, false);
    q('#img').onclick = () => hacer(true, false);
    q('#et').onclick = () => hacer(false, true);
  });
})();
