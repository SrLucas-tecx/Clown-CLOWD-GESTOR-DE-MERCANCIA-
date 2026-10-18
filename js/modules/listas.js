// Lista de precios para compartir (PDF o imagen con el logo) y etiquetas de precio para imprimir.
(() => {
  const { db, ui } = CC, E = ui.esc, $ = ui.money, norm = s => String(s || '').trim().toLowerCase();
  const cabecera = t => `<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid #e3363d;padding-bottom:12px"><img src="${CC.logos.nube}" style="height:84px"><div style="text-align:right"><div style="font-size:24px;font-weight:800;color:#1a2f61">${t}</div><div style="font-size:12px;color:#555">${ui.hoy()}</div></div></div>`;
  const filtrar = o => db.all('variantes').filter(v => (!o.cat || norm((db.get('productos', v.productoId) || {}).categoria) === o.cat) && (!o.soloStock || CC.stock(v.id) > 0));
  function lista(o) {
    const vs = filtrar(o), ok = vs.filter(v => v.precio > 0), g = {}; ok.forEach(v => { const c = (db.get('productos', v.productoId) || {}).categoria || 'Sin categoría'; (g[c] = g[c] || []).push(v); });
    const combos = o.cat ? [] : db.all('combos'), td = 'padding:7px 6px;border-bottom:1px solid #e5e8f0;font-size:13px;';
    const disp = v => { const s = CC.stock(v.id); return o.disp === 'cant' ? (s > 0 ? s + ' pzs' : 'Agotado') : o.disp === 'si' ? (s > 0 ? 'Disponible' : 'Agotado') : ''; };
    const html = `<div style="font-family:Arial,sans-serif;color:#1c2540;padding:28px;background:#fff">${cabecera('LISTA DE PRECIOS')}` +
      Object.keys(g).sort().map(c => `<h3 style="color:#1a2f61;border-bottom:2px solid #ffc933;margin:18px 0 6px;font-size:15px">${E(c)}</h3><table style="width:100%;border-collapse:collapse">${g[c].map(v => `<tr><td style="${td}">${E(CC.nombreVar(v))}${v.escCant > 1 ? `<br><span style="font-size:11px;color:#e3363d">${v.escCant} por ${$(v.escTotal)}</span>` : ''}</td><td style="${td}text-align:center;color:#777">${disp(v)}</td><td style="${td}text-align:right;font-weight:800">${$(v.precio)}</td></tr>`).join('')}</table>`).join('') +
      (combos.length ? `<h3 style="color:#1a2f61;border-bottom:2px solid #ffc933;margin:18px 0 6px;font-size:15px">🎁 Combos</h3><table style="width:100%;border-collapse:collapse">${combos.map(c => `<tr><td style="${td}">${E(c.nombre)}<br><span style="font-size:11px;color:#777">${c.items.map(i => i.cant + '× ' + E(CC.nombreVar(db.get('variantes', i.varianteId) || {}))).join(' + ')}</span></td><td style="${td}text-align:right;font-weight:800">${$(c.precio)}</td></tr>`).join('')}</table>` : '') +
      `<div style="margin-top:22px;text-align:center;font-size:12px;color:#777">Precios sujetos a cambio · Clown Cloud</div></div>`;
    return { html, n: ok.length + combos.length, omit: vs.length - ok.length };
  }
  function etiquetas(o, k) {
    const vs = filtrar(o).filter(v => v.precio > 0), lbl = v => `<div class="lbl" style="width:33.33%;box-sizing:border-box;padding:4px;display:inline-block;vertical-align:top"><div style="border:1px dashed #999;border-radius:8px;padding:10px;height:112px;text-align:center"><div style="font-weight:800;font-size:13px;color:#1a2f61">${E((db.get('productos', v.productoId) || {}).producto || '')}</div><div style="font-size:11px;color:#555">${E(v.nombre || '')}</div><div style="font-size:26px;font-weight:800;color:#e3363d;margin-top:6px">${$(v.precio)}</div><div style="font-size:9px;color:#999">${E(v.sku || '')}</div></div></div>`;
    return { html: `<div style="font-family:Arial,sans-serif;padding:14px;background:#fff;font-size:0">${vs.map(v => Array(k).fill(lbl(v)).join('')).join('')}</div>`, n: vs.length, omit: filtrar(o).length - vs.length };
  }
  CC.router.register('lista', 'Lista de precios', '🏷️', el => {
    const cats = CC.categorias.lista();
    el.innerHTML = `<div class="card"><h3>Catálogo para compartir</h3><p class="mute">Genera la lista con tu logo para mandarla por WhatsApp, o las etiquetas de precio para imprimir.</p>
      <div class="grid3"><label>Categoría<select class="inp" id="c"><option value="">Todas</option>${cats.map(c => `<option value="${E(norm(c.nombre))}">${E(c.nombre)}</option>`).join('')}</select></label>
      <label>Disponibilidad<select class="inp" id="d"><option value="">No mostrar</option><option value="si">Disponible / Agotado</option><option value="cant">Cantidad en stock</option></select></label>
      <label>Etiquetas por producto<input class="inp" id="k" type="number" min="1" max="12" value="1"></label></div>
      <label style="display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0"><input type="checkbox" id="s" checked> Solo productos con stock</label>
      <div class="bar"><button class="btn" id="pdf">📄 Lista en PDF</button><button class="btn ghost" id="img">🖼️ Lista como imagen</button><button class="btn ghost" id="et">🏷️ Etiquetas (PDF)</button></div></div>`;
    const o = () => ({ cat: el.querySelector('#c').value, soloStock: el.querySelector('#s').checked, disp: el.querySelector('#d').value }), q = s => el.querySelector(s);
    const hacer = (imagen, etq) => { const op = o(), k = Math.floor(+q('#k').value);
      if (etq && !(k >= 1 && k <= 12)) return ui.toast('No se puede: las etiquetas por producto deben ser de 1 a 12');
      const r = etq ? etiquetas(op, k) : lista(op); if (!r.n) return ui.toast('No hay productos con precio para esos filtros');
      if (r.omit) ui.toast(`Se omitieron ${r.omit} producto(s) sin precio definido`);
      CC.pdf.render(r.html, (etq ? 'etiquetas-' : 'lista-de-precios-') + ui.hoy(), { imagen, ancho: etq ? 780 : 760 }); };
    q('#pdf').onclick = () => hacer(false, false); q('#img').onclick = () => hacer(true, false); q('#et').onclick = () => hacer(false, true);
  });
})();
