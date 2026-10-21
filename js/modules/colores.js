// Apariencia: 3 colores base (azul, amarillo, rojo); todas las tonalidades se derivan de ellos en css/styles.css.
(() => {
  const {ui} = CC, K = 'clowncloud:colores', DEF = {
      azul: '#1a2f61',
      amarillo: '#ffc933',
      rojo: '#e3363d'
    };
  const leer = () => {
    try {
      return {
        ...DEF,
        ...JSON.parse(localStorage.getItem(K))
      };
    } catch (e) {
      return { ...DEF };
    }
  };
  const lum = h => {
    const [r, g, b] = [
      1,
      3,
      5
    ].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const REGLAS = {
    azul: [
      h => lum(h) <= 0.12,
      'No se puede: ese azul es muy claro. La página está pensada para modo oscuro'
    ],
    amarillo: [
      h => lum(h) >= 0.35,
      'No se puede: ese color de botones es muy oscuro y su texto no se leería'
    ],
    rojo: [
      h => lum(h) >= 0.06,
      'No se puede: ese rojo es muy oscuro para las pestañas'
    ]
  };
  CC.colores = {
    aplicar() {
      Object.entries(leer()).forEach(([k, v]) => document.documentElement.style.setProperty('--' + k, v));
    }
  };
  const TONOS = [
    [
      'Fondo hondo',
      '--azul-950'
    ],
    [
      'Fondo',
      '--azul-900'
    ],
    [
      'Tarjetas',
      '--azul-800'
    ],
    [
      'Campos',
      '--azul-700'
    ],
    [
      'Bordes',
      '--azul-600'
    ],
    [
      'Texto suave',
      '--azul-300'
    ],
    [
      'Amarillo claro',
      '--amarillo-300'
    ],
    [
      'Botones',
      '--amarillo'
    ],
    [
      'Botón al pasar',
      '--amarillo-600'
    ],
    [
      'Rojo claro',
      '--rojo-300'
    ],
    [
      'Pestañas',
      '--rojo'
    ],
    [
      'Rojo oscuro',
      '--rojo-600'
    ]
  ];
  CC.router.register('apariencia', 'Apariencia', '🎨', el => {
    const c = leer(), cam = (k, t, d) => `<label>${t}<span class="mute" style="text-transform:none;letter-spacing:0;display:block">${d}</span><input type="color" data-k="${k}" value="${c[k]}" style="width:100%;height:46px;margin-top:6px;border:1px solid var(--line);border-radius:10px;background:var(--bg);padding:3px"></label>`;
    el.innerHTML = `<div class="card"><h3>Colores de la interfaz</h3><p class="mute">Elige 3 colores base; el resto de tonos se calcula solo.</p>
      <div class="grid3">${cam('azul', '🔵 Azul', 'Fondos, tarjetas y bordes')}${cam('amarillo', '🟡 Amarillo', 'Botones y resaltados')}${cam('rojo', '🔴 Rojo', 'Pestañas y selección')}</div>
      <div class="bar" style="margin-top:12px"><button class="btn" type="button">Botón de ejemplo</button><span class="tab on" style="display:inline-flex;align-items:center">Pestaña activa</span><span class="tab" style="display:inline-flex;align-items:center">Pestaña</span><div style="flex:1"></div><button class="btn ghost" id="rs">Restablecer colores</button></div></div>
      <div class="card"><h3>Tonalidades</h3><div class="tono">${TONOS.map(([n, v]) => `<span style="background:var(${v})">${n}</span>`).join('')}</div></div>`;
    el.onchange = e => {
      const k = e.target.dataset.k;
      if (!k)
        return;
      const [ok, msg] = REGLAS[k];
      if (!ok(e.target.value)) {
        ui.toast(msg);
        return CC.router.show();
      }
      localStorage.setItem(K, JSON.stringify({
        ...leer(),
        [k]: e.target.value
      }));
      CC.colores.aplicar();
      CC.router.show();
    };
    el.querySelector('#rs').onclick = () => {
      localStorage.removeItem(K);
      CC.colores.aplicar();
      CC.router.show();
      ui.toast('Colores restablecidos');
    };
  });
})();
