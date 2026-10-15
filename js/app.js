// Arranque: tema claro/oscuro, menú móvil, atajos y primera pantalla.
const $ = id => document.getElementById(id);
if (localStorage.getItem('clowncloud:tema') === 'light') document.body.classList.add('light');
$('tema').onclick = () => { document.body.classList.toggle('light'); localStorage.setItem('clowncloud:tema', document.body.classList.contains('light') ? 'light' : 'dark'); };
const lateral = () => { $('side').classList.toggle('open'); $('ov').classList.toggle('open'); };
$('menu').onclick = lateral; $('ov').onclick = lateral;
$('cta').onclick = () => { location.hash = 'ventas'; };
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('modal').classList.remove('open'); });
CC.router.start();
