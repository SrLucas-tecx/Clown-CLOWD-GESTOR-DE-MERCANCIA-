// Guardado como LUCXSTUDIO: respaldo con datos del dispositivo, importar con vista previa (combinar o reemplazar),
// copia anterior, deshacer, recordatorio, datos de prueba y Excel por columnas.
(() => {
  const {db, ui} = CC, E = ui.esc;
  const ls = {
    get: k => {
      try {
        return localStorage.getItem(k);
      } catch (e) {
        return null;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch (e) {
        ui.toast('Poco espacio para la copia anterior');
      }
    }
  };
  const K = {
    ult: 'clowncloud:ultimoRespaldo',
    disp: 'clowncloud:dispositivo',
    copia: 'clowncloud:copia',
    aviso: 'clowncloud:avisoRespaldo'
  };
  const COL = [
    [
      'productos',
      'Productos'
    ],
    [
      'variantes',
      'Variantes'
    ],
    [
      'materiales',
      'Materiales'
    ],
    [
      'clientes',
      'Clientes'
    ],
    [
      'eventos',
      'Bazares'
    ],
    [
      'ventas',
      'Ventas'
    ],
    [
      'movimientos',
      'Movimientos'
    ],
    [
      'compras',
      'Compras'
    ],
    [
      'etiquetas',
      'Etiquetas'
    ]
  ];
  const n = (d, k) => (d[k] || []).filter(r => !r.eliminado).length;
  const disp = () => ls.get(K.disp) || (/Android|iPhone|Mobile/i.test(navigator.userAgent) ? 'Celular' : 'Computadora');
  const dias = iso => iso ? Math.floor((Date.now() - new Date(iso)) / 86400000) : null;
  const cuando = iso => iso ? new Date(iso).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }) : '—';
  const cambio = () => Object.values(db.crudo()).flat().map(r => r && r.editado).filter(Boolean).sort().pop();
  const armar = () => JSON.stringify({
    app: 'CLOWN CLOUD',
    tipo: 'respaldo-completo',
    version: 1,
    exportadoEn: new Date().toISOString(),
    dispositivo: disp(),
    datos: db.crudo()
  });
  const archivo = () => `clowncloud_respaldo_${disp().toLowerCase().replace(/[^a-z0-9]+/g, '-')}_${ui.hoy()}.json`;
  const bajar = (blob, nombre) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    a.click();
  };
  const copiaPrevia = motivo => ls.set(K.copia, JSON.stringify({
    en: new Date().toISOString(),
    motivo,
    datos: db.crudo()
  }));
  const leerCopia = () => {
    try {
      return JSON.parse(ls.get(K.copia));
    } catch (e) {
      return null;
    }
  };
  function descargar() {
    bajar(new Blob([armar()], { type: 'application/json' }), archivo());
    ls.set(K.ult, new Date().toISOString());
    ui.toast('Respaldo descargado');
    CC.router.show();
  }
  async function compartir() {
    const f = new File([armar()], archivo(), { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try {
        await navigator.share({
          files: [f],
          title: 'Respaldo CLOWN CLOUD'
        });
        ls.set(K.ult, new Date().toISOString());
        return ui.toast('Respaldo enviado');
      } catch (e) {
        if (e.name === 'AbortError')
          return;
      }
    }
    descargar();
    ui.toast('Tu navegador no puede compartir: se descargó para que lo envíes tú');
  }
  function aplicar(modo, d) {
    const antes = JSON.stringify(db.crudo());
    copiaPrevia(modo === 'c' ? 'antes de combinar un respaldo' : 'antes de reemplazar con un respaldo');
    if (modo === 'c') {
      const r = db.combinar(d, true);
      ui.deshacer(`Combinado: ${r.nuevos} nuevo(s), ${r.difieren} actualizado(s).`, antes);
    } else {
      db.reemplazar(d);
      ui.deshacer('Respaldo importado.', antes);
    }
    CC.router.show();
  }
  function vistaPrevia(meta, d) {
    const sim = db.combinar(d, false);
    ui.detalle({
      icon: '📥',
      title: 'Importar respaldo',
      sub: 'Revisa antes de aplicar',
      secciones: [
        {
          t: 'Archivo',
          f: [
            [
              'Guardado el',
              cuando(meta.exportadoEn)
            ],
            [
              'Dispositivo',
              meta.dispositivo || '—'
            ]
          ]
        },
        {
          t: 'Comparación (este dispositivo → archivo)',
          f: COL.map(([k, l]) => {
            const a = n(db.crudo(), k), b = n(d, k);
            return [
              l,
              `${a} → ${b}`,
              b > a ? 'good' : b < a ? 'bad' : ''
            ];
          })
        },
        {
          t: 'Si eliges Combinar',
          f: [
            [
              'Registros nuevos',
              sim.nuevos,
              sim.nuevos ? 'good' : ''
            ],
            [
              'Registros actualizados (gana el más reciente)',
              sim.difieren
            ]
          ]
        }
      ],
      acciones: [
        {
          label: '🔀 Combinar',
          fn: () => aplicar('c', d)
        },
        {
          label: '♻️ Reemplazar todo',
          ghost: 1,
          fn: () => ui.confirm('Este dispositivo quedará igual que el archivo. Lo que solo exista aquí se perderá (se guarda una copia anterior).', 'Reemplazar').then(ok => ok && aplicar('r', d))
        }
      ]
    });
  }
  function importar(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const p = JSON.parse(r.result), d = p.tipo === 'respaldo-completo' && p.datos ? p.datos : p;
        if (!d.schema)
          throw 0;
        vistaPrevia(p.tipo ? p : {}, d);
      } catch (e) {
        ui.toast('El archivo no es un respaldo válido');
      }
    };
    r.readAsText(file);
  }
  function excel() {
    const tag = ids => (ids || []).map(i => (db.get('etiquetas', i) || {}).nombre).filter(Boolean).join(', '), vs = CC.ventasOk();
    CC.excel.descargar('clowncloud_' + ui.hoy(), {
      Productos: db.all('variantes').map(x => {
        const p = db.get('productos', x.productoId) || {};
        return {
          Producto: p.producto,
          'Categoría': p.categoria || '',
          'Temática': p.coleccion || '',
          Etiquetas: tag(p.etiquetas),
          Variante: x.nombre || '',
          SKU: x.sku || '',
          Stock: CC.stock(x.id),
          'En proceso': CC.enProceso(x.id),
          Vendidos: CC.vendidos(x.id),
          Costo: x.costo,
          Precio: x.precio,
          'Margen %': x.precio ? Math.round((x.precio - x.costo) / x.precio * 100) : 0
        };
      }),
      Materiales: db.all('materiales').map(m => ({
        Material: m.nombre,
        Grupo: m.grupo,
        Unidad: m.unidad,
        Stock: m.stock,
        'Costo por unidad': m.costo,
        'Mínimo': m.minimo,
        'Valor en stock': Math.round(m.stock * m.costo * 100) / 100
      })),
      Ventas: db.all('ventas').map(v => ({
        Fecha: v.fecha,
        Detalle: v.items.map(i => i.cant + 'x ' + i.nombre).join(' / '),
        Piezas: v.items.reduce((s, i) => s + i.cant, 0),
        Total: v.total,
        Pago: v.pago,
        'Comisión': v.comision || 0,
        Bazar: (db.get('eventos', v.eventoId) || {}).nombre || 'Sin bazar',
        Cliente: (db.get('clientes', v.clienteId) || {}).nombre || '',
        Estado: v.anulada ? 'Anulada' : 'Válida'
      })),
      Clientes: db.all('clientes').map(c => {
        const cv = vs.filter(v => v.clienteId === c.id);
        return {
          Cliente: c.nombre,
          Contacto: c.contacto || '',
          Etiquetas: tag(c.etiquetas),
          Pedidos: cv.length,
          'Total gastado': cv.reduce((s, v) => s + v.total, 0)
        };
      }),
      Compras: db.all('compras').filter(c => !c.anulada).flatMap(c => c.lineas.map(l => ({
        Fecha: c.fecha,
        Proveedor: c.proveedor || '',
        Producto: l.nombre,
        Cantidad: l.cant,
        'Costo de lista': l.lista,
        'Costo real': l.real,
        'Costo unitario real': Math.round(l.real / l.cant * 100) / 100
      }))),
      Bazares: db.all('eventos').map(e => ({
        Bazar: e.nombre,
        Fecha: e.fecha || '',
        'Días': e.dias || 0,
        Mesa: e.mesa || 0,
        'Ya pagado': e.pagado || 0,
        'Fondo de caja': e.fondoCaja || 0
      }))
    });
  }
  const recordatorio = () => {
    if (!db.all('productos').length && !db.all('ventas').length || ls.get(K.aviso) === ui.hoy())
      return;
    const d = dias(ls.get(K.ult));
    if (d !== null && d <= 7)
      return;
    ls.set(K.aviso, ui.hoy());
    ui.toast(d === null ? 'Aún no has descargado un respaldo.' : `Hace ${d} días que no descargas un respaldo.`, {
      label: 'Descargar',
      fn: descargar
    });
  };
  CC.router.register('respaldo', 'Respaldo', '💾', el => {
    const ult = ls.get(K.ult), d = dias(ult), raw = db.crudo(), urg = (db.all('productos').length || db.all('ventas').length) && (d === null || d > 7), cop = leerCopia();
    const resumen = COL.slice(0, 6).map(([k, l]) => `${n(raw, k)} ${l.toLowerCase()}`).join(' · ');
    el.innerHTML = `
      <div class="grid2" style="align-items:start">
        <div class="card">
          <div class="bar" style="margin-bottom:4px">
            <h3 style="margin:0;flex:1">💾 Respaldo</h3>
            <span class="${urg ? 'neg' : 'mute'}">${urg ? '⚠️ ' : ''}Último respaldo: ${ult ? cuando(ult) : 'nunca'}</span>
          </div>
          <div class="line"><span class="mute">Último cambio en este dispositivo</span><span>${cuando(cambio())}</span></div>
          <div class="line"><span class="mute">Datos guardados</span><span style="text-align:right">${resumen}</span></div>
          <div class="bar" style="margin-top:10px;align-items:flex-end">
            <div style="flex:1;min-width:170px">${ui.inp('disp', 'Nombre de este dispositivo', ls.get(K.disp) || '', 'text', `placeholder="${disp()}" maxlength="24"`)}</div>
          </div>
          <div class="bar" style="margin-top:6px">
            <button class="btn" id="d">⬇️ Descargar</button>
            <button class="btn ghost" id="s">📤 Enviar a otro dispositivo</button>
            <label class="btn ghost" style="margin:0;cursor:pointer;text-transform:none;letter-spacing:0;font-size:.83rem">📥 Importar<input type="file" accept=".json" id="i" hidden></label>
            ${cop ? '<button class="btn ghost" id="r">🛟 Restaurar copia anterior</button>' : ''}
            <button class="btn ghost" id="x">📊 Excel (por columnas)</button>
          </div>
          <details style="margin-top:8px"><summary>¿Cómo lo uso el día de un bazar?</summary>
            <ol class="mute"><li>Antes: descarga el respaldo y pásalo al celular.</li><li>En el celular: Importar respaldo → <b>Reemplazar todo</b>.</li><li>Vende desde el celular.</li><li>Al terminar: «Enviar a otro dispositivo» y mándalo a la computadora.</li><li>En la computadora: Importar → <b>Combinar</b> (suma ventas y movimientos nuevos; el stock se ajusta solo).</li></ol>
          </details>
        </div>
        <div class="card">
          <h3 style="margin:0 0 4px">🧪 Datos de prueba</h3>
          <p class="mute" style="margin:0 0 8px">Los datos de ejemplo están en <b>js/core/semilla.js</b>: edítalos y vuelve a cargarlos.</p>
          <div class="bar"><button class="btn ghost" id="p">🧪 Cargar datos de prueba</button><button class="btn ghost" id="b">🗑️ Borrar todos los datos</button></div>
        </div>
      </div>`;
    const $ = s => el.querySelector(s), nuevo = (msg, fn, ok, aviso) => ui.confirm(msg, ok).then(s => {
        if (!s)
          return;
        const antes = JSON.stringify(db.crudo());
        copiaPrevia(aviso);
        fn();
        ui.deshacer(aviso + ' hecho.', antes);
        CC.router.show();
      });
    $('#d').onclick = descargar;
    $('#s').onclick = compartir;
    $('#x').onclick = excel;
    $('#i').onchange = e => {
      if (e.target.files[0])
        importar(e.target.files[0]);
      e.target.value = '';
    };
    el.querySelector('[name=disp]').onchange = e => {
      ls.set(K.disp, e.target.value.trim());
      ui.toast('Nombre guardado');
    };
    if (cop)
      $('#r').onclick = () => nuevo(`Tus datos volverán a como estaban el ${cuando(cop.en)} (${cop.motivo}).`, () => db.reemplazar(cop.datos), 'Restaurar', 'Copia restaurada');
    $('#p').onclick = () => nuevo('Se reemplazará todo lo actual por los datos de prueba.', () => CC.semilla.cargar(), 'Cargar', 'Datos de prueba');
    $('#b').onclick = () => nuevo('Se borrarán todos los datos. Descarga un respaldo antes.', () => db.vaciar(), 'Borrar todo', 'Datos borrados');
  });
  setTimeout(recordatorio, 3000);
})();
