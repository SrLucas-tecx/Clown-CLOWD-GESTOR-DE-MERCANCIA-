// DATOS DE PRUEBA. Edita libremente las listas de abajo y usa Respaldo → «Cargar datos de prueba».
// Se refieren unos a otros por NOMBRE (materiales en recetas, clientes y bazares en ventas).
CC.semilla = {
  datos: {
    etiquetas: [ // [nombre, ámbito (producto|cliente), color]
      ['Anime', 'producto', '#ff6b9d'], ['Pares', 'producto', '#ffc933'], ['Gatos', 'producto', '#3fd08f'],
      ['VIP', 'cliente', '#ffc933'], ['Coleccionista', 'cliente', '#b388ff'], ['Mayorista', 'cliente', '#4dabf7']],
    materiales: [ // [nombre, grupo, unidad, stock, costo por unidad, mínimo]
      ['Base de pin 1.5"', 'Pines', 'pzs', 200, 2.5, 40], ['Alfiler', 'Pines', 'pzs', 250, 0.6, 50],
      ['Tarjeta display', 'Empaque', 'pzs', 120, 1.2, 30], ['Bolsita', 'Empaque', 'pzs', 150, 0.5, 30],
      ['Vinil mate', 'Stickers', 'hojas', 60, 8, 10], ['Laminado', 'Stickers', 'hojas', 40, 5, 10]],
    productos: [ // receta: [material, cantidad por pieza]
      { producto: 'Gato astronauta', categoria: 'Pines', tema: 'Espacio', etiquetas: ['Gatos'], variantes: [{ nombre: '1.5" epoxi', sku: 'PIN-GA-15', precio: 60, minimo: 10, stock: 30, proceso: 20, receta: [['Base de pin 1.5"', 1], ['Alfiler', 1], ['Tarjeta display', 1], ['Bolsita', 1]] }] },
      { producto: 'Chibi ramen', categoria: 'Pines', tema: 'Anime', etiquetas: ['Anime'], variantes: [{ nombre: '1.5" epoxi', sku: 'PIN-CR-15', precio: 55, minimo: 10, stock: 8, receta: [['Base de pin 1.5"', 1], ['Alfiler', 1], ['Tarjeta display', 1], ['Bolsita', 1]] }] },
      { producto: 'Pack gatos par', categoria: 'Stickers', tema: 'Gatos', etiquetas: ['Gatos', 'Pares'], variantes: [{ nombre: 'Par mate', sku: 'STK-GP-M', precio: 35, minimo: 10, stock: 40, escCant: 3, escTotal: 90, receta: [['Vinil mate', 0.1], ['Laminado', 0.1], ['Bolsita', 1]] }] },
      { producto: 'Hoja anime', categoria: 'Stickers', tema: 'Anime', etiquetas: ['Anime'], variantes: [{ nombre: 'Hoja A5', sku: 'STK-HA-A5', precio: 45, minimo: 8, stock: 25, receta: [['Vinil mate', 0.5], ['Laminado', 0.5], ['Bolsita', 1]] }] }],
    clientes: [
      { nombre: 'Ana', contacto: '@ana_pins', notas: 'Colecciona gatos', etiquetas: ['Coleccionista', 'VIP'] },
      { nombre: 'Luis', contacto: '55 1234 5678', notas: 'Compra mayoreo', etiquetas: ['Mayorista'] },
      { nombre: 'Sofi', contacto: '@sofi.art', notas: 'Le gusta el anime', etiquetas: ['Coleccionista'] }],
    eventos: [{ nombre: 'Bazar Anime Fest', fecha: '2026-10-10', dias: 2, mesa: 400, pagado: 200, fondoCaja: 300, costos: [['Gasolina', 150], ['Comida', 90]] }],
    ventas: [ // dias: -3 = hace 3 días · items: ['Producto · Variante', cantidad]
      { dias: -3, evento: 'Bazar Anime Fest', cliente: 'Ana', pago: 'Efectivo', items: [['Gato astronauta · 1.5" epoxi', 3], ['Pack gatos par · Par mate', 2]] },
      { dias: -3, evento: 'Bazar Anime Fest', cliente: '', pago: 'Tarjeta', items: [['Chibi ramen · 1.5" epoxi', 2]] },
      { dias: -2, evento: 'Bazar Anime Fest', cliente: 'Luis', pago: 'Transferencia', items: [['Hoja anime · Hoja A5', 5]] },
      { dias: -1, evento: '', cliente: 'Sofi', pago: 'Efectivo', items: [['Pack gatos par · Par mate', 1]] }],
    compras: [ // lineas: [nombre, categoría, cantidad, costo de lista, precio de venta] · pagado: lo que de verdad pagaste
      { proveedor: 'Proveedor de accesorios', pagado: 220, lineas: [['Pinzas kawaii', 'Pinzas', 6, 46.79, 10], ['Llaveros de tortuga', 'Llaveros', 16, 93, 10], ['Monederos de tiburón', 'Monederos', 6, 174.32, 40], ['Estrellas (12 piezas)', 'Llaveros', 12, 147.97, 20, true]] }],
    combos: [{ nombre: 'Combo gatos', precio: 85, items: [['Gato astronauta · 1.5" epoxi', 1], ['Pack gatos par · Par mate', 1]] }],
    consultas: [ // [producto (o texto si no lo teníamos), veces que preguntaron, bazar]
      ['Gato astronauta · 1.5" epoxi', 5, 'Bazar Anime Fest'], ['Pinzas de gato', 4, 'Bazar Anime Fest'], ['Chibi ramen · 1.5" epoxi', 2, '']],
    pedidos: [ // entrega: días desde hoy (negativo = vencido)
      { cliente: 'Ana', entrega: 3, anticipo: 100, estado: 'En producción', notas: 'Para regalo', items: [['Gato astronauta · 1.5" epoxi', 4]] },
      { cliente: 'Luis', entrega: -1, anticipo: 0, estado: 'Por hacer', items: [['Hoja anime · Hoja A5', 10]] }]
  },
  // Carga los datos de prueba (reemplaza todo lo que haya).
  cargar() {
    const { db } = CC, S = this.datos, id = {}, hoy = new Date();
    db.vaciar();
    S.etiquetas.forEach(([nombre, ambito, color]) => id['t:' + nombre] = db.add('etiquetas', { nombre, ambito, color }).id);
    S.materiales.forEach(([nombre, grupo, unidad, stock, costo, minimo]) => id['m:' + nombre] = db.add('materiales', { nombre, grupo, unidad, stock, costo, minimo }).id);
    S.clientes.forEach(c => id['c:' + c.nombre] = db.add('clientes', { nombre: c.nombre, contacto: c.contacto, notas: c.notas, etiquetas: c.etiquetas.map(t => id['t:' + t]) }).id);
    S.productos.forEach(p => {
      const pr = db.add('productos', { producto: p.producto, categoria: p.categoria, coleccion: p.tema, etiquetas: p.etiquetas.map(t => id['t:' + t]) });
      p.variantes.forEach(v => {
        const receta = v.receta.map(([m, cant]) => ({ materialId: id['m:' + m], cant })), costo = Math.round(receta.reduce((s, r) => s + db.get('materiales', r.materialId).costo * r.cant, 0) * 100) / 100;
        const va = db.add('variantes', { productoId: pr.id, nombre: v.nombre, sku: v.sku, costo, precio: v.precio, minimo: v.minimo, receta, escCant: v.escCant || 0, escTotal: v.escTotal || 0 });
        id['v:' + p.producto + ' · ' + v.nombre] = va.id;
        CC.mover(va.id, v.stock, 'entrada', 'Stock inicial'); if (v.proceso) CC.mover(va.id, v.proceso, 'proceso', 'En producción');
      });
    });
    S.eventos.forEach(e => id['e:' + e.nombre] = db.add('eventos', { nombre: e.nombre, fecha: e.fecha, dias: e.dias, mesa: e.mesa, pagado: e.pagado, fondoCaja: e.fondoCaja, costos: e.costos.map(([concepto, monto]) => ({ concepto, monto })), ingresos: [] }).id);
    S.ventas.forEach(v => {
      const f = new Date(hoy); f.setDate(f.getDate() + v.dias);
      const items = v.items.map(([n, cant]) => { const va = db.get('variantes', id['v:' + n]); return { varianteId: va.id, nombre: n, cant, precio: va.precio, costo: va.costo }; });
      const total = items.reduce((s, i) => s + i.precio * i.cant, 0);
      const ve = db.add('ventas', { items, total, pago: v.pago, eventoId: id['e:' + v.evento] || '', clienteId: id['c:' + v.cliente] || '', fecha: f.toLocaleDateString('sv'), comision: v.pago === 'Tarjeta' ? total * CC.ui.cfg.comision() / 100 : 0 });
      items.forEach(i => CC.mover(i.varianteId, -i.cant, 'venta', '', ve.id));
    });
    (S.compras || []).forEach(c => {
      const r = CC.recibirCompra({ fecha: new Date().toLocaleDateString('sv'), proveedor: c.proveedor, pagado: c.pagado, lineas: c.lineas.map(([nombre, cat, cant, lista]) => ({ id: '', nombre, cat, cant, lista })) });
      r.lineas.forEach((l, i) => { db.update('variantes', l.varianteId, { precio: c.lineas[i][4] }); if (c.lineas[i][5]) db.update('productos', db.get('variantes', l.varianteId).productoId, { porConfirmar: true }); });
    });
    (S.combos || []).forEach(c => db.add('combos', { nombre: c.nombre, precio: c.precio, items: c.items.map(([n, cant]) => ({ varianteId: id['v:' + n], cant })) }));
    (S.consultas || []).forEach(([n, cant, ev]) => { const va = id['v:' + n]; db.add('consultas', { varianteId: va || '', nombre: va ? '' : n, cant, eventoId: id['e:' + ev] || '', fecha: hoy.toLocaleDateString('sv'), etiquetas: [] }); });
    (S.pedidos || []).forEach(p => {
      const f = new Date(hoy); f.setDate(f.getDate() + p.entrega);
      const items = p.items.map(([n, cant]) => { const va = db.get('variantes', id['v:' + n]); return { varianteId: va.id, nombre: n, cant, precio: va.precio, costo: va.costo }; });
      db.add('pedidos', { folio: 'CC-' + (1001 + db.crudo().pedidos.length), clienteId: id['c:' + p.cliente] || '', fecha: hoy.toLocaleDateString('sv'), entrega: f.toLocaleDateString('sv'), estado: p.estado, anticipo: p.anticipo, notas: p.notas || '', items });
    });
  },
  // Primera vez que se abre la app y no hay productos: carga los datos de prueba.
  inicial() {
    if (localStorage.getItem('clowncloud:semilla')) return;
    localStorage.setItem('clowncloud:semilla', '1'); if (!CC.db.all('productos').length) this.cargar();
  }
};
