# Home rediseñado de Antídoto: referencia de diseño

Fecha: 2 de octubre de 2026. Complementa `CLAUDE.md`.

## Qué es

`home.html` es el primer pase del home nuevo, exportado del lienzo de diseño. Se abre en el navegador tal cual. Es una **referencia visual y de contenido, no código de producción**: todo el estilo va en línea y hay que pasarlo al sistema del repo.

Lienzo original: https://claude.ai/artifact/YXYCiTzM4VMGfbwPoT17Ay

## Qué cambia frente al front actual

- Base clara (`#FFFFFF` y `#F3F8FA`) con secciones oscuras en `#0F181D`. El front actual es oscuro.
- Palabras resaltadas en los títulos: fondo `#3BC8F3` con texto `#0F181D`.
- Botones y resaltados con texto oscuro sobre cian. El cian no da contraste con texto blanco.
- Texto de color sobre blanco: `#0C5C7D`. Texto secundario: `#4A5A60`.
- Home más largo: 12 bloques en vez de 6.

## Secciones, en orden

1. Navegación con botón Cotizar.
2. Hero con foto a pantalla completa, fundadora, licencia de SST y espacio para el reel.
3. Logos de clientes y franja de cifras.
4. Dolores del comprador: tarjetas en blanco y negro que al pasar el cursor toman color y cambian al texto de la solución (clases `.dolor`, `.pain`, `.sol`, `.tinte`, `.chip` en el `<style>`).
5. Tres pasos de trabajo.
6. Servicios: columna de introducción y una tarjeta ancha por servicio con afiche vertical.
7. Biblioteca de actividades con una pantalla de trivia de ejemplo.
8. Entradas por tipo de comprador, franja de aliados y espacios para caso y testimonios.
9. Equipo: tarjeta destacada de la fundadora y licencia de SST.
10. Preguntas frecuentes con `<details>`.
11. Cierre con cotización.
12. Pie.

## Cómo pasarlo al repo

- Un componente `.astro` por sección, con CSS de alcance local que lea tokens de `src/styles/global.css`. No copies los estilos en línea.
- Agrega a `@theme` los tokens claros que faltan y revisa `color-scheme`, hoy fijo en `dark`.
- Las fotos de `assets/` son copias optimizadas de `marca/fotos/`. En el repo usa los originales con `astro:assets`.
- El logo sale de `src/data/logo.ts` y el componente `Logo.astro`, no de `assets/logo-cian.svg`.
- Las fuentes ya están en `public/fonts/`. Quita el enlace a Google Fonts.
- Cada texto nuevo va en español e inglés en `src/i18n/ui.ts`.
- El cotizador real ya existe en `/contacto/`: los botones de cotizar apuntan allá.
- Mantén las reglas de motion y el presupuesto de rendimiento de `CLAUDE.md`.

## Qué no se publica todavía

- Todo lo que está entre corchetes es un dato que falta del cliente.
- Los textos son borrador: titular, dolores, pasos y descripciones cortas de servicio. Hay que validarlos.
- La tarjeta "Sin evidencia para la auditoría" solo vale si la biblioteca entrega asistencia, evaluación y certificado.
- La pantalla de trivia es ilustrativa. La real sale de la biblioteca de actividades.
- Los logos de clientes necesitan autorización.

## Limitación conocida

El diseño se armó sin ver el resultado renderizado. Revisa espaciados, recortes de fotos y el comportamiento en 390 px antes de darlo por bueno.
