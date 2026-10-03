import type { Investigacion } from './tipos';

// Fuentes e investigaciones detrás de las decisiones del sitio. Cada decisión dice en qué
// parte del código quedó. Las cifras de terceros se citan como las reporta la fuente: las de
// blogs de marketing tienen menos rigor y así se marcan.

export const INVESTIGACIONES: Investigacion[] = [
  {
    id: 'INV-01',
    titulo: 'Engagement en la primera pantalla (above the fold)',
    fecha: '2026-10-03',
    pregunta: '¿Por qué el hero oscuro con foto no engancha y qué dice la investigación sobre lo que se ve al abrir la página?',
    resumen:
      'Tras ver el hero (foto oscurecida, siete elementos centrados y un recuadro punteado para el reel), el dueño lo calificó de condensado y estático. Se comparó con la investigación de Nielsen Norman Group (NN/g) y de universidades sobre atención, scroll e imágenes, y con datos de blogs de conversión. De ahí salió el hero "Juega primero".',
    diagnostico: [
      'Siete cosas pelean por atención: insignia, titular, bajada, dos botones, tarjeta de la fundadora y recuadro del reel, todas centradas y con el mismo peso.',
      'La foto era decoración: oscurecida entre 62 % y 94 %, recortada y desenfocada, daba un fondo gris turbio en una marca cian.',
      'Contaba en vez de mostrar: decía "formación, video y eventos" sin que se viera ninguna de las tres pasando.',
      'Lo más valioso de la pantalla lo ocupaba un recuadro punteado ("[AQUÍ VA EL REEL…]") que se leía como algo roto.',
      'Había tres "Cotizar" a la vez: nav, botón principal y cada sección.',
      'Pasados los dos primeros segundos, nada se movía.',
    ],
    fuentes: [
      {
        titulo: 'Scrolling and the illusion of completeness',
        autor: 'University of St Andrews, Digital Communications (resume a NN/g)',
        tipo: 'articulo',
        enlace: 'https://digitalcommunications.wp.st-andrews.ac.uk/2020/09/21/scrolling-and-the-illusion-of-completeness/',
        hallazgo: 'Según NN/g, el 57 % del tiempo de lectura se pasa en la primera pantalla y el 74 % en las dos primeras. Un diseño que parece completo frena el scroll: en su estudio, el 75 % no notó que podía bajar.',
      },
      {
        titulo: 'Above the fold in web design and development',
        autor: "Developer's Journey",
        tipo: 'blog',
        enlace: 'https://developersjourney.substack.com/p/above-the-fold-in-web-design-and-development',
        hallazgo: 'Repite las cifras de NN/g sobre dónde se concentra la atención. Se usó como segunda lectura de los mismos datos.',
      },
      {
        titulo: 'Photos as Web Content',
        autor: 'Nielsen Norman Group',
        tipo: 'estudio',
        enlace: 'https://www.nngroup.com/articles/photos-as-web-content/',
        hallazgo: 'En el seguimiento ocular de NN/g, las fotos que informan (producto, personas reales en contexto) se estudian con detalle; las fotos grandes de ambiente se saltan.',
      },
      {
        titulo: 'Hero images and carousels',
        autor: 'Yale Usability',
        tipo: 'articulo',
        enlace: 'https://usability.yale.edu/usability-best-practices/hero-imagescarousels',
        hallazgo: 'Guía de buenas prácticas sobre imágenes de héroe y carruseles, citada junto con NN/g para distinguir imágenes que informan de las decorativas.',
      },
      {
        titulo: 'Text over images',
        autor: 'Nielsen Norman Group',
        tipo: 'articulo',
        enlace: 'https://www.nngroup.com/articles/text-over-images/',
        hallazgo: 'Para texto sobre foto, conviene oscurecer o desenfocar solo la zona donde va el texto (por ejemplo con un degradado), no poner un velo sobre toda la imagen.',
      },
      {
        titulo: 'Landing page conversion study: 2,000 pages tested (2026)',
        autor: 'Digital Applied',
        tipo: 'blog',
        enlace: 'https://www.digitalapplied.com/blog/landing-page-conversion-study-2000-pages-tested-2026',
        hallazgo: 'Sugiere que un video que arranca solo en el hero suele perder conversión por lo que retrasa la carga, y que funciona mejor una imagen fija que se reproduce al tocarla. Rigor menor: es un blog de marketing.',
      },
      {
        titulo: 'Hero section statistics',
        autor: 'roast.page',
        tipo: 'blog',
        enlace: 'https://roast.page/stats/hero-section-statistics',
        hallazgo: 'Recopila estadísticas de hero, entre ellas el costo en carga del video automático. Rigor menor.',
      },
      {
        titulo: 'Interactive demos: conversion rates in B2B (2026 data)',
        autor: 'Walnut',
        tipo: 'blog',
        enlace: 'https://www.walnut.io/blog/product-demos/interactive-demos-conversion-rates-b2b-2026-data/',
        hallazgo: 'Las demos interactivas y las vistas previas del producto en el hero son una tendencia en B2B. Rigor menor, y la empresa vende ese tipo de demos.',
      },
      {
        titulo: '10 SaaS landing page trends for 2026',
        autor: 'SaaSFrame',
        tipo: 'blog',
        enlace: 'https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples',
        hallazgo: 'Apunta la misma tendencia hacia piezas interactivas en el hero. Rigor menor.',
      },
    ],
    decisiones: [
      {
        decision: 'Un solo foco por lado: titular, una línea de apoyo y un único botón "Cotizar en 3 pasos".',
        porque: 'Siete elementos con el mismo peso no dejan a la vista dónde aterrizar.',
        donde: 'src/components/home/Hero.astro',
      },
      {
        decision: 'La trivia jugable como pieza central del hero, que se llena de líquido cian al responder.',
        porque: 'Mostrar en vez de contar, y una pieza interactiva en lugar de una foto decorativa. El reloj arranca con la interacción para que no se agote mientras se lee.',
        donde: 'src/components/home/Trivia.astro, src/lib/trivia.ts',
      },
      {
        decision: 'Se quitó la foto con velo oscuro; el fondo es blanco y el protagonista es el cian de la marca.',
        porque: 'Las fotos de ambiente se ignoran y el velo total daba un gris turbio. El texto sobre foto, si vuelve, debe oscurecer solo donde va el texto.',
        donde: 'src/components/home/Hero.astro',
      },
      {
        decision: 'La sección "Han confiado en nosotros" asoma en el borde de la primera pantalla.',
        porque: 'Evitar la ilusión de completitud: si todo parece cerrado, la gente no baja.',
        donde: 'src/components/home/Hero.astro, src/components/home/ClientesCifras.astro',
      },
      {
        decision: 'La fundadora y la licencia pasan a una franja cian bajo el hero, con oleaje que sigue al cursor.',
        porque: 'Dan confianza sin competir con el foco principal.',
        donde: 'src/components/home/Hero.astro, src/components/home/Olas.astro',
      },
      {
        decision: 'Sale el recuadro punteado del reel; el video a pantalla completa entra cuando el cliente entregue el clip.',
        porque: 'Un placeholder se lee como algo roto. Los blogs advierten del costo del video en carga, así que se exige un clip corto y ligero.',
        donde: 'src/data/site.ts (VIDEO_HERO)',
      },
      {
        decision: 'Nav de una sola fila en móvil, con logo, "Cotizar" y "Menú".',
        porque: 'Antes ocupaba tres filas (unos 180 px) de una primera pantalla escasa.',
        donde: 'src/components/Nav.astro',
      },
    ],
    limites: [
      'Las cifras de NN/g llegan por un resumen de la Universidad de St Andrews y por un blog; no se leyó el estudio original completo.',
      'Los datos de conversión salen de blogs de marketing: son tendencias, no prueba.',
      'Esta decisión no se midió con tráfico real. Falta analítica de clics y scroll para comprobar el efecto en la conversión.',
      'En la misma búsqueda se revisaron galerías de Awwwards como inspiración, sin extraer conclusiones citables.',
    ],
  },
  {
    id: 'INV-02',
    titulo: 'Auditoría técnica del sitio anterior',
    fecha: '2026-09-22',
    pregunta: '¿Qué falla en antidotocolombia.com hoy y qué hay que corregir en el rediseño?',
    resumen:
      'Revisión del sitio en producción (una SPA de React) con curl, openssl y dig para red, cabeceras, TLS y DNS; análisis estático del bundle; revisión en Chrome (1440 px y 390 px) y Lighthouse. Sin pruebas intrusivas.',
    diagnostico: [
      'Canonical, og:url, og:image y JSON-LD apuntaban a antidoto.com, un dominio ajeno, y no había imagen para compartir.',
      'Las tarjetas de contacto eran div con onClick y un setTimeout de 800 ms: no eran enlaces ni se podían usar con teclado.',
      'Todo se renderizaba en cliente: los bots sin JS veían una página vacía.',
      'JS y CSS sin compresión, y un video móvil de 9 MB con audio y sin faststart.',
      'Sin cabeceras de seguridad y con soft 404 (toda ruta devolvía 200 con la home).',
      'Lighthouse móvil: rendimiento 74, accesibilidad 85, LCP 3,5 s y 5,1 MB de peso total.',
    ],
    fuentes: [
      {
        titulo: 'Auditoría técnica: antidotocolombia.com',
        autor: 'Proyecto Antídoto web',
        tipo: 'interna',
        enlace: 'auditoria/01-auditoria-tecnica.md',
        hallazgo: 'Hallazgos priorizados por severidad (crítico, alto, medio, bajo), con plan de acción por semanas.',
      },
    ],
    decisiones: [
      { decision: 'Sitio estático multipágina en Astro, renderizado en el servidor.', porque: 'Los bots y las redes sociales deben ver el contenido sin ejecutar JavaScript.', donde: 'astro.config.mjs' },
      { decision: 'Canonical, Open Graph y JSON-LD propios, y sitemap.', porque: 'Los metadatos apuntaban a un dominio ajeno.', donde: 'src/layouts/Base.astro, src/data/schema.ts' },
      { decision: 'Enlaces y botones reales en todos los contactos.', porque: 'Los div con onClick no funcionan con teclado ni con bloqueadores de popups.', donde: 'src/components/pages/PaginaContacto.astro' },
      { decision: 'Cabeceras de seguridad, 404 real y redirección www a apex.', porque: 'El sitio no tenía cabeceras y servía 200 en cualquier ruta.', donde: 'public/.htaccess, public/_headers' },
      { decision: 'Presupuesto de rendimiento: LCP ≤ 2,5 s, JS ≤ 170 KB gzip y carga inicial móvil ≤ 1,5 MB.', porque: 'El sitio anterior pesaba 5,1 MB y tenía LCP de 3,5 s.', donde: 'CLAUDE.md' },
    ],
    limites: ['Es una foto del 22/09/2026; el sitio anterior pudo cambiar.', 'Lighthouse se corrió con la emulación por defecto, no sobre dispositivos reales.'],
  },
  {
    id: 'INV-03',
    titulo: 'Brief de diseño, marca y accesibilidad',
    fecha: '2026-09-22',
    pregunta: '¿Cuál es la dirección creativa, el sistema de motion y el piso de accesibilidad del rediseño?',
    resumen:
      'Un brief con contexto de negocio, qué falla hoy, reglas del logo, sistema de motion, estructura por sección, requisitos técnicos y accesibilidad. La marca se tomó del inventario oficial (paleta, logos, fotos y clientes) y se descartó copiar el estilo de otros sitios.',
    fuentes: [
      { titulo: 'Prompt para Claude Design: rediseño con motion', autor: 'Proyecto Antídoto web', tipo: 'interna', enlace: 'auditoria/02-prompt-claude-design.md', hallazgo: 'Contexto de negocio dado por el cliente, reglas de motion y de accesibilidad, y lo que se debe evitar.' },
      { titulo: 'Guía de marca', autor: 'Antídoto (cliente)', tipo: 'interna', enlace: 'marca/README.md', hallazgo: 'Paleta oficial (cian #3BC8F3), tipografías y contrastes medidos.' },
      { titulo: 'Inventario de clientes', autor: 'Antídoto (cliente)', tipo: 'interna', enlace: 'marca/clientes.md', hallazgo: 'Clientes y sectores; fuente de verdad para no inventar clientes.' },
      { titulo: 'Web Content Accessibility Guidelines (WCAG) 2.2', autor: 'W3C', tipo: 'norma', enlace: 'https://www.w3.org/TR/WCAG22/', hallazgo: 'Nivel AA como requisito no negociable: contraste, foco visible, áreas táctiles y movimiento.' },
    ],
    decisiones: [
      { decision: 'El lenguaje visual sale del logo: frasco, líquido e infinito.', porque: 'Antídoto debe verse como Antídoto y no como un clon de la referencia.', donde: 'src/data/logo.ts, src/components/TarjetaIndice.astro' },
      { decision: 'Motion con fail-open, solo transform, opacity y clip-path, y pausa en bucles de más de 5 s.', porque: 'El motion no debe esconder contenido ni excluir a quien tiene sensibilidad al movimiento.', donde: 'src/lib/motion/core.ts' },
      { decision: 'Cian solo con texto tinta; sobre blanco, texto de color #0C5C7D y foco azul profundo.', porque: 'El cian no da contraste con texto blanco ni 3:1 sobre blanco.', donde: 'src/styles/global.css' },
      { decision: 'No se publican clientes, cifras ni testimonios sin confirmar; lo que falta se marca entre corchetes.', porque: 'La confianza del sitio depende de que todo lo que dice sea verdad.', donde: 'src/components/home/' },
    ],
    limites: ['No hubo pruebas de usabilidad con personas reales.', 'No hay auditoría de accesibilidad formal posterior al rediseño.'],
  },
  {
    id: 'INV-04',
    titulo: 'Cumplimiento: datos personales y correo masivo',
    fecha: '2026-10-01',
    pregunta: '¿Qué exige la ley y los proveedores de correo para guardar leads y enviar campañas?',
    resumen:
      'La captura de leads y las campañas se diseñaron sobre tres referencias: la Ley 1581 de 2012 de protección de datos personales, la exigencia de baja de un clic de Gmail y Yahoo, y el estándar RFC 8058.',
    fuentes: [
      { titulo: 'Ley 1581 de 2012', autor: 'Congreso de Colombia', tipo: 'norma', enlace: 'http://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html', hallazgo: 'Régimen general de protección de datos personales: autorización previa, expresa e informada, y derecho a la supresión.' },
      { titulo: 'RFC 8058: One-Click Unsubscribe', autor: 'IETF', tipo: 'norma', enlace: 'https://www.rfc-editor.org/rfc/rfc8058', hallazgo: 'Cabeceras List-Unsubscribe y List-Unsubscribe-Post para la baja de un clic, exigida por Gmail y Yahoo a quien envía en volumen.' },
      { titulo: 'README de la API', autor: 'Proyecto Antídoto web', tipo: 'interna', enlace: 'api/README.md', hallazgo: 'Cómo la API implementa autorización, prueba, supresión, doble confirmación y baja.' },
    ],
    decisiones: [
      { decision: 'Dos autorizaciones separadas, con texto y versión propios: cotización y novedades.', porque: 'La autorización debe ser expresa y para una finalidad concreta.', donde: 'src/data/consentimiento.json' },
      { decision: 'Doble confirmación, y el GET del enlace no confirma.', porque: 'Los filtros de correo abren los enlaces y no deben activar suscripciones.', donde: 'api/src/marketing/suscripciones.ts' },
      { decision: 'Baja de un clic y cabeceras RFC 8058 en cada correo de campaña.', porque: 'Gmail y Yahoo lo exigen y mejora la entregabilidad.', donde: 'api/src/marketing/envios.ts' },
      { decision: 'Supresión que conserva solo servicio, fechas y estado.', porque: 'Se cumple el derecho a la supresión sin perder las métricas.', donde: 'api/src/admin.ts' },
    ],
    limites: ['La política de datos es un borrador: falta la revisión de un abogado, la razón social, el NIT y el domicilio.', 'Este documento resume la lectura del equipo técnico y no es asesoría legal.'],
  },
  {
    id: 'INV-05',
    titulo: 'Estructura de esta documentación',
    fecha: '2026-10-03',
    pregunta: '¿Cómo documentar un proyecto de este tamaño sin que la documentación se quede desactualizada?',
    resumen:
      'Se tomó como referencia la documentación de ingeniería de codebymike.net/docs (requisitos, casos de uso, historias, kanban y pruebas), del mismo autor. De ella se adoptó el principio de que todo vive como datos tipados y las páginas solo los pintan; no se copió su estructura académica completa.',
    fuentes: [
      { titulo: 'Documentación de dev-portfolio', autor: 'Mike (codebymike.net)', tipo: 'articulo', enlace: 'https://codebymike.net/docs', hallazgo: 'Unas 38 páginas con requisitos, análisis, diseño, ejecución y DevOps, generadas desde datos tipados en src/data/.' },
    ],
    decisiones: [
      { decision: 'Datos tipados en src/data/docs/ y páginas Astro en /docs/.', porque: 'Los datos se pueden validar con pruebas y las páginas no se desfasan.', donde: 'src/data/docs/, src/pages/docs/' },
      { decision: 'Cada requisito enlaza a la evidencia en el repositorio, y una prueba comprueba que exista.', porque: 'Un requisito marcado como implementado sin evidencia es una afirmación sin respaldo.', donde: 'tests/docs.test.ts' },
      { decision: 'Rutas /docs/ con noindex y fuera del sitemap.', porque: 'Es documentación interna: el sitio es público pero esta sección no debe indexarse.', donde: 'src/layouts/Docs.astro, astro.config.mjs' },
    ],
    limites: ['La sección se despliega con el sitio, así que cualquiera con la URL puede leerla.', 'Las iteraciones y las historias se reconstruyeron del historial de git, no se planearon de antemano.'],
  },
];
