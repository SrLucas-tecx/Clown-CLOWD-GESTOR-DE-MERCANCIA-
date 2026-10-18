// PDF y WhatsApp de un pedido (con el logo). Usa html2pdf como LUCXSTUDIO.
CC.pdf = {
  pedido(p) {
    if (!window.html2pdf) return CC.ui.toast('Para generar el PDF necesitas conexión: la librería se carga de internet');
    const { db, ui } = CC, E = ui.esc, $ = ui.money, c = db.get('clientes', p.clienteId) || {}, tot = CC.pedidoTotal(p), ant = p.anticipo || 0, td = 'padding:8px;';
    const el = document.createElement('div'); el.style.cssText = 'position:fixed;top:0;left:-99999px;width:760px;background:#fff';
    el.innerHTML = `<div style="font-family:Arial,sans-serif;color:#1c2540;padding:30px;background:#fff">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid #e3363d;padding-bottom:14px"><img src="${CC.logos.nube}" style="height:96px">
        <div style="text-align:right"><div style="font-size:26px;font-weight:800;color:#1a2f61">PEDIDO ${E(p.folio)}</div><div style="font-size:12px;color:#555;line-height:1.6">Fecha: ${p.fecha}<br>Entrega: ${p.entrega}<br>Estado: ${E(p.estado)}</div></div></div>
      <div style="margin:16px 0;font-size:13px"><b>Cliente:</b> ${E(c.nombre || 'Sin cliente')}${c.contacto ? ' · ' + E(c.contacto) : ''}</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#1a2f61;color:#fff"><th style="${td}text-align:left">Producto</th><th style="${td}">Cant.</th><th style="${td}">Precio</th><th style="${td}text-align:right">Subtotal</th></tr></thead>
        <tbody>${p.items.map(i => `<tr style="border-bottom:1px solid #e5e8f0"><td style="${td}">${E(i.nombre)}</td><td style="${td}text-align:center">${i.cant}</td><td style="${td}text-align:center">${$(i.precio)}</td><td style="${td}text-align:right">${$(i.precio * i.cant)}</td></tr>`).join('')}</tbody></table>
      <table style="margin:16px 0 0 auto;font-size:14px;min-width:270px;border-collapse:collapse"><tr><td style="padding:4px 14px 4px 0;color:#555">Total</td><td style="text-align:right;font-weight:800;color:#1a2f61">${$(tot)}</td></tr>
        <tr><td style="padding:4px 14px 4px 0;color:#555">Anticipo</td><td style="text-align:right">${$(ant)}</td></tr><tr style="background:#ffc933"><td style="padding:8px 14px 8px 8px;font-weight:800">Saldo pendiente</td><td style="text-align:right;padding-right:8px;font-weight:800">${$(Math.max(0, tot - ant))}</td></tr></table>
      ${p.notas ? `<p style="margin-top:16px;font-size:12px;background:#f3f5fb;padding:10px;border-radius:6px"><b>Notas:</b> ${E(p.notas)}</p>` : ''}
      <div style="margin-top:28px;text-align:center;font-size:12px;color:#777;border-top:1px solid #e5e8f0;padding-top:12px">¡Gracias por tu compra! · Clown Cloud</div></div>`;
    document.body.appendChild(el);
    const img = new Image(), go = () => html2pdf().set({ margin: 10, filename: `pedido_${p.folio}.pdf`, image: { type: 'jpeg', quality: .98 }, html2canvas: { scale: 2, backgroundColor: '#fff' }, jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' } }).from(el).save().then(() => { el.remove(); ui.toast('PDF descargado'); }).catch(() => { el.remove(); ui.toast('No se pudo generar el PDF'); });
    img.onload = go; img.onerror = go; img.src = CC.logos.nube;
  },
  whatsapp(p) {
    const { db, ui } = CC, $ = ui.money, c = db.get('clientes', p.clienteId) || {}, tot = CC.pedidoTotal(p), ant = p.anticipo || 0, tel = String(c.contacto || '').replace(/\D/g, '');
    const txt = [`🤡 *Clown Cloud* — Pedido ${p.folio}`, `Cliente: ${c.nombre || '—'}`, `Entrega: ${p.entrega}`, '', ...p.items.map(i => `• ${i.cant} × ${i.nombre} — ${$(i.precio * i.cant)}`), '', `*Total: ${$(tot)}*`, ant ? `Anticipo: ${$(ant)}` : '', `*Saldo pendiente: ${$(Math.max(0, tot - ant))}*`, '', '¡Gracias por tu compra! 🖤'].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
    if (tel.length < 10) ui.toast('Este cliente no tiene teléfono guardado: elige el chat en WhatsApp');
    window.open(`https://wa.me/${tel.length === 10 ? '52' + tel : tel.length > 10 ? tel : ''}?text=${encodeURIComponent(txt)}`, '_blank');
  }
};
// Genera un PDF (o una imagen PNG) a partir de HTML, con el mismo método que el pedido.
CC.pdf.render = (html, nombre, o = {}) => {
  const ui = CC.ui; if (!window.html2pdf) return ui.toast('Para generar el PDF necesitas conexión: la librería se carga de internet');
  const el = document.createElement('div'); el.style.cssText = `position:fixed;top:0;left:-99999px;width:${o.ancho || 760}px;background:#fff`; el.innerHTML = html; document.body.appendChild(el);
  const fin = () => el.remove(), go = () => {
    const w = html2pdf().set({ margin: 10, filename: nombre + '.pdf', image: { type: 'jpeg', quality: .98 }, html2canvas: { scale: 2, backgroundColor: '#fff' }, jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css'], avoid: ['tr', '.lbl'] } }).from(el);
    if (o.imagen) w.toCanvas().get('canvas').then(c => { const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = nombre + '.png'; a.click(); fin(); ui.toast('Imagen descargada'); }).catch(() => { fin(); ui.toast('No se pudo generar la imagen'); });
    else w.save().then(() => { fin(); ui.toast('PDF descargado'); }).catch(() => { fin(); ui.toast('No se pudo generar el PDF'); });
  };
  const img = new Image(); img.onload = img.onerror = go; img.src = CC.logos.nube;
};
