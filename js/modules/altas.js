// Alta rápida: agrega VARIOS pines y stickers de golpe a un tema, sin capturar movimientos.
// Cada fila lleva un TIPO de producto (mini pin, pin gigante, sticker…): con él se calcula el costo, se sugiere
// el precio y, si quieres, se descuentan del inventario los materiales que gasta cada pieza.
(() => {
  const {db, ui} = CC;
  const E = ui.esc, $ = ui.money;
  const norm = s => String(s || '').trim().toLowerCase();
  const NUEVO = '__nuevo__';
  const FILAS_INICIALES = 6;
  const COLUMNAS = '150px 1fr 70px 78px 78px';
  const esPin = categoria => /pin/i.test(categoria || '');
  const esSticker = categoria => /stic?ker|stiker/i.test(categoria || '');
  const redondear = x => Math.round(x * 10000) / 10000;

  // Opciones del selector de tipo: los tipos de producto + las categorías que no tengan ninguno.
  const opcionesDeTipo = () => {
    const tipos = db.all('tipos'), categorias = CC.categorias.lista().map(c => c.nombre);
    const cubiertas = new Set(tipos.map(t => norm(t.categoria)));
    return [
      ...tipos.map(t => ({valor: 't:' + t.id, etiqueta: t.nombre, categoria: t.categoria, tipo: t})),
      ...categorias.filter(c => !cubiertas.has(norm(c))).map(c => ({valor: 'c:' + c, etiqueta: c, categoria: c, tipo: null}))
    ];
  };

  // Una fila de captura: Tipo · Diseño · Cantidad · Precio · Costo.
  const filaHtml = (opciones, pre = {}) => `
    <div class="av-fila" style="display:grid;grid-template-columns:${COLUMNAS};gap:6px;margin-bottom:6px">
      <select class="inp av-tipo">${opciones.map(o => `<option value="${E(o.valor)}" ${o.valor === pre.tipo ? 'selected' : ''}>${E(o.etiqueta)}</option>`).join('')}</select>
      <input class="inp av-nombre" placeholder="Nombre del diseño" value="${E(pre.nombre || '')}">
      <input class="inp av-cant" type="number" min="0" step="1" placeholder="Cant." value="${pre.cant ?? ''}">
      <input class="inp av-precio" type="number" min="0" step="0.01" placeholder="Precio" value="${pre.precio ?? ''}">
      <input class="inp av-costo" type="number" min="0" step="0.01" placeholder="Costo" value="${pre.costo ?? ''}">
    </div>`;

  function abrir(temaId = '') {
    const opciones = opcionesDeTipo();
    if (!opciones.length) return ui.toast('Primero crea una categoría (Inventario → ⚙️ Categorías) o un tipo de producto (Ajustes)');
    const temas = db.all('temas').slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const inicial = (opciones.find(o => esPin(o.categoria)) || opciones[0]).valor;
    const seleccion = temaId && db.get('temas', temaId) ? temaId : (temas.length ? temas[0].id : NUEVO);
    const hayMateriales = db.all('tipos').some(t => CC.consumoTipo(t).length);

    ui.modal('Agregar varios al inventario', `
      <p class="mute">Escribe tus diseños uno debajo de otro. El tipo, el precio y el costo de la primera fila se copian solos a las siguientes. Con <b>Enter</b> pasas de campo y se crea la siguiente fila.</p>
      <div class="grid2">
        <label>Guardar en el tema
          <select class="inp" name="tema">
            ${temas.map(t => `<option value="${t.id}" ${t.id === seleccion ? 'selected' : ''}>${E(t.nombre)}</option>`).join('')}
            <option value="${NUEVO}" ${seleccion === NUEVO ? 'selected' : ''}>➕ Tema nuevo…</option>
          </select>
        </label>
        <div id="av-nuevo">${ui.inp('temaNuevo', 'Nombre del tema nuevo', '', 'text', 'placeholder="Ej. Gatos, Anime, Espacio"')}</div>
      </div>
      ${ui.inp('variante', 'Variante (opcional, para todos)', '', 'text', 'placeholder="Vacío = usa el nombre del tipo (Mini pin, Pin gigante…)"')}
      ${hayMateriales ? `<label style="display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0;margin-top:8px"><input type="checkbox" name="descontar" checked> Descontar del inventario los materiales que gasta cada tipo (base, empaque…)</label>` : ''}

      <div class="bar" style="margin:10px 0 6px">
        <b style="flex:1">Diseños</b>
        <button type="button" class="btn ghost sm" id="av-pegar">📋 Pegar lista</button>
      </div>
      <div id="av-lista" style="display:none;margin-bottom:10px">
        <textarea class="inp" id="av-texto" rows="5" placeholder="Una línea por diseño:&#10;Gato astronauta, 12, 60, 25&#10;Chibi ramen, 8&#10;&#10;Orden: nombre, cantidad, precio, costo (precio y costo son opcionales: si faltan se calculan con el tipo). También sirve pegar desde Excel."></textarea>
        <button type="button" class="btn sm" id="av-aplicar" style="margin-top:6px">Pasar a la tabla</button>
      </div>

      <div class="av-fila mute" style="display:grid;grid-template-columns:${COLUMNAS};gap:6px;font-size:.72rem;margin-bottom:4px">
        <span>Tipo</span><span>Diseño</span><span>Cantidad</span><span>Precio</span><span>Costo</span>
      </div>
      <div id="av-filas">${Array.from({length: FILAS_INICIALES}, () => filaHtml(opciones, {tipo: inicial})).join('')}</div>
      <div class="bar" style="margin-top:6px">
        <button type="button" class="btn ghost sm" id="av-mas">＋ Agregar fila</button>
        <button type="button" class="btn ghost sm" id="av-mas5">＋ 5 filas</button>
      </div>
      <div class="card" id="av-resumen" style="margin:12px 0 0;font-size:.85rem"></div>`, m => {
      const e = leer();
      if (e.error) { ui.toast(e.error); return false; }
      guardar(e);
    });

    const raiz = document.getElementById('modal'), q = s => raiz.querySelector(s);
    raiz.querySelector('.modal-box').style.maxWidth = '820px';
    const baseClick = raiz.onclick;
    const opcionDe = valor => opciones.find(o => o.valor === valor) || opciones[0];
    const filasActuales = () => [...raiz.querySelectorAll('#av-filas .av-fila')];

    const valoresDe = fila => ({
      tipo: fila.querySelector('.av-tipo').value,
      nombre: fila.querySelector('.av-nombre').value.trim(),
      cant: fila.querySelector('.av-cant').value,
      precio: fila.querySelector('.av-precio').value,
      costo: fila.querySelector('.av-costo').value
    });

    // Con un tipo elegido, el costo sale de sus materiales y el precio es el sugerido
    // (solo si esos campos no los has escrito tú).
    const aplicarTipo = fila => {
      const tipo = opcionDe(fila.querySelector('.av-tipo').value).tipo;
      if (!tipo) return;
      const costoInput = fila.querySelector('.av-costo'), precioInput = fila.querySelector('.av-precio');
      const costo = CC.costoTipo(tipo);
      if (!costoInput.dataset.tocado) costoInput.value = costo || '';
      if (!precioInput.dataset.tocado) precioInput.value = CC.precioSugerido(+costoInput.value || costo) || '';
    };

    // Agrega una fila al final copiando tipo, precio y costo de la anterior (sin marcarlos como editados).
    const agregarFila = (extra = {}) => {
      const todas = filasActuales();
      const ultima = todas.length ? valoresDe(todas[todas.length - 1]) : {tipo: inicial};
      q('#av-filas').insertAdjacentHTML('beforeend', filaHtml(opciones, {tipo: ultima.tipo, precio: ultima.precio, costo: ultima.costo, ...extra}));
      return q('#av-filas').lastElementChild;
    };

    // Lee y valida todo el formulario.
    function leer() {
      const nuevo = q('[name=tema]').value === NUEVO;
      const nombreTema = q('[name=temaNuevo]').value.trim();
      const tema = nuevo ? null : db.get('temas', q('[name=tema]').value);
      const variante = q('[name=variante]').value.trim();
      const descontar = !!(q('[name=descontar]') && q('[name=descontar]').checked);
      const capturadas = filasActuales().map(valoresDe).filter(f => f.nombre || f.cant !== '');
      let error = '';

      if (nuevo && !nombreTema) error = 'Escribe el nombre del tema nuevo.';
      else if (nuevo && db.all('temas').some(t => norm(t.nombre) === norm(nombreTema))) error = `Ya existe el tema "${nombreTema}": elígelo en la lista.`;
      else if (!capturadas.length) error = 'Escribe al menos un diseño.';

      const items = capturadas.map(f => {
        const o = opcionDe(f.tipo), costo = +f.costo || (o.tipo ? CC.costoTipo(o.tipo) : 0);
        return {
          categoria: o.categoria, tipo: o.tipo, nombre: f.nombre, cant: Math.floor(+f.cant || 0),
          costo, precio: +f.precio || (o.tipo ? (CC.precioSugerido(costo) || 0) : 0)
        };
      });

      // Materiales que se gastarán (cantidad por pieza × piezas) contra lo que hay en inventario.
      const necesidad = new Map();
      if (descontar) items.forEach(i => { if (i.tipo && i.cant > 0) CC.consumoTipo(i.tipo).forEach(c => necesidad.set(c.materialId, (necesidad.get(c.materialId) || 0) + c.cant * i.cant)); });
      const materiales = [...necesidad].map(([id, necesita]) => ({m: db.get('materiales', id), necesita: redondear(necesita)})).filter(x => x.m);
      const faltantes = materiales.filter(x => x.necesita > x.m.stock);

      if (!error) {
        const sinNombre = items.find(i => !i.nombre);
        const negativo = items.find(i => i.cant < 0 || i.precio < 0 || i.costo < 0);
        const llaves = items.map(i => norm(i.categoria) + '|' + norm(i.nombre) + '|' + (i.tipo ? i.tipo.id : ''));
        const repetida = llaves.findIndex((k, idx) => llaves.indexOf(k) !== idx);
        if (sinNombre) error = 'A una fila con cantidad le falta el nombre del diseño.';
        else if (negativo) error = 'Cantidad, precio y costo no pueden ser negativos.';
        else if (repetida >= 0) error = `"${items[repetida].nombre}" está repetido con el mismo tipo: junta sus cantidades en una sola fila.`;
        else if (tema) {
          const choque = items.find(i => (tema.tipo === 'Pines' && esSticker(i.categoria)) || (tema.tipo === 'Stickers' && esPin(i.categoria)));
          if (choque) error = `El tema "${tema.nombre}" es solo de ${tema.tipo.toLowerCase()}. Edítalo y cámbialo a «Ambos» para agregar "${choque.nombre}".`;
        }
        if (!error && faltantes.length) {
          error = 'Falta material: ' + faltantes.map(x => `${x.m.nombre} (necesitas ${+x.necesita.toFixed(2)}, hay ${x.m.stock})`).join('; ') + '. Agrega material o desmarca «Descontar».';
        }
      }
      return {error, nuevo, nombreTema, tema, variante, items, materiales, descontar};
    }

    function guardar({nuevo, nombreTema, tema, variante, items, materiales, descontar}) {
      const copia = JSON.stringify(db.crudo());
      const destino = nuevo ? db.add('temas', {nombre: nombreTema, tipo: 'Ambos', notas: '', imagen: ''}) : tema;
      let nuevos = 0, existentes = 0, piezas = 0;

      items.forEach(i => {
        // Si ya existe un producto con ese nombre y categoría, se le suma el stock en vez de duplicarlo.
        let producto = db.all('productos').find(p => norm(p.producto) === norm(i.nombre) && norm(p.categoria) === norm(i.categoria));
        if (producto) existentes++;
        else {
          producto = db.add('productos', {producto: i.nombre, categoria: i.categoria, coleccion: destino.nombre, etiquetas: [], porConfirmar: false});
          nuevos++;
        }
        // La variante es la que escribiste o, si la dejaste vacía, el nombre del tipo (Mini pin, Pin gigante…).
        const nombreVariante = variante || (i.tipo ? i.tipo.nombre : '');
        const variantes = db.all('variantes').filter(v => v.productoId === producto.id);
        let v = variantes.find(x => norm(x.nombre) === norm(nombreVariante)) || (!nombreVariante && variantes.length === 1 ? variantes[0] : null);
        if (!v) {
          v = db.add('variantes', {productoId: producto.id, nombre: nombreVariante, sku: '', tipoId: i.tipo ? i.tipo.id : '', costo: i.costo, precio: i.precio, minimo: 0, extra: 0, escCant: 0, escTotal: 0, receta: []});
        } else {
          if (!v.precio && i.precio) db.update('variantes', v.id, {precio: i.precio});
          if (!v.costo && i.costo) db.update('variantes', v.id, {costo: i.costo});
          if (!v.tipoId && i.tipo) db.update('variantes', v.id, {tipoId: i.tipo.id});
        }
        if (i.cant > 0) { CC.mover(v.id, i.cant, 'entrada', 'Alta rápida · ' + destino.nombre); piezas += i.cant; }
      });

      if (descontar) materiales.forEach(x => db.update('materiales', x.m.id, {stock: Math.max(0, redondear(x.m.stock - x.necesita))}));

      ui.deshacer(`Agregado a «${destino.nombre}»: ${nuevos} nuevo(s)${existentes ? `, ${existentes} ya existía(n) y se les sumó stock` : ''} · ${piezas} pieza(s)${descontar && materiales.length ? ` · ${materiales.length} material(es) descontado(s)` : ''}.`, copia);
      CC.router.show();
    }

    const resumen = () => {
      const e = leer();
      const usados = e.materiales.length && !e.error
        ? `<div class="mute" style="margin-top:4px">Se descontarán: ${e.materiales.map(x => `${E(x.m.nombre)} ${+x.necesita.toFixed(2)} (quedan ${+(x.m.stock - x.necesita).toFixed(2)})`).join(' · ')}</div>` : '';
      q('#av-resumen').innerHTML = e.error
        ? `<span class="neg">${E(e.error)}</span>`
        : `<b>${e.items.length}</b> diseño(s) · <b>${e.items.reduce((s, i) => s + i.cant, 0)}</b> pieza(s) → tema <b>${E(e.nuevo ? e.nombreTema : e.tema.nombre)}</b>${usados}`;
    };

    const alternarTemaNuevo = () => { q('#av-nuevo').style.display = q('[name=tema]').value === NUEVO ? '' : 'none'; };

    // Copia lo que escribes hacia las filas de abajo que aún no has tocado.
    const propagar = e => {
      const campo = ['av-tipo', 'av-precio', 'av-costo'].find(c => e.target.classList.contains(c));
      if (!campo) return;
      e.target.dataset.tocado = '1';
      const todas = filasActuales(), fila = e.target.closest('.av-fila'), siguientes = todas.slice(todas.indexOf(fila) + 1);
      if (campo === 'av-tipo') {
        siguientes.forEach(f => { const t = f.querySelector('.av-tipo'); if (!t.dataset.tocado) t.value = e.target.value; });
        [fila, ...siguientes].forEach(aplicarTipo);
        return;
      }
      // Si cambias el costo a mano, el precio sugerido de esa fila se actualiza si no lo has tocado.
      siguientes.forEach(f => { const destino = f.querySelector('.' + campo); if (!destino.dataset.tocado) destino.value = e.target.value; });
      if (campo === 'av-costo') {
        const precio = fila.querySelector('.av-precio');
        if (!precio.dataset.tocado && opcionDe(fila.querySelector('.av-tipo').value).tipo) precio.value = CC.precioSugerido(+e.target.value) || '';
      }
    };

    raiz.oninput = raiz.onchange = e => { propagar(e); alternarTemaNuevo(); resumen(); };

    // Enter: diseño → cantidad → diseño de la siguiente fila (la crea si hace falta).
    raiz.onkeydown = e => {
      if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || e.target.type === 'checkbox') return;
      e.preventDefault();
      const fila = e.target.closest('.av-fila');
      if (!fila) return;
      if (e.target.classList.contains('av-nombre')) fila.querySelector('.av-cant').focus();
      else if (e.target.classList.contains('av-cant')) {
        const sig = fila.nextElementSibling || agregarFila();
        sig.querySelector('.av-nombre').focus();
      }
    };

    raiz.onclick = e => {
      const b = e.target.closest('button');
      if (!b) return baseClick(e);
      if (b.id === 'av-mas') agregarFila().querySelector('.av-nombre').focus();
      else if (b.id === 'av-mas5') { for (let i = 0; i < 5; i++) agregarFila(); resumen(); }
      else if (b.id === 'av-pegar') q('#av-lista').style.display = q('#av-lista').style.display === 'none' ? '' : 'none';
      else if (b.id === 'av-aplicar') pasarLista();
      else return baseClick(e);
    };

    // «Nombre, cantidad, precio, costo» por línea (separa con coma, punto y coma o tabulador).
    function pasarLista() {
      const lineas = q('#av-texto').value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (!lineas.length) return ui.toast('Pega o escribe al menos una línea');
      lineas.forEach(linea => {
        const [nombre, cant, precio, costo] = linea.split(/\t|;|,/).map(x => x.trim());
        const vacia = filasActuales().find(f => !f.querySelector('.av-nombre').value.trim() && f.querySelector('.av-cant').value === '');
        const fila = vacia || agregarFila();
        fila.querySelector('.av-nombre').value = nombre || '';
        fila.querySelector('.av-cant').value = cant || '';
        if (costo) { fila.querySelector('.av-costo').value = costo; fila.querySelector('.av-costo').dataset.tocado = '1'; }
        if (precio) { fila.querySelector('.av-precio').value = precio; fila.querySelector('.av-precio').dataset.tocado = '1'; }
        aplicarTipo(fila);
      });
      q('#av-texto').value = '';
      q('#av-lista').style.display = 'none';
      resumen();
    }

    filasActuales().forEach(aplicarTipo);
    alternarTemaNuevo();
    resumen();
    q('#av-filas .av-nombre').focus();
  }

  CC.agregarVarios = abrir;
})();