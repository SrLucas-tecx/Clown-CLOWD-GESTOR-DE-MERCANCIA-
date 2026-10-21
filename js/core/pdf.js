// PDF y WhatsApp de un pedido (con el logo). Usa html2pdf (se carga de internet desde index.html).
CC.pdf = {

  // Genera el PDF de un pedido y lo descarga.
  pedido(pedido) {
    CC.pdf.render(CC.pdf.htmlPedido(pedido), `pedido_${pedido.folio}`);
  },

  // HTML (con estilos en línea) del comprobante de un pedido.
  htmlPedido(p) {
    const {db, ui} = CC, E = ui.esc, $ = ui.money;
    const cliente = db.get('clientes', p.clienteId) || {};
    const total = CC.pedidoTotal(p), anticipo = p.anticipo || 0;
    const td = 'padding:8px;';

    const filas = p.items.map(i => `
      <tr style="border-bottom:1px solid #e5e8f0">
        <td style="${td}">${E(i.nombre)}</td>
        <td style="${td}text-align:center">${i.cant}</td>
        <td style="${td}text-align:center">${$(i.precio)}</td>
        <td style="${td}text-align:right">${$(i.precio * i.cant)}</td>
      </tr>`).join('');

    return `
      <div style="font-family:Arial,sans-serif;color:#1c2540;padding:30px;background:#fff">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid #e3363d;padding-bottom:14px">
          <img src="${CC.logos.nube}" style="height:96px">
          <div style="text-align:right">
            <div style="font-size:26px;font-weight:800;color:#1a2f61">PEDIDO ${E(p.folio)}</div>
            <div style="font-size:12px;color:#555;line-height:1.6">Fecha: ${p.fecha}<br>Entrega: ${p.entrega}<br>Estado: ${E(p.estado)}</div>
          </div>
        </div>

        <div style="margin:16px 0;font-size:13px">
          <b>Cliente:</b> ${E(cliente.nombre || 'Sin cliente')}${cliente.contacto ? ' · ' + E(cliente.contacto) : ''}
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#1a2f61;color:#fff">
              <th style="${td}text-align:left">Producto</th>
              <th style="${td}">Cant.</th>
              <th style="${td}">Precio</th>
              <th style="${td}text-align:right">Subtotal</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>

        <table style="margin:16px 0 0 auto;font-size:14px;min-width:270px;border-collapse:collapse">
          <tr><td style="padding:4px 14px 4px 0;color:#555">Total</td><td style="text-align:right;font-weight:800;color:#1a2f61">${$(total)}</td></tr>
          <tr><td style="padding:4px 14px 4px 0;color:#555">Anticipo</td><td style="text-align:right">${$(anticipo)}</td></tr>
          <tr style="background:#ffc933">
            <td style="padding:8px 14px 8px 8px;font-weight:800">Saldo pendiente</td>
            <td style="text-align:right;padding-right:8px;font-weight:800">${$(Math.max(0, total - anticipo))}</td>
          </tr>
        </table>

        ${p.notas ? `<p style="margin-top:16px;font-size:12px;background:#f3f5fb;padding:10px;border-radius:6px"><b>Notas:</b> ${E(p.notas)}</p>` : ''}

        <div style="margin-top:28px;text-align:center;font-size:12px;color:#777;border-top:1px solid #e5e8f0;padding-top:12px">
          ¡Gracias por tu compra! · Clown Cloud
        </div>
      </div>`;
  },

  // Abre WhatsApp con el resumen del pedido.
  whatsapp(p) {
    const {db, ui} = CC, $ = ui.money;
    const cliente = db.get('clientes', p.clienteId) || {};
    const total = CC.pedidoTotal(p), anticipo = p.anticipo || 0;
    const tel = String(cliente.contacto || '').replace(/\D/g, '');

    const texto = [
      `🤡 *Clown Cloud* — Pedido ${p.folio}`,
      `Cliente: ${cliente.nombre || '—'}`,
      `Entrega: ${p.entrega}`,
      '',
      ...p.items.map(i => `• ${i.cant} × ${i.nombre} — ${$(i.precio * i.cant)}`),
      '',
      `*Total: ${$(total)}*`,
      anticipo ? `Anticipo: ${$(anticipo)}` : '',
      `*Saldo pendiente: ${$(Math.max(0, total - anticipo))}*`,
      '',
      '¡Gracias por tu compra! 🖤'
    ].filter((linea, i, todas) => linea !== '' || todas[i - 1] !== '').join('\n');

    if (tel.length < 10) ui.toast('Este cliente no tiene teléfono guardado: elige el chat en WhatsApp');

    // 10 dígitos = número de México (se antepone 52); más de 10 ya trae lada de país.
    const numero = tel.length === 10 ? '52' + tel : tel.length > 10 ? tel : '';
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank');
  }
};

