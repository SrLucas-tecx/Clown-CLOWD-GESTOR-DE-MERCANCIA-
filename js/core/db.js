// Base de datos local (localStorage). Cada registro: id único, creado, editado, eliminado (borrado lógico).
window.CC = { schema: 1 };
CC.db = (() => {
  const KEY = 'clowncloud:v1';
  const vacio = () => ({ schema: 1, productos: [], variantes: [], movimientos: [], ventas: [], eventos: [], gastos: [], etiquetas: [], clientes: [], materiales: [] });
  let data; try { data = { ...vacio(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch (e) { data = vacio(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { CC.ui.toast('No se pudo guardar'); } };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const now = () => new Date().toISOString();
  const api = {
    all: t => data[t].filter(r => !r.eliminado),
    get: (t, id) => data[t].find(r => r.id === id),
    add(t, r) { r = { ...r, id: uid(), creado: now(), editado: now(), eliminado: false }; data[t].push(r); save(); return r; },
    update(t, id, p) { Object.assign(api.get(t, id), p, { editado: now() }); save(); },
    remove: (t, id) => api.update(t, id, { eliminado: true }),
    exportar: () => JSON.stringify(data),
    importar(json) { const d = JSON.parse(json); if (!d.schema) throw new Error('Archivo inválido'); data = { ...vacio(), ...d }; save(); }
  };
  return api;
})();
