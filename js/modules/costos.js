// Calculadoras: costo por lote (con merma) y costo por sticker de una hoja; precio objetivo.
(() => {
  const {ui} = CC, n = x => +x || 0;
  CC.router.register('costos', 'Costos', '🧮', el => {
    el.innerHTML = `<div class="card"><h3>Costo por lote (pines, llaveros…)</h3><div class="grid3">${ui.inp('l_tot', 'Costo del pedido', 100, 'number')}${ui.inp('l_pz', 'Piezas pedidas', 100, 'number')}${ui.inp('l_mer', '% merma', 5, 'number')}</div>
      <div class="grid2">${ui.inp('l_ext', 'Extras por pieza (broche, tarjeta, bolsa)', 0, 'number', 'step="0.01"')}${ui.inp('l_mg', 'Margen deseado %', 50, 'number')}</div><p id="l_out"></p></div>
      <div class="card"><h3>Hoja de stickers</h3><div class="grid3">${ui.inp('s_hoja', 'Costo por hoja', 10, 'number', 'step="0.01"')}${ui.inp('s_cor', 'Cortes por hoja', 12, 'number')}${ui.inp('s_apr', '% aprovechamiento', 90, 'number')}</div>${ui.inp('s_mg', 'Margen deseado %', 60, 'number')}<p id="s_out"></p></div>`;
    const v = id => n(el.querySelector(`[name=${id}]`).value);
    const out = (id, costo, mg) => {
      const pr = mg < 100 ? costo / (1 - mg / 100) : 0;
      el.querySelector(id).innerHTML = isFinite(costo) ? `Costo por pieza: <b>${ui.money(costo)}</b> · Precio sugerido: <b>${ui.money(pr)}</b>` : 'Revisa los datos.';
    };
    const calc = () => {
      out('#l_out', v('l_tot') / (v('l_pz') * (1 - v('l_mer') / 100)) + v('l_ext'), v('l_mg'));
      out('#s_out', v('s_hoja') / (v('s_cor') * v('s_apr') / 100), v('s_mg'));
    };
    el.oninput = calc;
    calc();
  });
})();
