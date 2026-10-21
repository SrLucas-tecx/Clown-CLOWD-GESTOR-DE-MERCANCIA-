// Rentabilidad y simulador (como tu Excel): margen bruto y neto por producto, precio sugerido,
// ganancia potencial y recuperación de la inversión. Precio y extras se editan en las celdas amarillas.
(() => {
  const {db, ui} = CC, E = ui.esc, $ = ui.money, KM = 'clowncloud:margen', r2 = x => Math.round(x * 100) / 100;
  const meta = () => +localStorage.getItem(KM) || 40;
  // Comisión real de terminal sobre lo vendido (0 si todavía no hay ventas).
  const tasa = () => {
    const vs = CC.ventasOk(), t = vs.reduce((s, v) => s + v.total, 0);
    return t ? vs.reduce((s, v) => s + (v.comision || 0), 0) / t : 0;
  };
  const cls = m => m === null ? 'mute' : m < 20 ? 'neg' : m < 40 ? 'warn' : 'pos-n', pc = m => m === null ? '—' : Math.round(m) + '%';
  const filas = () => {
    const tc = tasa(), den = 1 - meta() / 100 - tc;
    return db.all('variantes').map(v => {
      const p = db.get('productos', v.productoId) || {}, st = Math.max(0, CC.stock(v.id)), costo = v.costo || 0, extra = v.extra || 0, precio = v.precio || 0, neto = precio ? precio - costo - extra - precio * tc : null;
      return {
        v,
        nombre: CC.nombreVar(v),
        cat: p.categoria || '',
        st,
        vend: CC.vendidos(v.id),
        costo,
        extra,
        precio,
        bruto: precio ? (precio - costo) / precio * 100 : null,
        netoPct: precio ? neto / precio * 100 : null,
        ing: st * precio,
        gp: precio ? st * neto : 0,
        sug: den > 0 && costo ? Math.ceil((costo + extra) / den) : null
      };
    });
  };
  CC.router.register('rentabilidad', 'Rentabilidad', '📈', el => {
    const fs = filas(), vs = CC.ventasOk(), ventas = vs.reduce((s, v) => s + v.total, 0), com = vs.reduce((s, v) => s + (v.comision || 0), 0), tc = tasa();
    const inv = fs.reduce((s, f) => s + (f.st + f.vend) * f.costo, 0), real = CC.utilidad(vs) - com, pot = fs.reduce((s, f) => s + f.gp, 0);
    const falta = Math.max(0, inv - ventas), pct = inv ? Math.min(100, Math.round(ventas / inv * 100)) : 0, pzs = fs.reduce((s, f) => s + f.st, 0), pm = pzs ? fs.reduce((s, f) => s + f.ing, 0) / pzs : 0;
    const msg = !inv ? 'Aún no hay productos con costo definido.' : falta <= 0 ? '🎉 Ya recuperaste la inversión: lo que vendas ahora es ganancia.' : `Faltan ${$(falta)} para recuperar la inversión${pm ? ` (≈ ${Math.ceil(falta / pm)} piezas al precio promedio de ${$(pm)})` : ''}.`;
    const k = (t, b, c = '') => `<div class="kpi"><small>${t}</small><b class="${c}">${b}</b></div>`;
    el.innerHTML = `<div class="kpis">${k('Inversión (costo de lo que tienes y vendiste)', $(inv))}${k('Recuperado con ventas', $(ventas), 'pos-n')}${k('Ganancia real hasta hoy', $(real), real < 0 ? 'neg' : 'pos-n')}${k('Ganancia potencial de tu stock', $(pot), pot < 0 ? 'neg' : '')}</div>
      <div class="card"><div class="savings"><b>Recuperación de la inversión: ${pct}%</b></div><div class="meter"><i style="width:${pct}%"></i></div><p class="mute">${msg}</p></div>
      <div class="bar"><label style="margin:0;max-width:210px">Margen neto deseado (%)<input class="inp" id="m" type="number" min="0" max="90" value="${meta()}"></label><div style="flex:1"></div><button class="btn ghost" id="x">⬇️ Excel</button><button class="btn" id="ap">Aplicar precios sugeridos</button></div>
      <div class="card"><table><thead><tr><th>Producto</th><th>Stock</th><th>Costo</th><th>Extras ✎</th><th>Precio ✎</th><th>Margen bruto</th><th>Margen neto</th><th>Ganancia pot.</th><th>Sugerido</th></tr></thead><tbody id="rows">
      ${fs.map(f => `<tr><td><b>${E(f.nombre)}</b><div class="mute">${E(f.cat)}</div></td><td>${f.st}</td><td>${$(f.costo)}</td>
        <td><input class="inp ed" data-f="extra" data-v="${f.v.id}" type="number" step="0.01" value="${f.extra || ''}" placeholder="0"></td><td><input class="inp ed" data-f="precio" data-v="${f.v.id}" type="number" step="0.01" value="${f.precio || ''}" placeholder="Definir"></td>
        <td class="${cls(f.bruto)}">${pc(f.bruto)}</td><td class="${cls(f.netoPct)}">${pc(f.netoPct)}</td><td>${f.precio ? $(f.gp) : '—'}</td><td>${f.sug ? $(f.sug) : '—'}</td></tr>`).join('') || '<tr><td colspan="9" class="mute">Sin productos todavía.</td></tr>'}</tbody></table>
      <p class="mute">Margen neto = precio − costo − extras − comisión de terminal${tc ? ` (${(tc * 100).toFixed(1)}% de tus ventas)` : ' (aún sin ventas con tarjeta)'}. Verde: 40 % o más · amarillo: 20–40 % · rojo: menos de 20 %.</p></div>`;
    const $q = s => el.querySelector(s);
    $q('#m').onchange = e => {
      const n = +e.target.value;
      if (!(n >= 0 && n < 90)) {
        ui.toast('No se puede: el margen debe estar entre 0 y 90 %');
        return CC.router.show();
      }
      localStorage.setItem(KM, n);
      CC.router.show();
    };
    $q('#rows').onchange = e => {
      const i = e.target.closest('.ed');
      if (!i)
        return;
      const n = +i.value;
      if (n < 0) {
        ui.toast('No se puede: el valor no puede ser negativo');
        return CC.router.show();
      }
      const v = db.get('variantes', i.dataset.v);
      db.update('variantes', v.id, { [i.dataset.f]: n || 0 });
      if (i.dataset.f === 'precio' && n && n <= (v.costo || 0) + (v.extra || 0))
        ui.toast('⚠️ Ese precio no cubre el costo');
      CC.router.show();
    };
    $q('#ap').onclick = () => {
      const c = fs.filter(f => f.sug && f.sug !== f.precio);
      if (!c.length)
        return ui.toast('No se puede: no hay productos con costo definido o ya tienen el precio sugerido');
      ui.confirm(`Se cambiarán ${c.length} precio(s) al sugerido para un margen neto de ${meta()} %.`, 'Aplicar').then(ok => {
        if (!ok)
          return;
        const copia = JSON.stringify(db.crudo());
        c.forEach(f => db.update('variantes', f.v.id, { precio: f.sug }));
        CC.router.show();
        ui.deshacer('Precios actualizados.', copia);
      });
    };
    $q('#x').onclick = () => CC.excel.descargar('rentabilidad-' + ui.hoy(), {
      Rentabilidad: fs.map(f => ({
        Producto: f.nombre,
        'Categoría': f.cat,
        Stock: f.st,
        Vendidas: f.vend,
        'Costo unitario': f.costo,
        'Extras por pieza': f.extra,
        Precio: f.precio,
        'Margen bruto %': f.bruto === null ? '' : r2(f.bruto),
        'Margen neto %': f.netoPct === null ? '' : r2(f.netoPct),
        'Ingreso potencial': r2(f.ing),
        'Ganancia potencial': r2(f.gp),
        'Precio sugerido': f.sug || ''
      })),
      Resumen: [{
          'Inversión': r2(inv),
          'Recuperado con ventas': r2(ventas),
          'Falta recuperar': r2(falta),
          'Recuperación %': pct,
          'Ganancia real hasta hoy': r2(real),
          'Ganancia potencial del stock': r2(pot),
          'Margen neto deseado %': meta()
        }]
    });
  });
})();
