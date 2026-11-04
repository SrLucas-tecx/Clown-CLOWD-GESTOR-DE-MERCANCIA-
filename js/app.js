// Arranque: altura de la barra superior, accesos rápidos, atajos y primera pantalla.
const $ = id => document.getElementById(id);

// La barra superior es fija: su altura se guarda en --topbar-h para que
// los elementos pegajosos (buscador de Venta, ticket) queden justo debajo.
const barra = $('topbar');
const medirBarra = () => document.documentElement.style.setProperty('--topbar-h', barra.offsetHeight + 'px');
medirBarra();
window.addEventListener('resize', medirBarra);
if (window.ResizeObserver)
  new ResizeObserver(medirBarra).observe(barra);

$('mb').onclick = () => CC.bazar.abrir();
$('cq').onclick = () => CC.interes.registrar();
$('cta').onclick = () => {
  location.hash = 'ventas';
};

// Escape cierra la ventana abierta o, si no hay, el Modo bazar.
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape')
    return;
  if ($('modal').classList.contains('open'))
    $('modal').classList.remove('open');
  else
    CC.bazar.cerrar();
});

CC.colores.aplicar();
CC.semilla.inicial();
CC.router.start();
