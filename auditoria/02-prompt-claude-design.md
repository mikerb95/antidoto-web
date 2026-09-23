# Prompt para Claude Design: rediseño de antidotocolombia.com con motion

## Cómo usarlo

1. En Claude Design adjunta: `favicon.svg` (isotipo del frasco), `antidoto.svg`, 4 a 6 fotos del carrusel, la foto de la fundadora, los logos de clientes y 2 capturas del sitio actual (desktop y móvil).
2. Pega el **prompt principal** completo.
3. Después del primer pase, itera por partes con los **prompts de iteración** del final. No pidas cambios globales hasta cerrar hero y sistema.

Decisiones que asumí y puedes cambiar antes de pegarlo: se mantiene one-page (las landings por servicio quedan para fase 2), dark-first con 1 o 2 secciones claras, conversión por WhatsApp con cotizador sin backend, intensidad de motion alta en hero y narrativa pero contenida en el resto.

---

## Prompt principal

```
Eres director/a de arte y motion designer senior. Vas a rediseñar la home one-page de Antídoto (antidotocolombia.com), un estudio creativo empresarial colombiano. Quiero un prototipo interactivo con las animaciones funcionando, en desktop (1440) y móvil (390), pensado para pasarlo a código con React + Tailwind + Motion.

## 1. Contexto de negocio

Qué hacen: cuatro servicios para empresas, colegios, universidades y organizaciones.
1. Formaciones vivenciales: aprender haciendo. Programas participativos con apoyo de IA para fortalecer equipos, cultura, comunicación, orientación vocacional e inclusión. En 3 idiomas (español, portugués e inglés).
2. Producción audiovisual y digital: inducciones, planes de emergencia, capacitaciones y videos institucionales. +150 producciones, calidad 4K, tomas aéreas con dron, estrategias digitales con IA.
3. Catering corporativo: desayunos, refrigerios, almuerzos y estaciones en vivo para eventos empresariales, académicos y sociales. +200 eventos a nivel nacional, logística flexible.
4. Diseño de productos y experiencias: de la idea al producto final. Prototipos, productos funcionales y experiencias a la medida con la identidad de cada marca.

Diferenciador: la fundadora, María Paula Ramos, es ingeniera civil especialista en Gerencia de SST. Muchos clientes son de energía, ingeniería, transporte y seguros (Enel, WSP, Capital Bus, Bogotá Móvil, Seguros Bolívar, Gallagher, Claro, WOM, Stanley Black & Decker, HSEQ, SEQ Consultores, Correcol, MAB Ingeniería). El ángulo "SST, inducciones y planes de emergencia hechos con creatividad" tiene que notarse.

Público: líderes de talento humano, SST/HSEQ, comunicaciones internas y bienestar; rectores y coordinadores académicos.

Conversión, en este orden: 1) cotización por WhatsApp (+57 312 556 8016), 2) correo para propuestas formales (antidoto.colombia@outlook.com), 3) Instagram @antidoto.colombia y LinkedIn como prueba social.

Historia: 2020 idea emergente (startup), 2021 transformación del modelo, 2023 consolidación en el mercado colombiano, hoy estudio creativo empresarial.

Cifras dadas por el cliente: +150 producciones, +200 eventos, +50 clientes, 3 idiomas, desde 2020.

## 2. Qué falla hoy (no lo repitas)

- El hero es distinto en desktop y en móvil; en móvil el titular está incrustado en un reel vertical de 9 MB.
- Servicios sin una sola imagen del trabajo; datos con emojis.
- Glow cian y bordes neón en todas las cards; vacíos de 200 a 300 px entre secciones.
- 4 familias tipográficas y el cuerpo en una fuente ancha y fina, poco legible.
- Testimonios en muro infinito, sin empresa ni cargo.
- Tarjetas de contacto que no son enlaces; en móvil, una flecha flotante donde debería ir el CTA.
- Carrusel automático y marquees sin pausa; nada respeta "reducir movimiento".

## 3. Dirección creativa

Concepto: "La fórmula". El isotipo es un frasco de laboratorio con líquido cian: el antídoto. Ese líquido es el hilo narrativo y el motivo principal del motion. Los retos del cliente entran al frasco y salen convertidos en soluciones. El scroll es la dosis: a medida que bajas, el frasco se llena y la historia avanza.

Tono: preciso y cálido a la vez. Laboratorio creativo, no clínica. Oficio audiovisual (encuadres, timecode, guías de cámara) combinado con calidez humana (fotos reales de gente, comida y talleres).

Color (refina la marca actual, no la reemplaces):
- --ink #0F181D: fondo base, más una variante más profunda para separar secciones.
- --antidote #49C1EC: el líquido y acento principal. Úsalo con disciplina.
- --deep #0C5C7D, --mid #1C99CA, --glow #80DCFF: soporte y degradados del líquido.
- --reto: un único acento cálido (coral o rojo anaranjado) SOLO para representar problemas en la narrativa de retos a soluciones.
- Neutros cálidos para texto. Explora 1 o 2 secciones claras en blanco hueso cálido (testimonios o FAQ) para dar ritmo sin perder el carácter oscuro.
- Nada de verdes, rosas o morados fuera de paleta. El verde de WhatsApp solo dentro de su icono.

Tipografía (máximo 2 familias y 1 mono opcional):
- Display: Cal Sans (ya es de la marca), solo en su peso real, sin negritas sintéticas.
- Texto: una sans muy legible con soporte completo de español. Propón 2 opciones (por ejemplo Manrope, Figtree, Onest o Instrument Sans). Cuerpo de 16 px o más en móvil, interlineado 1,5 a 1,6.
- Mono opcional para detalles de oficio audiovisual (timecode, contadores, etiquetas técnicas).
- Escala fluida con clamp().

Iconografía: una sola familia SVG de trazo (Lucide o similar) con grosor coherente. Cero emojis.

Fotografía y video: fotos reales de la marca (adjuntas) con un grado de color común (sombras hacia --ink, luces limpias). Los videos nunca llevan texto incrustado; el texto va en HTML.

## 4. Sistema de motion

Principios:
1. El movimiento explica, no decora: cada animación cuenta la fórmula (llenar, disolver, transformar, avanzar).
2. Contenido visible por defecto. La animación es una mejora: si el JS tarda o falla, todo se lee. Ningún texto depende de un observer para dejar de estar en opacity 0.
3. Solo transform, opacity y clip-path. No animes box-shadow, blur sobre áreas grandes, width/height ni top/left.
4. Scroll nativo siempre: sin scroll hijacking ni librerías de smooth scroll que alteren la física.
5. Una sola animación protagonista por viewport.
6. Todo lo que se mueva en bucle más de 5 s tiene pausa visible y se detiene fuera de pantalla.

Tokens (defínelos y úsalos en todo el prototipo):
- Duraciones: instant 100 ms, fast 180 ms, base 280 ms, slow 480 ms, narrative 700 a 1200 ms (solo hero y secuencias ligadas al scroll).
- Curvas: out = cubic-bezier(0.22, 1, 0.36, 1) para entradas; in-out = cubic-bezier(0.65, 0, 0.35, 1) para cambios de estado; muelle de UI { stiffness: 300, damping: 30 }.
- Desplazamientos de entrada de 16 a 24 px, nunca más de 40 px. Stagger de 60 a 80 ms, máximo 6 elementos.
- Reduced motion (prefers-reduced-motion: reduce): sin parallax, sin pin, sin marquees (grid estático), sin autoplay de video (póster y botón play), los contadores muestran el número final, las transiciones pasan a fundidos de 200 ms o menos. Diseña y muestra este modo, no lo dejes implícito.

## 5. Estructura y motion por sección

0. Navegación
- Nav fija que se compacta al hacer scroll (menos altura, fondo --ink translúcido con blur suave).
- Indicador de sección activa que se desliza entre enlaces, como un nivel de líquido bajo el enlace.
- CTA "Cotizar" siempre visible en desktop.
- Móvil: menú a pantalla completa, enlaces con entrada escalonada, foco atrapado, cierre con Esc, aria-expanded.
- Enlace "Saltar al contenido".

1. Hero
- H1 en texto HTML real, idéntico en desktop y móvil: "Creamos experiencias que conectan, inspiran y transforman". Subtítulo: "Formaciones vivenciales, producción audiovisual y catering corporativo para empresas, colegios y organizaciones."
- CTA primario: "Cotizar por WhatsApp". Secundario: "Ver nuestro trabajo" (lleva al portafolio).
- Visual: el frasco del isotipo a gran escala en SVG. Dentro, enmascarado por la forma del líquido, un montaje de clips reales (taller, rodaje, catering). El líquido tiene una ola sutil y burbujas que suben.
- Entrada (1,2 s en total como máximo): el H1 se pinta visible desde el primer frame (sin fade que retrase el LCP); el líquido sube hasta su nivel mientras "conectan", "inspiran" y "transforman" se tiñen de --antidote una tras otra.
- Scroll: al bajar, el frasco se inclina y vierte el líquido, que se convierte en la línea que guía hacia servicios.
- Móvil: frasco más pequeño bajo el H1, ola en bucle lento, clip corto (1,5 MB o menos) o solo imagen. Nada de video vertical a pantalla completa.

2. Prueba social inmediata
- Franja de logos justo después del hero: "Han confiado en nosotros".
- Logos monocromos que toman color al hover y al foco. Marquee lento con botón de pausa y pausa al hover/foco; en reduced motion, grid estático.
- La copia duplicada del marquee va con aria-hidden.

3. Servicios (4)
- Desktop: secuencia fijada (pin) con progreso 01 a 04. Cada servicio ocupa el escenario con foto o clip real, una frase de valor, 3 datos concretos y un CTA propio ("Cotizar formación", "Cotizar producción", etc.).
- Cada servicio tiene una micro-animación firma ligada al scroll:
  - Formaciones vivenciales: nodos (personas) que se conectan con líneas hasta formar un equipo.
  - Producción audiovisual: visor de cámara con esquinas de encuadre, punto REC, timecode que corre y un focus pull sobre la foto.
  - Catering corporativo: vapor que sube de un plato, o ingredientes que se ensamblan en una bandeja.
  - Diseño de productos y experiencias: un trazo bezier que dibuja el contorno de un objeto y luego se rellena.
- Móvil: sin pin. Cards verticales con imagen y la animación firma simplificada al entrar en viewport. Nada de cards apiladas que se tapen entre sí.

4. Retos a soluciones ("el antídoto")
- Tres retos en --reto: Plazos encima, Logística, Presentaciones. Tres soluciones en --antidote: Cumplimiento, Apoyo, Propuestas.
- Animación ligada al scroll (scrub): partículas del color del reto viajan por curvas hacia el frasco central, el frasco brilla y salen partículas cian hacia la solución correspondiente. Cada par cierra con una línea que explica cómo lo resuelven.
- Párrafo (no H1): "En Antídoto convertimos tus retos en soluciones efectivas: propuestas prácticas, creativas e innovadoras que generan resultados reales."
- Móvil: versión vertical; cada tarjeta de reto se transforma en su solución al cruzar el centro del viewport.

5. Portafolio / reel
- Grid de piezas con filtros por servicio y transición de layout animada.
- Desktop: al hover, preview de video mudo de 3 a 5 s con carga diferida. Móvil: póster y botón play.
- Al abrir: lightbox con el video completo y fachada ligera (el reproductor externo no carga hasta el clic).
- Si faltan piezas, usa placeholders claramente marcados. No inventes clientes ni proyectos.

6. Cifras
- +150 producciones · +200 eventos · +50 clientes · 3 idiomas · desde 2020.
- Contadores con números tabulares que cuentan una sola vez al entrar; un mini frasco acompaña cada cifra con su nivel de líquido.

7. Testimonios
- Máximo 6, con nombre, cargo, empresa y logo o foto. Los actuales no traen empresa ni cargo: diseña el componente con esos campos y marca el contenido como "pendiente de validar con el cliente".
- Carrusel manual con arrastre y flechas, o un mazo de cards. Nada de muro infinito.
- Buen candidato para sección clara.

8. Nosotros
- Card de la fundadora: foto, "María Paula Ramos", "CEO y fundadora", "Ingeniera civil, especialista en Gerencia de SST. Lidera Antídoto acompañando a organizaciones, colegios y universidades con proyectos que generan impacto real."
- Línea de tiempo de 2020 a hoy: la línea se dibuja con el scroll (pathLength) y un frasco lateral sube de nivel en cada hito. Reescribe el copy de los hitos para que sea concreto y márcalo como borrador.

9. FAQ
- Acordeón accesible (botones con aria-expanded, animación de altura suave). Propón 6 preguntas: cobertura geográfica, pedidos mínimos de catering, tiempos de entrega de video, idiomas de las formaciones, modalidad presencial o virtual, cómo se cotiza.

10. Cotizador y contacto
- Cotizador rápido en 3 pasos: servicio → detalles (fecha aproximada, número de personas, ciudad, tipo de organización) → resumen. El botón final abre WhatsApp con el mensaje ya armado. Es un enlace real (https://wa.me/573125568016?text=...), sin retardos artificiales.
- Alternativas visibles: correo (mailto:), teléfono (tel:), Instagram y LinkedIn, todos como enlaces reales.
- Microcopy de privacidad con enlace a "Política de tratamiento de datos" (Ley 1581 de 2012).
- Motion: la barra de progreso del cotizador es el líquido llenando el frasco; al completar, el frasco burbujea una vez.

11. Footer
- Logo, frase de marca, enlaces reales (tel, mailto, redes con aria-label correcto), política de datos y año. Sin vacío previo.

Global móvil
- Barra inferior persistente "Cotizar por WhatsApp" que aparece tras el hero y se oculta cuando el cotizador o el footer están en pantalla. Reemplaza la flecha flotante actual.

Extra: imagen Open Graph
- Diseña la imagen para compartir (1200x630): isotipo, titular corto y paleta de marca, legible en la miniatura de WhatsApp.

## 6. Requisitos técnicos para el paso a código

- Stack: React + Vite + Tailwind + Motion (motion/react). Usa useScroll y useTransform (motion values), nunca setState en eventos de scroll. MotionConfig reducedMotion="user" en la raíz y LazyMotion para reducir el bundle.
- Las entradas simples pueden ir en CSS con scroll-driven animations (animation-timeline: view()) como mejora progresiva.
- Frasco, diagramas y trazos en SVG inline animable. Nada de GIFs; Lottie solo si es imprescindible y cargado en diferido.
- Presupuesto: LCP de 2,5 s o menos en móvil 4G, CLS menor a 0,1, INP menor a 200 ms, JS inicial de 170 KB gzip o menos, carga inicial móvil de 1,5 MB o menos. Video del hero de 1,5 MB o menos y sin audio. Imágenes AVIF/WebP con srcset, width/height y lazy salvo la del hero. Fuentes WOFF2 con subset y preload de la display.
- La página debe poder pre-renderizarse a HTML estático: ningún contenido puede existir solo después de un efecto de JS.
- Animaciones pausadas fuera de pantalla, will-change solo mientras animan, un solo video reproduciéndose a la vez.
- Anclas con scroll-margin-top igual a la altura del nav.

## 7. Accesibilidad (no negociable, WCAG 2.2 AA)

- Un solo H1, un H2 por sección y H3 dentro.
- Todo lo clicable es <a> o <button> real, operable con teclado, con :focus-visible diseñado (anillo --antidote con separación).
- Áreas táctiles de 44x44 px o más.
- Contraste AA en todo el texto, también sobre video e imagen (usa velos o degradados).
- alt descriptivo en fotos; logos con el nombre del cliente; duplicados del marquee con aria-hidden.
- Pausa visible para carruseles, marquees y videos en bucle.

## 8. Evita

- Franjas de color en el borde izquierdo de las cards. Usa un punto de color junto al título, un tinte de fondo en hover/activo o una sombra sutil.
- Guiones largos (em dash) y semilargos (en dash) en cualquier texto de la interfaz. Usa dos puntos, comas, punto y seguido o paréntesis.
- Emojis como iconos.
- Glow neón y bordes brillantes en todas las cards, glassmorphism por defecto, blobs de degradado genéricos, degradados morado-azul.
- Texto incrustado en videos o imágenes.
- Preloaders que bloqueen el contenido.
- Carruseles automáticos sin control y muros infinitos de testimonios.
- Negritas sintéticas y más de 2 familias tipográficas.
- Inventar clientes, cifras o testimonios.

## 9. Assets

- Isotipo (frasco): https://antidotocolombia.com/favicon.svg
- Logotipo: https://antidotocolombia.com/antidoto.svg (lienzo de 3840x2160 con mucho aire: recorta el viewBox y crea versión blanca y monocroma, hoy no existen).
- Fotos reales: https://antidotocolombia.com/img1.jpg a img11.jpg
- Fundadora: adjunta.
- Logos de clientes: https://antidotocolombia.com/client1.png a client19.png (no existe client9).
- Reel vertical actual, con texto incrustado (úsalo solo como pieza del portafolio): https://antidotocolombia.com/hero.mp4

## 10. Entregables del primer pase

1. Moodboard breve y 2 direcciones visuales dentro de "La fórmula" (una editorial y sobria, otra más expresiva). Recomienda una y di por qué.
2. Tokens: color, tipografía, espaciado, radios, sombras y motion.
3. Prototipo de la home completa en 1440 y 390 con las animaciones funcionando.
4. Estados: hover, foco, activo y deshabilitado, más la versión reduced motion de hero, servicios y retos a soluciones.
5. Notas de motion por sección: disparador, duración, curva y comportamiento en reduced motion.
6. Imagen OG de 1200x630.
```

