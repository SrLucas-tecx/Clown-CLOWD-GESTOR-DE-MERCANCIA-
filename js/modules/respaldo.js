// Respaldo manual: descargar y restaurar todos los datos en un archivo JSON.
(() => {
  const { db, ui } = CC;
  CC.router.register('respaldo', 'Respaldo', '💾', el => {
    el.innerHTML = `<div class="card"><h3>Copia de seguridad</h3><p class="mute">Tus datos viven en este dispositivo. Descarga una copia con frecuencia, sobre todo antes de cada bazar.</p>
      <button class="btn" id="exp">Descargar respaldo</button></div>
      <div class="card"><h3>Restaurar</h3><p class="mute">Reemplaza los datos actuales por los del archivo.</p><input type="file" accept=".json" id="imp"></div>`;
    el.querySelector('#exp').onclick = () => { const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([db.exportar()], { type: 'application/json' })); a.download = `clowncloud-${ui.hoy()}.json`; a.click(); };
    el.querySelector('#imp').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader();
      r.onload = () => { try { db.importar(r.result); ui.toast('Datos restaurados'); CC.router.show(); } catch (x) { ui.toast('Archivo no válido'); } }; r.readAsText(f); };
  });
})();
