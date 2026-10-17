// Revisa inconsistencias y devuelve [nivel, mensaje]; 🔴 = hay que corregir, 🟡 = conviene revisar.
(() => {
  const { db, ui } = CC;
  CC.alertas = () => {
    const a = [], $ = ui.money;
    db.all('variantes').forEach(v => {
      const nom = CC.nombreVar(v), s = CC.stock(v.id), r = v.receta || [];
      if (s < 0) a.push(['🔴', `${nom}: stock negativo (${s}). Revisa los movimientos o ajusta el inventario.`]);
      else if (v.minimo && s <= v.minimo) a.push(['🟡', `${nom}: stock bajo (${s}, mínimo ${v.minimo}).`]);
      if (!v.precio) a.push(['🟡', `${nom}: falta definir el precio de venta.`]);
      if (v.precio && v.precio <= v.costo) a.push(['🔴', `${nom}: el precio (${$(v.precio)}) no cubre el costo (${$(v.costo)}).`]);
      else if (v.precio && (v.precio - v.costo) / v.precio < .2) a.push(['🟡', `${nom}: margen menor al 20%.`]);
      if (v.origen === 'reventa') { /* se compra hecho: no lleva receta */ }
      else if (!r.length) a.push(['🟡', `${nom}: sin materiales; el costo es manual y no descuenta material.`]);
      else {
        const c = r.reduce((t, x) => { const m = db.get('materiales', x.materialId); return t + (m ? m.costo * x.cant : 0); }, 0);
        if (Math.abs(c - v.costo) > .01) a.push(['🟡', `${nom}: el costo (${$(v.costo)}) no coincide con sus materiales (${$(c)}).`]);
        const f = CC.faltantes(v.id, CC.enProceso(v.id)); if (f.length) a.push(['🔴', `${nom}: el material no alcanza para terminar lo que está en proceso: ${f.join(', ')}.`]);
      }
    });
    db.all('materiales').forEach(m => {
      if (m.stock <= 0) a.push(['🔴', `${m.nombre}: sin stock.`]);
      else if (m.minimo && m.stock <= m.minimo) a.push(['🟡', `${m.nombre}: material bajo (${m.stock} ${m.unidad}).`]);
    });
    return a.sort((x, y) => x[0] === y[0] ? 0 : x[0] === '🔴' ? -1 : 1);
  };
})();
