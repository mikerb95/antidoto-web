import type { Iteracion, Tarjeta } from './tipos';

// Reconstruidas del historial de git (74 commits, 22/09 a 03/10/2026) y de los PR #1 a #8.
export const ITERACIONES: Iteracion[] = [
  {
    id: 'I0',
    nombre: 'Diagnóstico',
    desde: '2026-09-22',
    hasta: '2026-09-22',
    commits: 2,
    objetivo: 'Auditar el sitio en producción y escribir el brief de diseño con reglas de motion y accesibilidad.',
  },
  {
    id: 'I1',
    nombre: 'Base del sitio',
    desde: '2026-09-29',
    hasta: '2026-09-30',
    commits: 21,
    prs: ['#1', '#2', '#3'],
    objetivo: 'Marca oficial, prototipo de dos direcciones, andamiaje Astro, núcleo de motion y vistas previas en Cloudflare Pages.',
  },
  {
    id: 'I2',
    nombre: 'Multipágina y lenguaje propio',
    desde: '2026-09-30',
    hasta: '2026-09-30',
    commits: 7,
    prs: ['#4', '#5'],
    objetivo: 'Pasar de una sola página a un sitio multipágina con view transitions nativas, y darle a Antídoto un lenguaje visual que sale de su logo.',
  },
  {
    id: 'I3',
    nombre: 'Leads y cotizador',
    desde: '2026-09-30',
    hasta: '2026-09-30',
    commits: 4,
    prs: ['#6'],
    objetivo: 'API en Cloudflare Workers con D1: leads, bandeja de gestión, métricas, seguimiento y conexión con el cotizador.',
  },
  {
    id: 'I4',
    nombre: 'PWA y email marketing',
    desde: '2026-10-01',
    hasta: '2026-10-01',
    commits: 10,
    prs: ['#7'],
    objetivo: 'Sitio instalable con modo sin conexión, suscripción con doble confirmación, campañas por lotes y cumplimiento de la Ley 1581.',
  },
  {
    id: 'I5',
    nombre: 'Home clara y servicios como contenido',
    desde: '2026-10-02',
    hasta: '2026-10-02',
    commits: 17,
    prs: ['#8'],
    objetivo: 'Home rediseñada con base clara, motion "dosis de color" y servicios gestionados como colecciones de contenido con borradores.',
  },
  {
    id: 'I6',
    nombre: 'Hero "Juega primero"',
    desde: '2026-10-03',
    hasta: '2026-10-03',
    commits: 13,
    objetivo: 'Rediseñar la primera pantalla a partir de la investigación sobre engagement above the fold, con la trivia jugable como pieza central.',
  },
  {
    id: 'I7',
    nombre: 'Documentación y video del hero',
    desde: '2026-10-03',
    hasta: '2026-10-31',
    commits: 0,
    objetivo: 'Documentar el proyecto (esta sección) y dejar listo el hero con video a pantalla completa cuando el cliente entregue el clip.',
  },
];

