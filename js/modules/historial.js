// Historial de ventas: todas las ventas con filtros (fechas, bazar, pago, estado, búsqueda),
// resumen, detalle de cada venta, anulación y descarga en Excel con lo que estás viendo.
(() => {
  const {db, ui} = CC;
  const E = ui.esc, $ = ui.money;
  const norm = s => String(s || '').trim().toLowerCase();
  const POR_PAGINA = 40;

  // Filtros (se conservan mientras no cierres la página)
  const filtros = {desde: '', hasta: '', bazar: 'all', pago: 'all', estado: 'validas', texto: ''};
  let mostrando = POR_PAGINA;

  const piezasDe = v => v.items.reduce((s, i) => s + i.cant, 0);
  const gananciaDe = v => v.items.reduce((s, i) => s + (i.precio - i.costo) * i.cant, 0);
  // Junta las piezas del mismo nombre (una venta por tema puede salir de varios diseños).
  const detalleDe = v => {
    const juntos = new Map();
    v.items.forEach(i => juntos.set(i.nombre, (juntos.get(i.nombre) || 0) + i.cant));
    return [...juntos].map(([nombre, cant]) => cant + '× ' + nombre).join(', ');
  };
  const nombreBazar = v => v.eventoId ? ((db.get('eventos', v.eventoId) || {}).nombre || 'Bazar eliminado') : 'Sin bazar';
  const nombreCliente = v => v.clienteId ? ((db.get('clientes', v.clienteId) || {}).nombre || '') : '';

  // Ventas que cumplen los filtros, de la más reciente a la más antigua.
  const filtradas = () => db.all('ventas').slice().reverse()
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
    .filter(v => {
      if (filtros.estado === 'validas' && v.anulada) return false;
      if (filtros.estado === 'anuladas' && !v.anulada) return false;
      if (filtros.desde && v.fecha < filtros.desde) return false;
      if (filtros.hasta && v.fecha > filtros.hasta) return false;
      if (filtros.pago !== 'all' && v.pago !== filtros.pago) return false;
      if (filtros.bazar === 'none' && v.eventoId) return false;
      if (filtros.bazar !== 'all' && filtros.bazar !== 'none' && v.eventoId !== filtros.bazar) return false;
      if (filtros.texto && !norm(detalleDe(v) + ' ' + nombreCliente(v) + ' ' + nombreBazar(v)).includes(norm(filtros.texto))) return false;
      return true;
    });

  // ---------------------------------------------------------------------------------------------
  // Excel con lo que se está viendo
  // ---------------------------------------------------------------------------------------------
  function descargarExcel(ventas) {
    if (!ventas.length) return ui.toast('No hay ventas con estos filtros para descargar');
    const validas = ventas.filter(v => !v.anulada);
    const porProducto = {};
    validas.forEach(v => v.items.forEach(i => {
      const p = porProducto[i.nombre] = porProducto[i.nombre] || {Producto: i.nombre, Piezas: 0, Ingresos: 0, Ganancia: 0};
      p.Piezas += i.cant;
      p.Ingresos += i.precio * i.cant;
      p.Ganancia += (i.precio - i.costo) * i.cant;
    }));
    const r2 = x => Math.round(x * 100) / 100;
    CC.excel.descargar('ventas-' + ui.hoy(), {
      Ventas: ventas.map(v => ({
        Fecha: v.fecha, Bazar: nombreBazar(v), Cliente: nombreCliente(v), Pago: v.pago, Estado: v.anulada ? 'Anulada' : 'Válida',
        Detalle: detalleDe(v), Piezas: piezasDe(v), Total: r2(v.total), 'Comisión': r2(v.comision || 0), Ganancia: r2(gananciaDe(v))
      })),
      'Por producto': Object.values(porProducto).sort((a, b) => b.Piezas - a.Piezas).map(p => ({...p, Ingresos: r2(p.Ingresos), Ganancia: r2(p.Ganancia)})),
      Resumen: [{
        Ventas: validas.length, Piezas: validas.reduce((s, v) => s + piezasDe(v), 0), 'Total vendido': r2(validas.reduce((s, v) => s + v.total, 0)),
        Ganancia: r2(validas.reduce((s, v) => s + gananciaDe(v), 0)), 'Desde': filtros.desde || 'inicio', 'Hasta': filtros.hasta || 'hoy'
      }]
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Detalle de una venta
  // ---------------------------------------------------------------------------------------------
  function ver(v) {
    ui.detalle({
      icon: '🧾', title: `Venta del ${v.fecha}`, sub: `${nombreBazar(v)}${nombreCliente(v) ? ' · ' + nombreCliente(v) : ''}${v.anulada ? ' · ANULADA' : ''}`,
      secciones: [
        {t: 'Productos', f: v.items.map(i => [`${i.cant} × ${i.nombre}`, $(i.precio * i.cant)])},
        {t: 'Resumen', f: [
          ['Pago', v.pago], ['Total', $(v.total)], ['Comisión de terminal', $(v.comision || 0)], ['Ganancia', $(gananciaDe(v) - (v.comision || 0)), 'good']
        ]}
      ],
      acciones: v.anulada ? [] : [{label: '↩️ Anular venta', ghost: 1, fn: () => CC.anularVenta(v.id)}]
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Pantalla
  // ---------------------------------------------------------------------------------------------
  CC.router.register('historial', 'Historial', '📜', el => {
    const bazares = db.all('eventos');
    if (filtros.bazar !== 'all' && filtros.bazar !== 'none' && !bazares.some(b => b.id === filtros.bazar)) filtros.bazar = 'all';
    const ventas = filtradas(), validas = ventas.filter(v => !v.anulada);
    const total = validas.reduce((s, v) => s + v.total, 0), ganancia = validas.reduce((s, v) => s + gananciaDe(v) - (v.comision || 0), 0);
    const kpi = (titulo, valor, clase = '') => `<div class="kpi"><small>${titulo}</small><b class="${clase}">${valor}</b></div>`;
    const opcion = (valor, actual, texto) => `<option value="${valor}" ${valor === actual ? 'selected' : ''}>${texto}</option>`;

    el.innerHTML = `
      <div class="bar">
        <div style="flex:1;min-width:220px"><h3 style="margin:0">Historial de ventas</h3>
          <p class="mute" style="margin:2px 0 0">Todas tus ventas, con filtros. El Excel incluye solo lo que estás viendo.</p></div>
        <button class="btn" id="xls">⬇️ Descargar Excel</button>
      </div>

      <div class="card">
        <div class="grid3">
          ${ui.inp('desde', 'Desde', filtros.desde, 'date')}
          ${ui.inp('hasta', 'Hasta', filtros.hasta, 'date')}
          <label>Bazar<select class="inp" name="bazar">${opcion('all', filtros.bazar, 'Todos')}${opcion('none', filtros.bazar, 'Sin bazar')}${bazares.map(b => opcion(b.id, filtros.bazar, '🎪 ' + E(b.nombre))).join('')}</select></label>
        </div>
        <div class="grid3">
          <label>Pago<select class="inp" name="pago">${['all', 'Efectivo', 'Tarjeta', 'Transferencia'].map(p => opcion(p, filtros.pago, p === 'all' ? 'Todos' : p)).join('')}</select></label>
          <label>Estado<select class="inp" name="estado">${opcion('validas', filtros.estado, 'Válidas')}${opcion('anuladas', filtros.estado, 'Anuladas')}${opcion('todas', filtros.estado, 'Todas')}</select></label>
          ${ui.inp('texto', 'Buscar (producto, cliente, bazar)', filtros.texto, 'text', 'placeholder="Ej. gato"')}
        </div>
        <div class="bar" style="margin-top:6px"><button class="btn ghost sm" id="limpiar">Limpiar filtros</button></div>
      </div>

      <div class="kpis">
        ${kpi('Ventas', validas.length)}
        ${kpi('Piezas', validas.reduce((s, v) => s + piezasDe(v), 0))}
        ${kpi('Total vendido', $(total), 'pos-n')}
        ${kpi('Ganancia', $(ganancia), ganancia < 0 ? 'neg' : 'pos-n')}
      </div>

      <div class="card">
        <table>
          <thead><tr><th>Fecha</th><th>Detalle</th><th>Bazar</th><th>Pago</th><th>Total</th><th></th></tr></thead>
          <tbody>${ventas.slice(0, mostrando).map(v => `
            <tr class="${v.anulada ? 'mute' : ''}">
              <td style="white-space:nowrap">${v.fecha}</td>
              <td>${E(detalleDe(v))}${nombreCliente(v) ? `<div class="mute">👤 ${E(nombreCliente(v))}</div>` : ''}</td>
              <td>${E(nombreBazar(v))}</td><td>${v.pago}</td><td><b>${$(v.total)}</b></td>
              <td class="end"><button class="btn ghost sm" data-ver="${v.id}">Ver</button>
                ${v.anulada ? '<span class="chip" style="--c:var(--rojo-300)">Anulada</span>' : `<button class="btn ghost sm" data-x="${v.id}">Anular</button>`}</td>
            </tr>`).join('') || '<tr><td colspan="6" class="mute">No hay ventas con estos filtros.</td></tr>'}</tbody>
        </table>
        ${ventas.length > mostrando ? `<div class="bar" style="margin-top:8px"><button class="btn ghost" id="mas">Mostrar más (${ventas.length - mostrando} restantes)</button></div>` : ''}
      </div>`;

    el.onchange = e => {
      const nombre = e.target.name;
      if (!(nombre in filtros)) return;
      filtros[nombre] = e.target.value;
      mostrando = POR_PAGINA;
      CC.router.show();
    };
    // La búsqueda se aplica al escribir sin perder el cursor.
    el.oninput = e => {
      if (e.target.name !== 'texto') return;
      filtros.texto = e.target.value;
      mostrando = POR_PAGINA;
      const posicion = e.target.selectionStart;
      CC.router.show();
      const campo = el.querySelector('[name=texto]');
      campo.focus();
      campo.setSelectionRange(posicion, posicion);
    };
    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.id === 'xls') descargarExcel(ventas);
      else if (b.id === 'limpiar') { Object.assign(filtros, {desde: '', hasta: '', bazar: 'all', pago: 'all', estado: 'validas', texto: ''}); mostrando = POR_PAGINA; CC.router.show(); }
      else if (b.id === 'mas') { mostrando += POR_PAGINA; CC.router.show(); }
      else if (b.dataset.ver) ver(db.get('ventas', b.dataset.ver));
      else if (b.dataset.x) CC.anularVenta(b.dataset.x);
    };
  });
})();
