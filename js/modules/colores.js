// Apariencia: 3 colores base (azul, amarillo, rojo). Todas las tonalidades se calculan aquí a partir
// de ellos y se aplican como variables CSS; el fondo usa tonos casi negros con un leve matiz azul.
(() => {
  const {ui} = CC;
  const CLAVE = 'clowncloud:colores';
  const BASE = {azul: '#1a2f61', amarillo: '#ffc933', rojo: '#e3363d'};

  // ---------------------------------------------------------------------------------------------
  // Utilidades de color
  // ---------------------------------------------------------------------------------------------
  const limitar = (n, min, max) => Math.min(max, Math.max(min, n));

  // '#rrggbb' → {h: 0-360, s: 0-100, l: 0-100}
  const hexAHsl = hex => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
    }
    return {h: (h * 60 + 360) % 360, s: s * 100, l: l * 100};
  };

  // {h, s, l} → '#rrggbb'
  const hslAHex = ({h, s, l}) => {
    s = limitar(s, 0, 100) / 100;
    l = limitar(l, 0, 100) / 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  };

  // Luminancia relativa (0 = negro, 1 = blanco) para validar los colores elegidos.
  const luminancia = hex => {
    const [r, g, b] = [1, 3, 5]
      .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(x => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const hexARgba = (hex, alfa) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${alfa})`;
  };

  // ---------------------------------------------------------------------------------------------
  // Paleta derivada de los 3 colores base
  // ---------------------------------------------------------------------------------------------
  const derivar = ({azul, amarillo, rojo}) => {
    const a = hexAHsl(azul), y = hexAHsl(amarillo), r = hexAHsl(rojo);
    const sAzul = limitar(a.s, 25, 70); // saturación del matiz azul de los fondos

    // Fondos: casi negros, con un toque del azul elegido (de más oscuro a más claro).
    const fondo = (luz, factorSat) => hslAHex({h: a.h, s: sAzul * factorSat, l: luz});

    return {
      '--azul-950': fondo(2.5, 0.50),   // fondo hondo (casi negro)
      '--azul-900': fondo(5.5, 0.55),   // fondo de la página
      '--azul-800': fondo(9.5, 0.60),   // tarjetas
      '--azul-700': fondo(14, 0.65),    // campos de texto
      '--azul-600': fondo(22, 0.70),    // bordes
      '--azul-300': fondo(74, 0.80),    // texto suave

      '--amarillo-300': hslAHex({h: y.h, s: y.s, l: limitar(y.l + 22, 0, 88)}), // resaltes claros
      '--amarillo-600': hslAHex({h: y.h, s: y.s, l: limitar(y.l - 12, 0, 100)}), // botón al pasar el cursor

      '--rojo-300': hslAHex({h: r.h, s: r.s, l: limitar(r.l + 18, 0, 85)}), // rojo claro
      '--rojo-600': hslAHex({h: r.h, s: r.s, l: limitar(r.l - 16, 0, 100)}), // rojo oscuro

      '--amarillo-soft': hexARgba(amarillo, 0.14),       // fondos suaves de resalte
      '--color-accent-soft': hexARgba(amarillo, 0.14)
    };
  };

  // ---------------------------------------------------------------------------------------------
  // Guardado y aplicación
  // ---------------------------------------------------------------------------------------------
  const leer = () => {
    try {
      return {...BASE, ...JSON.parse(localStorage.getItem(CLAVE))};
    } catch (e) {
      return {...BASE};
    }
  };

  CC.colores = {
    aplicar() {
      const colores = leer();
      const raiz = document.documentElement.style;
      Object.entries(colores).forEach(([nombre, valor]) => raiz.setProperty('--' + nombre, valor));
      Object.entries(derivar(colores)).forEach(([variable, valor]) => raiz.setProperty(variable, valor));
    }
  };

  // ---------------------------------------------------------------------------------------------
  // Pantalla Ajustes → Apariencia
  // ---------------------------------------------------------------------------------------------
  const REGLAS = {
    azul: [
      hex => luminancia(hex) <= 0.12,
      'No se puede: ese azul es muy claro. La página está pensada para modo oscuro'
    ],
    amarillo: [
      hex => luminancia(hex) >= 0.35,
      'No se puede: ese color de botones es muy oscuro y su texto no se leería'
    ],
    rojo: [
      hex => luminancia(hex) >= 0.06,
      'No se puede: ese rojo es muy oscuro para las pestañas'
    ]
  };

  const TONOS = [
    ['Fondo hondo', '--azul-950'],
    ['Fondo', '--azul-900'],
    ['Tarjetas', '--azul-800'],
    ['Campos', '--azul-700'],
    ['Bordes', '--azul-600'],
    ['Texto suave', '--azul-300'],
    ['Amarillo claro', '--amarillo-300'],
    ['Botones', '--amarillo'],
    ['Botón al pasar', '--amarillo-600'],
    ['Rojo claro', '--rojo-300'],
    ['Pestañas', '--rojo'],
    ['Rojo oscuro', '--rojo-600']
  ];

  CC.router.register('apariencia', 'Apariencia', '🎨', el => {
    const colores = leer();

    const selector = (clave, titulo, descripcion) => `
      <label>${titulo}
        <span class="mute" style="text-transform:none;letter-spacing:0;display:block">${descripcion}</span>
        <input type="color" data-k="${clave}" value="${colores[clave]}"
          style="width:100%;height:46px;margin-top:6px;border:1px solid var(--line);border-radius:10px;background:var(--bg);padding:3px">
      </label>`;

    el.innerHTML = `
      <div class="card">
        <h3>Colores de la interfaz</h3>
        <p class="mute">Elige 3 colores base; el resto de tonos se calcula solo (el fondo se vuelve casi negro con un matiz de tu azul).</p>
        <div class="grid3">
          ${selector('azul', '🔵 Azul', 'Matiz de fondos, tarjetas y bordes')}
          ${selector('amarillo', '🟡 Amarillo', 'Botones y resaltados')}
          ${selector('rojo', '🔴 Rojo', 'Pestañas y selección')}
        </div>
        <div class="bar" style="margin-top:12px">
          <button class="btn" type="button">Botón de ejemplo</button>
          <span class="tab on" style="display:inline-flex;align-items:center">Pestaña activa</span>
          <span class="tab" style="display:inline-flex;align-items:center">Pestaña</span>
          <div style="flex:1"></div>
          <button class="btn ghost" id="rs">Restablecer colores</button>
        </div>
      </div>
      <div class="card">
        <h3>Tonalidades</h3>
        <div class="tono">${TONOS.map(([nombre, variable]) => `<span style="background:var(${variable})">${nombre}</span>`).join('')}</div>
      </div>`;

    el.onchange = e => {
      const clave = e.target.dataset.k;
      if (!clave) return;
      const [esValido, mensaje] = REGLAS[clave];
      if (!esValido(e.target.value)) {
        ui.toast(mensaje);
        return CC.router.show();
      }
      localStorage.setItem(CLAVE, JSON.stringify({...leer(), [clave]: e.target.value}));
      CC.colores.aplicar();
      CC.router.show();
    };

    el.querySelector('#rs').onclick = () => {
      localStorage.removeItem(CLAVE);
      CC.colores.aplicar();
      CC.router.show();
      ui.toast('Colores restablecidos');
    };
  });
})();
