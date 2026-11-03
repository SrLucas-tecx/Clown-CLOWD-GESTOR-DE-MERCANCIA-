// Grupos de venta: agrupa el inventario por TEMA + sección (Pines / Stickers / Otros) + TIPO (mini, estándar…).
// Lo usan Venta, Modo bazar y Pedidos para vender por cantidades, sin nombrar cada diseño.
CC.grupos = (() => {
  const {db} = CC;
  const norm = s => String(s || '').trim().toLowerCase();
  const esPin = categoria => /^pines?$/i.test(String(categoria || '').trim());
  const esSticker = categoria => /stic?ker|stiker/i.test(categoria || '');
  const SIN_TEMA = 'Sin tema';

  // Lista de grupos con su stock, precio y costo promedio.
  function construir() {
    const mapa = new Map();
    db.all('variantes').forEach(v => {
      const p = db.get('productos', v.productoId);
      if (!p || p.eliminado) return;
      const tema = (p.coleccion || '').trim() || SIN_TEMA;
      const categoria = (p.categoria || '').trim() || 'Otros';
      const seccion = esPin(categoria) ? 'Pines' : esSticker(categoria) ? 'Stickers' : 'Otros';
      const tipoObj = v.tipoId ? db.get('tipos', v.tipoId) : null;
      const tipo = tipoObj && !tipoObj.eliminado ? tipoObj.nombre : ((v.nombre || '').trim() || 'Único');
      const clave = [norm(tema), seccion === 'Otros' ? norm(categoria) : seccion, norm(tipo)].join('|');
      const g = mapa.get(clave) || {clave, tema, seccion, categoria, tipo, variantes: [], disenos: [], stock: 0};
      g.variantes.push(v);
      g.disenos.push(p.producto);
      g.stock += Math.max(0, CC.stock(v.id));
      mapa.set(clave, g);
    });
    mapa.forEach(g => {
      // La variante con más stock (y precio) fija el precio del grupo.
      const conPrecio = g.variantes.filter(v => v.precio > 0).sort((a, b) => CC.stock(b.id) - CC.stock(a.id));
      g.rep = conPrecio[0] || g.variantes[0];
      g.precio = g.rep.precio || 0;
      const conStock = g.variantes.filter(v => CC.stock(v.id) > 0);
      g.costo = conStock.length
        ? conStock.reduce((s, v) => s + (v.costo || 0) * CC.stock(v.id), 0) / conStock.reduce((s, v) => s + CC.stock(v.id), 0)
        : (g.rep.costo || 0);
      g.etiqueta = etiqueta(g);
      g.icono = icono(g.seccion);
    });
    return [...mapa.values()];
  }

  const icono = seccion => seccion === 'Pines' ? '📍' : seccion === 'Stickers' ? '🖼️' : '📦';

  // Nombre corto del recuadro: el tipo, o la categoría cuando no hay tipo (Llaveros, Monederos…).
  function etiqueta(g) {
    if (g.seccion === 'Otros') return g.tipo === 'Único' ? g.categoria : `${g.categoria} · ${g.tipo}`;
    return g.tipo === 'Único' ? (g.seccion === 'Pines' ? 'Pin' : 'Sticker') : g.tipo;
  }

  const total = (g, n) => CC.linea(g.rep, n); // respeta el precio por cantidad («3 por $90»)

  // Reparte n piezas entre los diseños del grupo (primero los más antiguos). Devuelve [{v, cant}].
  function repartir(g, n) {
    let falta = n;
    const partes = [];
    g.variantes.slice().sort((a, b) => String(a.creado).localeCompare(String(b.creado))).forEach(v => {
      const toma = Math.min(falta, Math.max(0, CC.stock(v.id)));
      if (toma > 0) { partes.push({v, cant: toma}); falta -= toma; }
    });
    return partes;
  }

  const temasDe = grupos => [...new Set(grupos.map(g => g.tema))].sort((a, b) => a === SIN_TEMA ? 1 : b === SIN_TEMA ? -1 : a.localeCompare(b, 'es'));
  const peso = sec => sec === 'Pines' ? 0 : sec === 'Stickers' ? 1 : 2;
  const seccionesDe = lista => [...new Set(lista.map(g => g.seccion))].sort((a, b) => peso(a) - peso(b));
  const buscar = (g, texto) => !texto || norm(`${g.tema} ${g.tipo} ${g.categoria} ${g.seccion} ${g.disenos.join(' ')}`).includes(norm(texto));

  // Bazar activo: se recuerda entre Venta y Modo bazar.
  const CLAVE_BAZAR = 'clowncloud:bazarActivo';
  const bazarActivo = () => {
    const id = localStorage.getItem(CLAVE_BAZAR) || '';
    const b = id ? db.get('eventos', id) : null;
    return b && !b.eliminado ? id : '';
  };
  const guardarBazarActivo = id => localStorage.setItem(CLAVE_BAZAR, id || '');

  return {construir, total, repartir, temasDe, seccionesDe, buscar, icono, etiqueta, norm, SIN_TEMA, bazarActivo, guardarBazarActivo};
})();