/**
 * Convierte HTML en PDF (o en imagen PNG si opciones.imagen es true) y lo descarga.
 *
 * Por qué se hace así (html2pdf usa html2canvas por debajo):
 *  - html2canvas NO entiende las funciones de color modernas (color-mix, color(srgb ...)) que usan
 *    los estilos de la app y falla con "unsupported color function". Por eso, mientras se genera
 *    el PDF, se desactivan temporalmente las hojas de estilo de la página y se tapa la pantalla
 *    con un aviso "Generando…" (el comprobante usa solo estilos en línea, no las necesita).
 *  - html2pdf clona el elemento y mide su ancho: debe estar dentro del documento, y no puede
 *    llevar `left:-99999px` ni `opacity:0` (el clon heredaría el estilo y saldría en blanco).
 *    Se oculta con un contenedor.
 */
CC.pdf.render = (html, nombre, opciones = {}) => {
  const ui = CC.ui;
  if (!window.html2pdf) {
    return ui.toast('Para generar el PDF necesitas conexión: la librería se carga de internet');
  }

  const ancho = opciones.ancho || 760;

  // 1) Tapa la pantalla (con estilos en línea, porque las hojas se van a desactivar).
  const aviso = document.createElement('div');
  aviso.textContent = 'Generando…';
  aviso.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;' +
    'justify-content:center;background:#0b1226;color:#fff;font:600 18px Arial,sans-serif';
  document.body.appendChild(aviso);

  // 2) Desactiva las hojas de estilo de la app (se restauran en terminar()).
  const hojas = [...document.styleSheets];
  hojas.forEach(hoja => { hoja.disabled = true; });

  // 3) Contenedor invisible que sostiene el elemento a convertir.
  const oculto = document.createElement('div');
  oculto.style.cssText = 'position:fixed;top:0;left:0;z-index:-1000;opacity:0;pointer-events:none';

  const el = document.createElement('div');
  el.style.cssText = `width:${ancho}px;background:#fff;color:#1c2540`;
  el.innerHTML = html;

  oculto.appendChild(el);
  document.body.appendChild(oculto);

  // Deja todo como estaba y avisa el resultado.
  const terminar = (mensaje) => {
    oculto.remove();
    aviso.remove();
    hojas.forEach(hoja => { hoja.disabled = false; });
    ui.toast(mensaje);
  };
  const fallar = (tipo) => (error) => {
    console.error('Error al generar ' + tipo + ':', error);
    terminar(`No se pudo generar ${tipo}: ${(error && error.message) || error}`);
  };

  // Respaldo: en la copia que se fotografía también se limpian estilos y colores.
  const limpiarClon = (documento) => {
    documento.querySelectorAll('link[rel="stylesheet"], style').forEach(nodo => nodo.remove());
    documento.documentElement.removeAttribute('style');
    documento.documentElement.style.colorScheme = 'light';
    documento.body.style.cssText = 'margin:0;color:#1c2540;background:#fff';
  };

  const generar = () => {
    try {
      const trabajo = html2pdf().set({
        margin: 10,
        filename: nombre + '.pdf',
        image: {type: 'jpeg', quality: 0.98},
        html2canvas: {
          scale: 2,
          backgroundColor: '#fff',
          useCORS: true,
          scrollX: 0,
          scrollY: 0,
          onclone: limpiarClon
        },
        jsPDF: {unit: 'pt', format: 'a4', orientation: 'portrait'},
        pagebreak: {mode: ['css'], avoid: ['tr', '.lbl']}
      }).from(el);

      if (opciones.imagen) {
        trabajo.toCanvas().get('canvas').then(canvas => {
          const enlace = document.createElement('a');
          enlace.href = canvas.toDataURL('image/png');
          enlace.download = nombre + '.png';
          enlace.click();
          terminar('Imagen descargada');
        }).catch(fallar('la imagen'));
      } else {
        trabajo.save().then(() => terminar('PDF descargado')).catch(fallar('el PDF'));
      }
    } catch (error) {
      fallar('el PDF')(error);
    }
  };

  // Espera a que cargue el logo antes de capturar (aunque falle, se intenta igual).
  const logo = new Image();
  logo.onload = logo.onerror = generar;
  logo.src = CC.logos.nube;
};