---

## Prompts de iteración

Úsalos en orden, uno por mensaje, después del primer pase.

**1. Hero**
```
Trabaja solo el hero. Dame 3 variantes de la animación del frasco: (a) llenado con ola y burbujas, (b) vertido al hacer scroll que se convierte en la línea guía, (c) montaje de clips reales dentro del líquido. Para cada una, estima el costo en móvil (peso de assets, capas animadas) y cómo se ve en reduced motion. Recomienda una.
```

**2. Servicios**
```
Afina la secuencia fijada de servicios en desktop. Quiero que el cambio entre servicios se sienta como un corte de edición (match cut) guiado por el líquido, no como un fundido. Ajusta la micro-animación firma de cada servicio para que dure lo mismo y comparta curva. Muéstrame también la versión móvil sin pin.
```

**3. Retos a soluciones**
```
Haz que la animación de retos a soluciones se entienda sin leer: el recorrido reto → frasco → solución debe ser legible en 3 segundos de scroll. Prueba 2 grosores de trazo y 2 densidades de partículas y dime cuál funciona mejor en 390 px.
```

**4. Pase móvil**
```
Haz un pase completo solo en 390 px: zona del pulgar, barra inferior de WhatsApp, menú a pantalla completa, tamaños de texto, áreas táctiles de 44 px y longitud total de la página. Elimina todo lo que en móvil sea decorativo y no cuente la fórmula.
```

**5. Accesibilidad y reduced motion**
```
Activa reduced motion y recorre la página completa. Enséñame cada sección en ese modo, confirma el orden de encabezados, el orden de foco con teclado, los estados :focus-visible y el contraste del texto sobre imagen y video.
```

**6. Rendimiento**
```
Revisa el prototipo contra el presupuesto (LCP 2,5 s en móvil 4G, JS inicial 170 KB gzip, carga inicial móvil 1,5 MB). Lista qué animaciones o assets lo ponen en riesgo y propone la versión simplificada de cada uno.
```

**7. Handoff a código**
```
Prepara el handoff: árbol de componentes React, tokens como variables CSS y configuración de Tailwind, lista de assets a exportar (formato, tamaños y peso objetivo) y, para cada animación, el snippet de Motion con sus valores (disparador, rango de scroll, duración, curva y fallback de reduced motion).
```
