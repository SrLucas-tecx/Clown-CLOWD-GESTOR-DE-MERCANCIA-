// Base de datos local (localStorage). Cada registro: id único, creado, editado, eliminado (borrado lógico).
window.CC = { schema: 1 };
CC.db = (() => {
  const KEY = 'clowncloud:v1';
  const vacio = () => ({
    schema: 1,
    productos: [],
    variantes: [],
    movimientos: [],
    ventas: [],
    eventos: [],
    gastos: [],
    etiquetas: [],
    clientes: [],
    materiales: [],
    temas: [],
    compras: [],
    categorias: [],
    pedidos: [],
    consultas: [],
    combos: [],
    maletas: []
  });
  let data;
  try {
    data = {
      ...vacio(),
      ...JSON.parse(localStorage.getItem(KEY))
    };
  } catch (e) {
    data = vacio();
  }
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      CC.ui.toast('No se pudo guardar');
    }
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const now = () => new Date().toISOString();
  const api = {
    all: t => data[t].filter(r => !r.eliminado),
    get: (t, id) => data[t].find(r => r.id === id),
    add(t, r) {
      r = {
        ...r,
        id: uid(),
        creado: now(),
        editado: now(),
        eliminado: false
      };
      data[t].push(r);
      save();
      return r;
    },
    update(t, id, p) {
      Object.assign(api.get(t, id), p, { editado: now() });
      save();
    },
    remove: (t, id) => api.update(t, id, { eliminado: true }),
    crudo: () => data,
    reemplazar(d) {
      data = {
        ...vacio(),
        ...d
      };
      save();
    },
    vaciar() {
      data = vacio();
      save();
    },
    // Agrega lo que falta; si el registro existe en ambos lados, gana el editado más recientemente.
    combinar(d, aplicar) {
      let nuevos = 0, difieren = 0;
      Object.keys(vacio()).forEach(t => {
        if (!Array.isArray(d[t]))
          return;
        const ya = new Map(data[t].map(r => [
          r.id,
          r
        ]));
        d[t].forEach(r => {
          if (!r || !r.id)
            return;
          const x = ya.get(r.id);
          if (!x) {
            nuevos++;
            if (aplicar)
              data[t].push(JSON.parse(JSON.stringify(r)));
          } else if ((x.editado || '') < (r.editado || '')) {
            difieren++;
            if (aplicar)
              Object.assign(x, r);
          }
        });
      });
      if (aplicar)
        save();
      return {
        nuevos,
        difieren
      };
    },
    exportar: () => JSON.stringify(data),
    importar(json) {
      const d = JSON.parse(json);
      if (!d.schema)
        throw new Error('Archivo inválido');
      data = {
        ...vacio(),
        ...d
      };
      save();
    }
  };
  return api;
})();