export const TARJETAS: Tarjeta[] = [
  // I0
  { id: 'K-01', titulo: 'Auditoría técnica del sitio actual', detalle: 'SEO, red, seguridad, accesibilidad, UX y motion. Lighthouse móvil 74 de rendimiento, canonical a un dominio ajeno y sin cabeceras de seguridad.', columna: 'hecho', iteracion: 'I0' },
  { id: 'K-02', titulo: 'Brief de diseño con motion y accesibilidad', detalle: 'Reglas de logo, sistema de motion, estructura por sección y WCAG 2.2 AA como requisito no negociable.', columna: 'hecho', iteracion: 'I0' },
  // I1
  { id: 'K-03', titulo: 'Paleta y activos de marca oficiales', detalle: 'Cian #3BC8F3, inventario de clientes y fotos originales en marca/.', columna: 'hecho', iteracion: 'I1' },
  { id: 'K-04', titulo: 'Prototipo de dos direcciones visuales', detalle: 'Se eligió la base A (editorial) con el hero de B y la sección clara de logos.', columna: 'hecho', iteracion: 'I1' },
  { id: 'K-05', titulo: 'Andamiaje Astro con sistema de marca', detalle: 'Salida estática, Tailwind 4 con tokens en @theme, fuentes WOFF2 propias, home y páginas de servicio.', columna: 'hecho', iteracion: 'I1' },
  { id: 'K-06', titulo: 'Núcleo de motion compartido', detalle: 'GSAP, ScrollTrigger, SplitText y Lenis: titulares, botones magnéticos, odómetro y escenas de servicios.', columna: 'hecho', iteracion: 'I1', historias: ['HU-12'] },
  { id: 'K-07', titulo: 'Vistas previas en Cloudflare Pages', detalle: 'Cada rama publica su URL y el deploy a Hostinger queda manual hasta el lanzamiento.', columna: 'hecho', iteracion: 'I1', historias: ['HU-24'] },
  // I2
  { id: 'K-08', titulo: 'Sitio multipágina con view transitions nativas', detalle: 'Cada página es un documento; el paso entre páginas sube como líquido con clip-path.', columna: 'hecho', iteracion: 'I2', historias: ['HU-01', 'HU-12'] },
  { id: 'K-09', titulo: 'Páginas de servicios, clientes, nosotros y contacto', detalle: 'Con filtro de clientes por sector y migas de pan.', columna: 'hecho', iteracion: 'I2', historias: ['HU-02', 'HU-03', 'HU-04'] },
  { id: 'K-10', titulo: 'Lenguaje visual propio', detalle: 'Frasco, líquido e infinito del logo como sistema; se descartó clonar la referencia del portafolio.', columna: 'hecho', iteracion: 'I2' },
  { id: 'K-11', titulo: 'Retos a soluciones como pieza tipográfica', detalle: 'El problema gris y quieto, la solución en cian.', columna: 'hecho', iteracion: 'I2', historias: ['HU-12'] },
  // I3
  { id: 'K-12', titulo: 'Cotizador en tres pasos', detalle: 'Arma el mensaje y abre wa.me; si hay API, suma el paso de contacto y envía el lead con autorización.', columna: 'hecho', iteracion: 'I3', historias: ['HU-05', 'HU-06'] },
  { id: 'K-13', titulo: 'API de leads en Workers y D1', detalle: 'Validación, trampa para bots, límite por IP, prueba del consentimiento y correos con Resend.', columna: 'hecho', iteracion: 'I3', historias: ['HU-07', 'HU-14'] },
  { id: 'K-14', titulo: 'Bandeja /admin/ con enlace mágico', detalle: 'Estados, notas, historial con autor, exportación a CSV, métricas y roles admin y equipo.', columna: 'hecho', iteracion: 'I3', historias: ['HU-15', 'HU-16', 'HU-17'] },
  { id: 'K-15', titulo: 'Cron de seguimiento de leads', detalle: 'Avisa una vez por lead que sigue en "nuevo" pasadas 24 horas.', columna: 'hecho', iteracion: 'I3', historias: ['HU-18'] },
  { id: 'K-16', titulo: 'Despliegue automático de la API', detalle: 'Workflow que crea la D1, aplica migraciones y copia los secrets.', columna: 'hecho', iteracion: 'I3', historias: ['HU-24'] },
  // I4
  { id: 'K-17', titulo: 'PWA con modo sin conexión', detalle: 'Service worker generado en cada build, precache de las páginas offline y caché por tipo de recurso.', columna: 'hecho', iteracion: 'I4', historias: ['HU-19'] },
  { id: 'K-18', titulo: 'Suscripción con doble confirmación', detalle: 'Formulario del pie y segunda casilla del cotizador, con texto de autorización propio.', columna: 'hecho', iteracion: 'I4', historias: ['HU-08', 'HU-09'] },
  { id: 'K-40', titulo: 'Registro a novedades en la home', detalle: 'Sección con correo e intereses por servicio; lógica común con el pie en src/lib/novedades.ts. Falta que el cliente confirme la frecuencia de envío.', columna: 'hecho', iteracion: 'I4', historias: ['HU-29'] },
  { id: 'K-19', titulo: 'Campañas por lotes y webhook de Resend', detalle: 'Lotes de 100, reclamo atómico, reintentos, métricas por campaña y baja de un clic (RFC 8058).', columna: 'hecho', iteracion: 'I4', historias: ['HU-20', 'HU-21'] },
  { id: 'K-20', titulo: 'Supresión y anonimización de datos', detalle: 'Borra lo personal, revoca la autorización y conserva solo lo necesario para las métricas.', columna: 'hecho', iteracion: 'I4', historias: ['HU-10', 'HU-22'] },
  // I5
  { id: 'K-21', titulo: 'Home rediseñada con base clara', detalle: 'Doce bloques, una sección por componente, tokens claros y nav y pie nuevos en todo el sitio.', columna: 'hecho', iteracion: 'I5', historias: ['HU-01', 'HU-11'] },
  { id: 'K-22', titulo: 'Motion "dosis de color"', detalle: 'Líquido cian con borde de ola que llena resaltados, dolores, pasos y afiches; oleaje en el cierre con pausa.', columna: 'hecho', iteracion: 'I5', historias: ['HU-12', 'HU-13'] },
  { id: 'K-23', titulo: 'Servicios como colecciones de contenido', detalle: 'Un Markdown por servicio e idioma, emparejados por clave estable y con borradores fuera del build de producción.', columna: 'hecho', iteracion: 'I5', historias: ['HU-02', 'HU-23'] },
  // I6
  { id: 'K-24', titulo: 'Investigación sobre engagement above the fold', detalle: 'Diagnóstico del hero oscuro y revisión de NN/g, Yale y blogs de conversión. Ver Fuentes e investigaciones.', columna: 'hecho', iteracion: 'I6' },
  { id: 'K-25', titulo: 'Hero "Juega primero" con trivia jugable', detalle: 'Un solo foco por lado, un solo botón, la trivia como pieza central y la sección siguiente asomando.', columna: 'hecho', iteracion: 'I6', historias: ['HU-11', 'HU-13'] },
  { id: 'K-26', titulo: 'Nav compacta en móvil y franja cian con oleaje', detalle: 'Una sola fila en móvil (antes unos 180 px) y borde de ola que sigue al cursor o al scroll.', columna: 'hecho', iteracion: 'I6', historias: ['HU-01'] },
  { id: 'K-27', titulo: 'Cabeceras de seguridad y metadatos SEO', detalle: 'Canonical, Open Graph y JSON-LD propios; CSP en Report-Only y 404 real en Hostinger.', columna: 'hecho', iteracion: 'I6', historias: ['HU-25'] },
  // I7
  { id: 'K-28', titulo: 'Documentación del proyecto en /docs/', detalle: 'Kanban, requisitos, casos de uso extendidos, historias de usuario y fuentes.', columna: 'curso', iteracion: 'I7' },
  { id: 'K-29', titulo: 'Hero a pantalla completa con video de fondo', detalle: 'El código admite el clip en VIDEO_HERO; hoy el hero usa fotos con ola.', columna: 'cliente', iteracion: 'I7', historias: ['HU-11'] },
  // Pendiente
  { id: 'K-30', titulo: 'Activar la API en producción', detalle: 'Permisos del token (Workers Scripts, D1, Account Settings: Read), dominio verificado en Resend, webhook y primer admin.', columna: 'pendiente', iteracion: 'I7', historias: ['HU-07', 'HU-15'] },
  { id: 'K-31', titulo: 'Cotización formal con aprobación', detalle: 'Documento de cotización que el cliente aprueba desde un enlace.', columna: 'pendiente', iteracion: 'I7', historias: ['HU-26'] },
  { id: 'K-32', titulo: 'Portal de clientes', detalle: 'Proyectos, entregables y facturas de consulta desde Siigo o Alegra.', columna: 'pendiente', iteracion: 'I7', historias: ['HU-27'] },
  { id: 'K-33', titulo: 'Contenido editable', detalle: 'Que el equipo cambie textos y servicios sin tocar el código.', columna: 'pendiente', iteracion: 'I7', historias: ['HU-23'] },
  { id: 'K-34', titulo: 'Páginas de portafolio y FAQ propia', detalle: 'Hoy las preguntas frecuentes viven solo en la home.', columna: 'pendiente', iteracion: 'I7', historias: ['HU-28'] },
  // Cliente
  { id: 'K-35', titulo: 'Textos finales y traducción revisada al inglés', detalle: 'Los textos actuales son borrador y deben validarse.', columna: 'cliente', iteracion: 'I7' },
  { id: 'K-36', titulo: 'Fotos de diseño de productos y audiovisual, y de la fundadora', detalle: 'Hoy la fundadora aparece con un monograma marcado "Foto pendiente".', columna: 'cliente', iteracion: 'I7', historias: ['HU-03'] },
  { id: 'K-37', titulo: 'Logos de clientes en SVG y autorización para mostrarlos', detalle: 'Sin autorización no se publican como definitivos.', columna: 'cliente', iteracion: 'I7', historias: ['HU-03'] },
  { id: 'K-38', titulo: 'Razón social, NIT, domicilio y revisión legal de la política de datos', detalle: 'La política existe como borrador con noindex.', columna: 'cliente', iteracion: 'I7', historias: ['HU-10'] },
  { id: 'K-39', titulo: 'Confirmar la sede', detalle: 'El sitio dice "Colombia" porque el cliente no ha confirmado una ciudad.', columna: 'cliente', iteracion: 'I7' },
];
