// Importar tu Excel de rentabilidad (Producto · Cantidad · Costo del lote · Precio) como compras y materiales,
// y exportar el inventario en el mismo formato (con fórmulas).
(() => {
  const {db, ui} = CC, E = ui.esc, $ = ui.money, norm = s => String(s || '').trim().toLowerCase(), r2 = x => Math.round(x * 100) / 100;
  const num = x => typeof x === 'number' ? x : parseFloat(String(x ?? '').replace(/[^0-9.\-]/g, '')) || 0;
  const limpiar = n => String(n).replace(/\s*\(\s*lote[^)]*\)/i, '').replace(/;\s*tipo por confirmar/i, '').replace(/\s*\(\s*tipo por confirmar\s*\)/i, '').replace(/\s*\((hojas|piezas)\)\s*$/i, '').replace(/\s+/g, ' ').trim();
  const categoria = n => /llavero/i.test(n) ? 'Llaveros' : /pinza/i.test(n) ? 'Pinzas' : /monedero/i.test(n) ? 'Monederos' : /^pines?\b/i.test(n) ? 'Pines' : /stick/i.test(n) ? 'Stickers' : '';
  const esMaterial = n => /papel|hojas|vinil|laminad/i.test(n);
  function leer(buf) {
    const wb = XLSX.read(buf, { type: 'array' });
    let res = null;
    wb.SheetNames.forEach(sn => {
      if (res)
        return;
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], {
        header: 1,
        raw: true,
        defval: ''
      });
      const h = aoa.findIndex(r => r.some(c => /^producto/i.test(String(c))) && r.some(c => /^cantidad/i.test(String(c))));
      if (h < 0)
        return;
      const hd = aoa[h].map(c => String(c).toLowerCase()), ci = re => hd.findIndex(c => re.test(c)), iN = ci(/^producto/), iC = ci(/^cantidad/), iL = ci(/costo (del )?(lote|total)/), iP = ci(/precio/);
      if (iL < 0)
        return;
      const filas = [];
      let hint = null;
      for (let i = h + 1; i < aoa.length; i++) {
        const r = aoa[i], n = String(r[iN] || '').trim();
        if (!n || /^total/i.test(n))
          break;
        filas.push({
          nombre: n,
          cant: num(r[iC]),
          lista: num(r[iL]),
          precio: iP >= 0 ? num(r[iP]) : 0
        });
      }
      aoa.forEach(r => {
        if (/inversi[oó]n inicial/i.test(String(r[0])))
          hint = num(r[1]);
      });
      res = {
        hoja: sn,
        filas,
        hint
      };
    });
    return res;
  }
  function importar(file) {
    if (!window.XLSX)
      return ui.toast('Para leer Excel necesitas conexión: la librería se carga de internet');
    if (!/\.xlsx?$/i.test(file.name))
      return ui.toast('No se puede: el archivo no es de Excel (.xlsx)');
    file.arrayBuffer().then(b => {
      let r;
      try {
        r = leer(b);
      } catch (e) {
        return ui.toast('No se pudo leer el archivo');
      }
      if (!r)
        return ui.toast('No encontré una tabla con las columnas Producto, Cantidad y Costo del lote');
      if (!r.filas.length)
        return ui.toast('La tabla está vacía');
      vista(r);
    });
  }
  function aplicar(filas, tipos, grupos, pagados) {
    const copia = JSON.stringify(db.crudo()), porGrupo = {};
    let mats = 0, omit = 0, prods = 0, compras = 0;
    filas.forEach((f, i) => {
      if (tipos[i] === 'o')
        return;
      if (tipos[i] === 'm') {
        mats++;
        material(f);
      } else
        (porGrupo[grupos[i]] = porGrupo[grupos[i]] || []).push(f);
    });
    Object.keys(porGrupo).forEach(g => {
      const m = new Map();
      porGrupo[g].forEach(f => {
        const n = limpiar(f.nombre), x = m.get(norm(n)) || {
            nombre: n,
            cant: 0,
            lista: 0,
            precio: 0,
            conf: false
          };
        x.cant += f.cant;
        x.lista += f.lista;
        x.precio = f.precio || x.precio;
        x.conf = x.conf || /por confirmar/i.test(f.nombre);
        m.set(norm(n), x);
      });
      const lineas = [], extra = [];
      m.forEach(x => {
        const p = db.all('productos').find(q => norm(q.producto) === norm(x.nombre)), v = p && db.all('variantes').find(w => w.productoId === p.id);
        if (v && (v.receta || []).length) {
          omit++;
          return;
        }
        lineas.push({
          id: v ? v.id : '',
          nombre: x.nombre,
          cat: categoria(x.nombre),
          cant: x.cant,
          lista: r2(x.lista)
        });
        extra.push(x);
      });
      if (!lineas.length)
        return;
      const lista = lineas.reduce((s, l) => s + l.lista, 0), pag = pagados[g] > 0 ? pagados[g] : lista;
      const c = CC.recibirCompra({
        fecha: ui.hoy(),
        proveedor: 'Importado de Excel',
        pagado: pag,
        lineas
      });
      compras++;
      prods += lineas.length;
      c.lineas.forEach((l, i) => {
        if (extra[i].precio > 0)
          db.update('variantes', l.varianteId, { precio: extra[i].precio });
        if (extra[i].conf)
          db.update('productos', db.get('variantes', l.varianteId).productoId, { porConfirmar: true });
      });
    });
    ui.deshacer(`Importado: ${compras} compra(s), ${prods} producto(s), ${mats} material(es)${omit ? `; ${omit} omitido(s) por ser de producción` : ''}.`, copia);
    CC.router.show();
  }
  function material(f) {
    const n = limpiar(f.nombre), m = db.all('materiales').find(x => norm(x.nombre) === norm(n));
    if (m) {
      const costo = m.stock > 0 ? r2((m.stock * m.costo + f.lista) / (m.stock + f.cant)) : r2(f.lista / f.cant);
      db.update('materiales', m.id, {
        stock: m.stock + f.cant,
        costo
      });
      CC.recalcular(m.id);
    } else
      db.add('materiales', {
        nombre: n,
        grupo: /stick|papel|vinil|laminad/i.test(n) ? 'Stickers' : 'Otros',
        unidad: /hojas/i.test(f.nombre) ? 'hojas' : 'pzs',
        stock: f.cant,
        costo: r2(f.lista / f.cant),
        minimo: 0
      });
  }
  function vista(res) {
    const {filas, hint} = res;
    ui.modal('Importar desde Excel', `<p class="mute">Hoja «${E(res.hoja)}»: ${filas.length} filas. Elige cómo importar cada una y a qué compra pertenece.</p>${hint ? `<p class="mute">💡 Tu hoja menciona ${$(hint)} como inversión inicial: úsalo como total pagado del grupo que corresponda.</p>` : ''}
      <div id="irs">${filas.map(f => `<div class="ir"><div><b>${E(limpiar(f.nombre))}</b><div class="mute">${f.cant} pzs · lote ${$(f.lista)}${f.precio ? ' · precio ' + $(f.precio) : ''}</div></div>
        <select class="inp it"><option value="r" ${esMaterial(f.nombre) ? '' : 'selected'}>Reventa</option><option value="m" ${esMaterial(f.nombre) ? 'selected' : ''}>Material</option><option value="o">Omitir</option></select><select class="inp ig"><option>1</option><option>2</option><option>3</option></select></div>`).join('')}</div>
      <div class="grid3" style="margin-top:12px">${[
      1,
      2,
      3
    ].map(g => ui.inp('p' + g, 'Pagado grupo ' + g, '', 'number', 'step="0.01" placeholder="sin descuento"')).join('')}</div><div class="card" id="rs" style="margin:12px 0 0;font-size:.85rem"></div>`, m => {
      const e = est();
      if (e.error) {
        ui.toast(e.error);
        return false;
      }
      aplicar(filas, e.t, e.g, e.p);
    });
    const root = document.getElementById('modal'), q = s => root.querySelector(s);
    root.querySelector('.modal-box').style.maxWidth = '760px';
    const est = () => {
      const rows = [...root.querySelectorAll('.ir')], t = rows.map(r => r.querySelector('.it').value), g = rows.map(r => r.querySelector('.ig').value), p = {
          1: +q('[name=p1]').value || 0,
          2: +q('[name=p2]').value || 0,
          3: +q('[name=p3]').value || 0
        };
      const act = filas.filter((f, i) => t[i] !== 'o');
      let error = '';
      if (!act.length)
        error = 'No hay nada que importar: todas las filas están omitidas.';
      else {
        const mala = act.find(f => f.cant <= 0 || f.lista <= 0);
        if (mala)
          error = `La fila "${limpiar(mala.nombre)}" no tiene cantidad o costo del lote.`;
      }
      if (!error && [
          1,
          2,
          3
        ].some(k => +q('[name=p' + k + ']').value < 0))
        error = 'El total pagado no puede ser negativo.';
      return {
        t,
        g,
        p,
        error
      };
    };
    const calc = () => {
      const e = est();
      const lis = [
        1,
        2,
        3
      ].map(k => filas.reduce((s, f, i) => s + (e.t[i] === 'r' && e.g[i] == k ? f.lista : 0), 0));
      q('#rs').innerHTML = e.error ? `<span class="neg">${E(e.error)}</span>` : [
        1,
        2,
        3
      ].filter(k => lis[k - 1] > 0).map(k => `Grupo ${k}: lista <b>${$(lis[k - 1])}</b> → pagado <b>${$(e.p[k] > 0 ? e.p[k] : lis[k - 1])}</b> (${Math.round((e.p[k] > 0 ? e.p[k] : lis[k - 1]) / lis[k - 1] * 100)}% de la lista)`).join('<br>') + `<br>Materiales: ${e.t.filter(x => x === 'm').length} · Omitidas: ${e.t.filter(x => x === 'o').length}`;
    };
    root.oninput = root.onchange = calc;
    calc();
  }
  // Exporta en el formato de tu hoja: columnas y fórmulas vivas (Rentabilidad y Simulador).
  function exportar() {
    if (!window.XLSX)
      return ui.toast('Para generar el Excel necesitas conexión: la librería se carga de internet');
    const vs = db.all('variantes').map(v => ({
      n: CC.nombreVar(v),
      c: Math.max(0, CC.stock(v.id)) + CC.vendidos(v.id),
      costo: v.costo || 0,
      p: v.precio || 0
    })).filter(x => x.c > 0);
    if (!vs.length)
      return ui.toast('No hay productos con piezas para exportar');
    const mon = '"$"#,##0.00', cel = (f, v, z) => ({
        t: 'n',
        f,
        v,
        z
      }), val = (v, z) => ({
        t: 'n',
        v,
        z
      });
    const a = 5, b = 4 + vs.length, T = b + 1, tot = {
        c: 0,
        l: 0,
        i: 0
      };
    const A1 = [
      ['ANÁLISIS DE RENTABILIDAD'],
      ['Edita cantidades, costos y precios: los cálculos se actualizan solos.'],
      [],
      [
        'Producto',
        'Cantidad',
        'Costo del lote (MXN)',
        'Costo unitario',
        'Precio de venta unitario',
        'Ingresos potenciales',
        'Ganancia bruta potencial',
        'Margen bruto'
      ]
    ];
    vs.forEach((x, i) => {
      const r = i + 5, lote = r2(x.c * x.costo), ing = x.c * x.p;
      tot.c += x.c;
      tot.l += lote;
      tot.i += ing;
      A1.push([
        x.n,
        x.c,
        val(lote, mon),
        cel(`IFERROR(C${r}/B${r},0)`, lote / x.c, mon),
        val(x.p, mon),
        cel(`B${r}*E${r}`, ing, mon),
        cel(`F${r}-C${r}`, ing - lote, mon),
        cel(`IFERROR(G${r}/F${r},0)`, ing ? (ing - lote) / ing : 0, '0%')
      ]);
    });
    A1.push([
      'TOTAL',
      cel(`SUM(B${a}:B${b})`, tot.c),
      cel(`SUM(C${a}:C${b})`, tot.l, mon),
      cel(`IFERROR(C${T}/B${T},0)`, tot.l / tot.c, mon),
      '—',
      cel(`SUM(F${a}:F${b})`, tot.i, mon),
      cel(`SUM(G${a}:G${b})`, tot.i - tot.l, mon),
      cel(`IFERROR(G${T}/F${T},0)`, tot.i ? (tot.i - tot.l) / tot.i : 0, '0%')
    ]);
    const A2 = [
      ['SIMULADOR DE PRECIOS'],
      [
        'Producto',
        'Cantidad',
        'Costo total (MXN)',
        'Precio de venta unitario',
        'Ingresos potenciales',
        'Costo unitario',
        'Ganancia bruta',
        'Margen bruto'
      ]
    ];
    vs.forEach((x, i) => {
      const r = i + 3, lote = r2(x.c * x.costo), ing = x.c * x.p;
      A2.push([
        x.n,
        x.c,
        val(lote, mon),
        val(x.p, mon),
        cel(`B${r}*D${r}`, ing, mon),
        cel(`IFERROR(C${r}/B${r},0)`, lote / x.c, mon),
        cel(`E${r}-C${r}`, ing - lote, mon),
        cel(`IFERROR(G${r}/E${r},0)`, ing ? (ing - lote) / ing : 0, '0%')
      ]);
    });
    const wb = XLSX.utils.book_new(), w = [
        38,
        10,
        20,
        15,
        22,
        20,
        24,
        14
      ];
    [
      [
        'Rentabilidad',
        A1
      ],
      [
        'Simulador',
        A2
      ]
    ].forEach(([nombre, aoa]) => {
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = w.map(x => ({ wch: x }));
      XLSX.utils.book_append_sheet(wb, ws, nombre);
    });
    XLSX.writeFile(wb, 'rentabilidad_clowncloud-' + ui.hoy() + '.xlsx');
    ui.toast('Excel descargado');
  }
  CC.intercambio = {
    importar,
    exportar,
    leer
  };
})();
