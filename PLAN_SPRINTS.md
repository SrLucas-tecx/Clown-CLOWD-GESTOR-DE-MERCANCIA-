# CLOWN CLOUD · Plan de sprints

Regla de trabajo: **todo cambio o mejora entra primero al backlog, se asigna a un sprint y se entrega por sprint.**
Cada sprint termina con una versión que funciona completa (zip) y una lista corta de "qué cambió / cómo probarlo".

## Cómo agregar o quitar una función (sin romper el resto)

Cada pantalla es un módulo independiente. Para **agregar** una:

1. Crea `js/modules/<nombre>.js` (se registra con `CC.router.register('<id>', 'Título', '🔹', el => { ... })`).
2. Agrega su `<script>` en `index.html` (sección "Módulos").
3. Agrega su `id` en la sección que le toque dentro de `js/core/router.js` (el orden de la lista define el orden de las pestañas).

Para **quitarla**: borra esas tres cosas (el archivo, el `<script>` y el `id` en `router.js`). Los datos guardados no se pierden.

Las funciones compartidas (`CC.db`, `CC.ui`, `CC.tags`, `CC.categorias`, `CC.pdf`, `CC.excel`) viven en `js/core/`; los módulos se apoyan en ellas, no entre sí.

## Sprint 0 · Base (hecho)

- Código legible en todos los archivos y estructura `js/core` + `js/modules`.
- Responsividad para celular y tablet (`css/responsive.css`).
- PDF corregido (pedidos, lista de precios, etiquetas).
- Paleta nueva: mismos 3 colores base con fondo casi negro (`colores.js`).
- Inventario: **Temas** como primera pestaña y botón **Agregar varios** (pines y stickers por tema, sin movimientos).

## Sprint 1 · Interés rediseñado (hecho)

Archivo: `js/modules/interes.js`

- Formulario: **tema** (de los temas existentes u "otro tema"), **tipo** (Pin · Sticker · Otro + especificar), diseño opcional, veces, **bazar**, fecha, etiquetas y notas.
- Pantalla limpia: consultas totales, más preguntado, temas que no teníamos, etiquetas editables (crear / editar / quitar), ranking con +1 / −1, consultas por etiqueta y últimas consultas con el bazar donde se hicieron.
- Compara lo que preguntan contra lo que se vende por tema y tipo.

Listo cuando: se registra una consulta con tema + tipo + bazar y aparece en el ranking, se puede sumar/restar y filtrar por bazar.

## Sprint 2 · Bazares con detalle (siguiente)

Archivos: `js/modules/eventos.js` (+ `maleta.js`, `caja.js` se integran a la vista).

- Lista "Mis bazares" (nombre, lugar, fecha, total vendido, ganancia real) con botones **Ir al bazar · Editar · Eliminar**.
- Vista de detalle de un bazar: tarjetas de total vendido, ganancia estimada, consultas ligadas, regalado, costo real, ingresos extra y ganancia real.
- **Resumen de mercancía llevada**: unidades llevadas / vendidas / restantes, rotación y valor pendiente.
- **Temas asignados al bazar**, con sus pines y stickers (llevados, vendidos, restantes).
- Sumar y restar mercancía, costos e ingresos **dentro de la misma pantalla** (agregar y quitar sin salir ni recargar).

Listo cuando: desde un bazar se puede asignar temas, ajustar cantidades llevadas y ver el resumen actualizado al instante.

## Sprint 3 · Costo unitario calculado

Archivos: `js/modules/materiales.js`, `js/modules/catalogo.js`, `js/modules/compras.js`.

- Materiales (como el inventario de stickers): se captura **costo total pagado + cantidad** y el **costo por unidad se calcula solo**.
- El costo de cada pin o sticker se recalcula a partir de sus materiales y de lo pagado (con merma y extras).
- Se muestra el costo unitario en tarjetas de inventario y en el detalle del material.

## Backlog (sin asignar)

- Consignaciones, Gastos, Artistas y Proveedores (como en LUCXSTUDIO).
- Gráficas de ventas por fecha en el detalle del bazar.
- Reportes por tema (ventas, interés y ganancia).
- Orden y limpieza visual de Ventas y Negocio.

> Para sumar algo al plan: escríbelo en el backlog y dime en qué sprint lo quieres; si entra, se mueve y se entrega con ese sprint.
