# Clientes y assets del sitio actual

Extraído de antidotocolombia.com (build del 13/01/2026) el 30/09/2026. Los logos están en `clientes/`, renombrados con el nombre de la marca.

## Clientes (18 logos)

| Cliente | Sector | Archivo | Archivo original |
|---|---|---|---|
| Enel | Energía | `enel.png` | client2.png |
| Claro | Telecomunicaciones | `claro.png` | client18.png |
| WOM | Telecomunicaciones | `wom.png` | client10.png |
| Stanley Black & Decker | Industria y herramientas | `stanley-black-decker.png` | client11.png |
| Howden | Industria (ventilación y compresión) | `howden.png` | client17.png |
| Seguros Bolívar | Seguros | `seguros-bolivar.png` | client13.png |
| Gallagher | Seguros y corretaje | `gallagher.png` | client15.png |
| Correcol | Seguros y corretaje | `correcol.png` | client12.png |
| Cruz Verde | Salud y farmacia | `cruz-verde.png` | client16.png |
| WSP | Ingeniería | `wsp.png` | client4.png |
| MAB Ingeniería de Valor | Ingeniería | `mab-ingenieria.png` | client8.png |
| SGIN (Servicio Global de Ingeniería) | Ingeniería | `sgin.png` | client6.png |
| Tabasco OC | Ingeniería y construcción | `tabasco-oc.png` | client7.png |
| SEQ Consultores | Consultoría SST y HSEQ | `seq-consultores.png` | client5.png |
| HSEQ Consultores (Asesst) | Consultoría SST y HSEQ | `hseq-consultores.png` | client19.png |
| Bogotá Móvil | Transporte | `bogota-movil.png` | client1.png |
| Capital Bus | Transporte | `capital-bus.png` | client3.png |
| La Lorenza | Turismo y hospitalidad (Villa de Leyva) | `la-lorenza.png` | client14.png |

**Lectura para el diseño:** 11 de los 18 son de energía, ingeniería, transporte, seguros o consultoría SST. Confirma el ángulo "SST, inducciones y planes de emergencia con creatividad". Hay marcas grandes (Enel, Claro, Stanley Black & Decker, Seguros Bolívar, Gallagher, Cruz Verde, Howden) que conviene poner primero en la franja de logos.

**Problemas en los archivos:**
- Logos en PNG de 68 a 319 px, con fondo blanco y márgenes distintos. Para el rediseño hay que conseguir versiones vectoriales (SVG) o PNG a 2x, y pasarlas a monocromo con el mismo alto óptico.
- En el código, 10 logos tienen `name` como nombre y `alt`. "Servicio Global" es en realidad SGIN.
- Enel, Claro, Stanley Black & Decker y otras marcas tienen reglas de uso de logo. Confirmar con el cliente que tiene autorización para mostrarlos.

## Testimonios actuales

El sitio muestra 9 testimonios. Ninguno tiene empresa, solo nombre y cargo, y la imagen de cada uno es un logo de cliente asignado en orden (Laura Torres con Bogotá Móvil, Julián Ramírez con Enel, etc.), no una relación confirmada. "Andrés Pardo" y "Santiago Vargas" comparten el mismo logo. **No usar en el nuevo sitio hasta validarlos con el cliente**: nombre, cargo, empresa y autorización.

## Fotos (`fotos/`)

| Archivo | Contenido | Servicio |
|---|---|---|
| foto-1 | Taller con piezas de construcción y gafas de realidad virtual, al aire libre | Formaciones |
| foto-2 | Equipo sirviendo un buffet de catering con flores | Catering |
| foto-3 | Grupo posando con una construcción de piezas en una sala | Formaciones |
| foto-4 | Mesa de pasabocas con vista a los cerros de Bogotá | Catering |
| foto-5 | Grupo grande al aire libre | Formaciones |
| foto-6 | Figura de piezas de construcción en primer plano | Formaciones |
| foto-7 | Pantalla "Bienvenidos a un espacio diferente" y cajas de piezas | Formaciones |
| foto-8 | Grabación al aire libre con cámara y luz | Audiovisual |
| foto-9 | Equipo con bandera de Colombia y maqueta de piezas | Formaciones |
| foto-10 | Plato servido, primer plano | Catering |
| foto-11 | Montaje de mesa con jugo y flores | Catering |

Fotos de celular en JPG (950 a 1600 px). Sirven para el sitio con buena compresión, pero no para un hero a pantalla completa en desktop. Falta material de **diseño de productos y experiencias** y casi no hay de **producción audiovisual** (solo foto-8).

## Pendientes

- [ ] Foto de la fundadora: hoy está en un Supabase de otro proyecto (`elevarte_imgs/paula.jpeg`), bloqueado desde este entorno. Pedirla al cliente en alta resolución.
- [ ] Logo en `antidoto.png` o SVG limpio (el `logo/antidoto.svg` tiene un lienzo de 3840x2160).
- [ ] Video `hero.mp4` (9 MB): no se guarda en el repo; recomprimir según la auditoría §2.
- [ ] Fotos de trabajos de audiovisual y de diseño de productos.
