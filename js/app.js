// Arranque: menú móvil, atajos y primera pantalla.
const $ = id => document.getElementById(id);
const lateral = () => {
  $('side').classList.toggle('open');
  $('ov').classList.toggle('open');
};
$('menu').onclick = lateral;
$('ov').onclick = lateral;
$('mb').onclick = () => CC.bazar.abrir();
$('cq').onclick = () => CC.interes.registrar();
$('cta').onclick = () => {
  location.hash = 'ventas';
};
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
