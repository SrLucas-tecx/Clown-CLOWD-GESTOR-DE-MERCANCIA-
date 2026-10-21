// Todo Excel se genera POR COLUMNAS: cada hoja es una lista de filas con las mismas columnas (encabezado arriba).
CC.excel = {
  descargar(nombre, hojas) {
    const ks = Object.keys(hojas), fila = h => h.length ? h : [{ Aviso: 'Sin datos' }];
    if (window.XLSX) {
      const wb = XLSX.utils.book_new();
      ks.forEach(k => {
        const f = fila(hojas[k]), ws = XLSX.utils.json_to_sheet(f);
        ws['!cols'] = Object.keys(f[0]).map(c => ({ wch: Math.min(40, Math.max(c.length, ...f.map(r => String(r[c] ?? '').length)) + 2) }));
        XLSX.utils.book_append_sheet(wb, ws, k.slice(0, 31));
      });
      XLSX.writeFile(wb, nombre + '.xlsx');
      return CC.ui.toast('Excel descargado');
    }
    // Sin el generador (sin internet): un CSV por hoja, también por columnas y con acentos correctos.
    const q = x => `"${String(x ?? '').replace(/"/g, '""')}"`;
    ks.forEach(k => {
      const f = fila(hojas[k]), c = Object.keys(f[0]), a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + [
          c,
          ...f.map(r => c.map(x => r[x]))
        ].map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' }));
      a.download = `${nombre}-${k}.csv`;
      a.click();
    });
    CC.ui.toast('Sin generador de Excel: se descargó un CSV por hoja');
  }
};
