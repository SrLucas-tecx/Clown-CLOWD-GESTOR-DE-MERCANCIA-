// Alta rápida: agrega VARIOS pines y stickers de golpe a un tema, sin capturar movimientos.
// El stock inicial se registra solo; aquí solo escribes diseño, cantidad, precio y costo.
(() => {
  const {db, ui} = CC;
  const E = ui.esc, $ = ui.money;
  const norm = s => String(s || '').trim().toLowerCase();
  const NUEVO = '__nuevo__';
  const FILAS_INICIALES = 6;
  const esPin = categoria => /pin/i.test(categoria || '');
  const esSticker = categoria => /stic?ker|stiker/i.test(categoria || '');

  // Una fila de captura: Tipo · Diseño · Cantidad · Precio · Costo.
  const filaHtml = (tipos, pre = {}) => `
    <div class="av-fila" style="display:grid;grid-template-columns:110px 1fr 76px 84px 84px;gap:6px;margin-bottom:6px">
      <select class="inp av-tipo">${tipos.map(t => `<option ${t === pre.tipo ? 'selected' : ''}>${E(t)}</option>`).join('')}</select>
      <input class="inp av-nombre" placeholder="Nombre del diseño" value="${E(pre.nombre || '')}">
      <input class="inp av-cant" type="number" min="0" step="1" placeholder="Cant." value="${pre.cant ?? ''}">
      <input class="inp av-precio" type="number" min="0" step="0.01" placeholder="Precio" value="${pre.precio ?? ''}">
      <input class="inp av-costo" type="number" min="0" step="0.01" placeholder="Costo" value="${pre.costo ?? ''}">
    </div>`;

  function abrir(temaId = '') {
    const tipos = CC.categorias.lista().map(c => c.nombre);
    if (!tipos.length) return ui.toast('Primero crea una categoría (Inventario → ⚙️ Categorías)');
    const temas = db.all('temas').slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const tipoInicial = tipos.find(t => esPin(t)) || tipos[0];
    const seleccion = temaId && db.get('temas', temaId) ? temaId : (temas.length ? temas[0].id : NUEVO);

    ui.modal('Agregar varios al inventario', `
      <p class="mute">Escribe tus diseños uno debajo de otro. El precio, el costo y el tipo de la primera fila se copian solos a las siguientes. Con <b>Enter</b> pasas de campo y se crea la siguiente fila.</p>
      <div class="grid2">
        <label>Guardar en el tema
          <select class="inp" name="tema">
            ${temas.map(t => `<option value="${t.id}" ${t.id === seleccion ? 'selected' : ''}>${E(t.nombre)}</option>`).join('')}
            <option value="${NUEVO}" ${seleccion === NUEVO ? 'selected' : ''}>➕ Tema nuevo…</option>
          </select>
        </label>
        <div id="av-nuevo">${ui.inp('temaNuevo', 'Nombre del tema nuevo', '', 'text', 'placeholder="Ej. Gatos, Anime, Espacio"')}</div>
      </div>
      ${ui.inp('variante', 'Variante (opcional, para todos)', '', 'text', 'placeholder="Ej. 1.5&quot; epoxi — déjalo vacío si no aplica"')}

      <div class="bar" style="margin:10px 0 6px">
        <b style="flex:1">Diseños</b>
        <button type="button" class="btn ghost sm" id="av-pegar">📋 Pegar lista</button>
      </div>
      <div id="av-lista" style="display:none;margin-bottom:10px">
        <textarea class="inp" id="av-texto" rows="5" placeholder="Una línea por diseño:&#10;Gato astronauta, 12, 60, 25&#10;Chibi ramen, 8&#10;&#10;Orden: nombre, cantidad, precio, costo (precio y costo son opcionales). También sirve pegar desde Excel."></textarea>
        <button type="button" class="btn sm" id="av-aplicar" style="margin-top:6px">Pasar a la tabla</button>
      </div>

      <div class="av-fila mute" style="display:grid;grid-template-columns:110px 1fr 76px 84px 84px;gap:6px;font-size:.72rem;margin-bottom:4px">
        <span>Tipo</span><span>Diseño</span><span>Cantidad</span><span>Precio</span><span>Costo</span>
      </div>
      <div id="av-filas">${Array.from({length: FILAS_INICIALES}, () => filaHtml(tipos, {tipo: tipoInicial})).join('')}</div>
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
    raiz.querySelector('.modal-box').style.maxWidth = '760px';
    const baseClick = raiz.onclick;

    const filas = () => [...raiz.querySelectorAll('.av-fila[data-fila], #av-filas .av-fila')];
    const valoresDe = fila => ({
      tipo: fila.querySelector('.av-tipo').value,
      nombre: fila.querySelector('.av-nombre').value.trim(),
      cant: fila.querySelector('.av-cant').value,
      precio: fila.querySelector('.av-precio').value,
      costo: fila.querySelector('.av-costo').value
    });

    // Agrega una fila al final copiando tipo, precio y costo de la anterior (sin marcarlos como editados).
    const agregarFila = (extra = {}) => {
      const todas = [...raiz.querySelectorAll('#av-filas .av-fila')];
      const ultima = todas.length ? valoresDe(todas[todas.length - 1]) : {tipo: tipoInicial};
      q('#av-filas').insertAdjacentHTML('beforeend', filaHtml(tipos, {tipo: ultima.tipo, precio: ultima.precio, costo: ultima.costo, ...extra}));
      return q('#av-filas').lastElementChild;
    };

    // Lee y valida todo el formulario.
    function leer() {
      const nuevo = q('[name=tema]').value === NUEVO;
      const nombreTema = q('[name=temaNuevo]').value.trim();
      const tema = nuevo ? null : db.get('temas', q('[name=tema]').value);
      const variante = q('[name=variante]').value.trim();
      const capturadas = [...raiz.querySelectorAll('#av-filas .av-fila')].map(valoresDe)
        .filter(f => f.nombre || f.cant !== '');
      let error = '';

      if (nuevo && !nombreTema) error = 'Escribe el nombre del tema nuevo.';
      else if (nuevo && db.all('temas').some(t => norm(t.nombre) === norm(nombreTema))) error = `Ya existe el tema "${nombreTema}": elígelo en la lista.`;
      else if (!capturadas.length) error = 'Escribe al menos un diseño.';

      const items = capturadas.map(f => ({tipo: f.tipo, nombre: f.nombre, cant: Math.floor(+f.cant || 0), precio: +f.precio || 0, costo: +f.costo || 0}));
      if (!error) {
        const sinNombre = items.find(i => !i.nombre);
        const negativo = items.find(i => +i.cant < 0 || i.precio < 0 || i.costo < 0);
        const llaves = items.map(i => norm(i.tipo) + '|' + norm(i.nombre));
        const repetida = llaves.findIndex((k, idx) => llaves.indexOf(k) !== idx);
        if (sinNombre) error = 'A una fila con cantidad le falta el nombre del diseño.';
        else if (negativo) error = 'Cantidad, precio y costo no pueden ser negativos.';
        else if (repetida >= 0) error = `"${items[repetida].nombre}" está repetido: junta sus cantidades en una sola fila.`;
        else if (tema) {
          const choque = items.find(i => (tema.tipo === 'Pines' && esSticker(i.tipo)) || (tema.tipo === 'Stickers' && esPin(i.tipo)));
          if (choque) error = `El tema "${tema.nombre}" es solo de ${tema.tipo.toLowerCase()}. Edítalo y cámbialo a «Ambos» para agregar "${choque.nombre}".`;
        }
      }
      return {error, nuevo, nombreTema, tema, variante, items};
    }

    function guardar({nuevo, nombreTema, tema, variante, items}) {
      const copia = JSON.stringify(db.crudo());
      const destino = nuevo ? db.add('temas', {nombre: nombreTema, tipo: 'Ambos', notas: '', imagen: ''}) : tema;
      let nuevos = 0, existentes = 0, piezas = 0;

      items.forEach(i => {
        // Si ya existe un producto con ese nombre y tipo, se le suma el stock en vez de duplicarlo.
        let producto = db.all('productos').find(p => norm(p.producto) === norm(i.nombre) && norm(p.categoria) === norm(i.tipo));
        if (producto) existentes++;
        else {
          producto = db.add('productos', {producto: i.nombre, categoria: i.tipo, coleccion: destino.nombre, etiquetas: [], porConfirmar: false});
          nuevos++;
        }
        const variantes = db.all('variantes').filter(v => v.productoId === producto.id);
        let v = variantes.find(x => norm(x.nombre) === norm(variante)) || (!variante && variantes.length === 1 ? variantes[0] : null);
        if (!v) {
          v = db.add('variantes', {productoId: producto.id, nombre: variante, sku: '', costo: i.costo, precio: i.precio, minimo: 0, extra: 0, escCant: 0, escTotal: 0, receta: []});
        } else {
          if (!v.precio && i.precio) db.update('variantes', v.id, {precio: i.precio});
          if (!v.costo && i.costo) db.update('variantes', v.id, {costo: i.costo});
        }
        if (i.cant > 0) { CC.mover(v.id, i.cant, 'entrada', 'Alta rápida · ' + destino.nombre); piezas += i.cant; }
      });

      ui.deshacer(`Agregado a «${destino.nombre}»: ${nuevos} nuevo(s)${existentes ? `, ${existentes} ya existía(n) y se les sumó stock` : ''} · ${piezas} pieza(s).`, copia);
      CC.router.show();
    }

    const resumen = () => {
      const e = leer();
      q('#av-resumen').innerHTML = e.error
        ? `<span class="neg">${E(e.error)}</span>`
        : `<b>${e.items.length}</b> diseño(s) · <b>${e.items.reduce((s, i) => s + i.cant, 0)}</b> pieza(s) → tema <b>${E(e.nuevo ? e.nombreTema : e.tema.nombre)}</b>`;
    };

    const alternarTemaNuevo = () => { q('#av-nuevo').style.display = q('[name=tema]').value === NUEVO ? '' : 'none'; };

    // Copia tipo, precio y costo hacia las filas de abajo que el usuario aún no ha tocado.
    const propagar = e => {
      const campo = ['av-tipo', 'av-precio', 'av-costo'].find(c => e.target.classList.contains(c));
      if (!campo) return;
      e.target.dataset.tocado = '1';
      const todas = [...raiz.querySelectorAll('#av-filas .av-fila')];
      todas.slice(todas.indexOf(e.target.closest('.av-fila')) + 1).forEach(fila => {
        const destino = fila.querySelector('.' + campo);
        if (!destino.dataset.tocado) destino.value = e.target.value;
      });
    };

    raiz.oninput = raiz.onchange = e => { propagar(e); alternarTemaNuevo(); resumen(); };

    // Enter: diseño → cantidad → diseño de la siguiente fila (la crea si hace falta).
    raiz.onkeydown = e => {
      if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
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
        const vacia = [...raiz.querySelectorAll('#av-filas .av-fila')].find(f => !f.querySelector('.av-nombre').value.trim() && f.querySelector('.av-cant').value === '');
        const fila = vacia || agregarFila();
        fila.querySelector('.av-nombre').value = nombre || '';
        fila.querySelector('.av-cant').value = cant || '';
        if (precio) fila.querySelector('.av-precio').value = precio;
        if (costo) fila.querySelector('.av-costo').value = costo;
      });
      q('#av-texto').value = '';
      q('#av-lista').style.display = 'none';
      resumen();
    }

    alternarTemaNuevo();
    resumen();
    q('#av-filas .av-nombre').focus();
  }

  CC.agregarVarios = abrir;
})();
