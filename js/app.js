// Arranque: menú móvil, atajos y primera pantalla.
const $ = id => document.getElementById(id);
const lateral = () => { $('side').classList.toggle('open'); $('ov').classList.toggle('open'); };
$('menu').onclick = lateral; $('ov').onclick = lateral;
$('cta').onclick = () => { location.hash = 'ventas'; };
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('modal').classList.remove('open'); });
CC.colores.aplicar();
CC.semilla.inicial();
CC.router.start();
