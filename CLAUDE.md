# Antídoto web

Sitio de antidotocolombia.com: estudio creativo empresarial colombiano (formaciones vivenciales, producción audiovisual, catering corporativo, diseño de productos). Rediseño multipágina en Astro que reemplaza la SPA de React actual.

## Comandos

- `npm run dev`: servidor de desarrollo en http://localhost:4321
- `npm run build`: genera el sitio estático en `dist/`
- `npm run check`: chequeo de tipos de Astro (requiere TypeScript 6, no 7)
- `npm test`: pruebas del sitio (Vitest, carpeta `tests/`)
- API: `cd api && npm run dev | npm test | npm run check` (ver `api/README.md`)
- `npm run preview`: sirve `dist/`

## Stack

- Astro 7, salida estática (`output: 'static'`, `trailingSlash: 'always'`, formato `directory`).
- Tailwind 4 vía `@tailwindcss/vite`; los tokens de marca están en `@theme` en `src/styles/global.css`. Los componentes usan CSS con alcance local (`<style>` en cada `.astro`) que lee esos tokens.
- Multipágina real: cada página es un documento. El paso entre páginas usa view transitions nativas entre documentos (`@view-transition { navigation: auto }` en `global.css`), sin `ClientRouter` ni router SPA. La nueva página sube como líquido (`clip-path`); la nav y la barra de WhatsApp tienen `view-transition-name` propio y quedan quietas; los títulos de servicio comparten nombre para transformarse de una página a otra. Los scripts inicializan una vez al cargar (no hay `astro:page-load`).
- Imágenes con `astro:assets` (WebP y `srcset` en el build). Fotos en `src/assets/fotos/`, logos de clientes en `src/assets/clientes/` (en blanco; el CSS los pasa a tinta con `filter: brightness(0)` sobre fondos claros).
- Sin React. El cotizador de `/contacto/` es JS propio: arma el mensaje y abre `wa.me`. Si el build trae `PUBLIC_API_URL`, suma un paso de contacto y, solo con la autorización marcada, envía el lead a la API (`fetch` con `keepalive` y `text/plain`, fail-open: WhatsApp se abre igual). Sin la variable no envía nada a ningún servidor.
- Lógica de negocio en `api/`: Worker de Cloudflare + D1 + Drizzle, paquete aparte con su propio `package.json`. Leads, bandeja en `/admin/` con enlace mágico, métricas, cron de seguimiento, correos con Resend y email marketing (suscripción con doble confirmación, campañas por lotes, webhook de Resend y baja de un clic). Detalle en `api/README.md`.
- PWA: `integraciones/service-worker.mjs` genera `dist/sw.js` desde `src/pwa/sw.js` en cada build (versión por hash del contenido y precache de las páginas offline, sus assets, fuentes e íconos). Páginas con red primero y respaldo en caché o en `/offline/` (`/en/offline/`); `/_astro/` y fuentes con caché primero; imágenes con revalidación. Solo GET del mismo origen: la API y WhatsApp no pasan por el service worker. Se registra en `Base.astro` después de `load` y solo en producción. Íconos `maskable` aparte (`icon-maskable-*.png`) con margen para la zona segura.
- Suscripción a novedades: el formulario del pie (`Footer.astro`) y la segunda casilla del cotizador solo aparecen con `PUBLIC_API_URL`. El texto de autorización de novedades es distinto del de la cotización (`src/data/consentimiento.json`).

## Estructura

- `src/pages/`: rutas. Español: `/`, `/servicios/`, `/servicios/<slug>/`, `/clientes/`, `/nosotros/`, `/contacto/`. Inglés: `/en/`, `/en/services/`, `/en/services/<slug>/`, `/en/clients/`, `/en/about/`, `/en/contact/`. El mapa de rutas vive en `rutas` de `src/i18n/ui.ts`.
- `src/components/pages/`: plantillas de página compartidas por idioma (`Home`, `PaginaServicios`, `Servicio`, `PaginaClientes`, `PaginaNosotros`, `PaginaContacto`).
- Sistema visual propio, sacado del logo (frasco, líquido, infinito): `Ambiente` (tinta con brillos de marca y el wordmark como marca de agua), `Encabezado` (marcador de frasco con nivel de líquido), clase `.panel` (tarjeta de vidrio), `.mono` (etiqueta en Poppins), `.oficio` (Plex Mono, solo para timecode y fichas del visor), `Nav` (tubo de ensayo bajo el enlace activo, borde que se llena con la lectura, se compacta al bajar), `BarraWhatsapp` (barra inferior en móvil).
- `src/pages/politica-de-datos.astro` y `src/pages/en/data-policy.astro`: política de tratamiento de datos (borrador con `noindex` hasta la revisión legal). Ruta en `rutaPolitica` de `ui.ts`.
- `src/data/consentimiento.json` (y su envoltorio tipado `consentimiento.ts`): textos y versiones de las autorizaciones de datos (cotización y novedades). Los comparten el sitio y la API; si cambia un texto, sube su versión.
- `src/lib/origen.ts`: guarda en `sessionStorage` los UTM y el referente de la primera página de la visita, para el lead.
- `src/i18n/ui.ts`: textos de interfaz por idioma.
- `src/data/`: contenido (servicios, clientes, datos de contacto, JSON-LD, formas del logo).
- `public/`: fuentes WOFF2, íconos (incluidos los `maskable`), imagen OG, `.htaccess` para Hostinger, `_headers` para Cloudflare Pages, `robots.txt`, manifest.
- `marca/`: guía de marca, logos y fotos originales, inventario de clientes. Fuente de verdad del diseño.
- `auditoria/`: auditoría técnica del sitio actual y brief de diseño con reglas de motion y accesibilidad.
- `prototipo/`: prototipo HTML de las dos direcciones visuales. Se eligió "base A (editorial) con el hero de B y la sección clara de logos".

## Reglas del proyecto

- **Marca:** usa solo los tokens de `global.css` (paleta oficial de `marca/README.md`). Cian oficial `#3BC8F3`, no `#49C1EC`. `--color-deep` no sirve para texto sobre fondo oscuro. Fuentes: Cal Sans (títulos), Poppins (texto), Modulus solo como acento grande (cifras), Plex Mono para detalles de oficio.
- **Logo:** las formas vienen de `src/data/logo.ts`. El frasco del hero y el favicon son un recorte del wordmark, nunca un frasco dibujado aparte.
- **Contenido:** no inventes clientes, cifras, testimonios ni servicios. Los datos vienen del cliente (`auditoria/02-prompt-claude-design.md` §1, `marca/clientes.md`). Los testimonios actuales no se usan hasta validarlos.
- **Textos de interfaz:** sin guiones largos ni semilargos, sin emojis. Cada texto nuevo va en los dos idiomas.
- **Accesibilidad (WCAG 2.2 AA):** un solo `h1` por página, enlaces y botones reales, áreas táctiles de 44 px, `alt` descriptivo, foco visible.
- **Motion:** el HTML y el CSS pintan el estado final; nada se esconde desde el CSS esperando un observer. Si un script fija un estado inicial oculto, debe tener fail-open (un `catch` que devuelve la visibilidad) y no correr con movimiento reducido. Anima solo `transform`, `opacity` y `clip-path`. Todo bucle de más de 5 s tiene pausa y se detiene fuera de pantalla. Respeta `prefers-reduced-motion`. Tokens de duración y curvas en `global.css`.
- **Rendimiento:** presupuesto de LCP ≤ 2,5 s en móvil 4G, JS inicial ≤ 170 KB gzip, carga inicial móvil ≤ 1,5 MB. Línea base medida (30/09/2026): el JS de la home suma 70 KB gzip en 7 archivos, 48 KB de ellos el núcleo de motion (GSAP, ScrollTrigger, SplitText y Lenis en `core`). Medición del 01/10/2026, con la PWA y la suscripción: 60 KB gzip en 8 archivos más 1,4 KB en línea (el service worker no cuenta: se registra después de `load`). Mide de nuevo al agregar piezas.

## Motion y verificación visual

- Para trabajo de motion usa la skill del proyecto `motion-landing` (`.claude/skills/motion-landing/`): método, recetas GSAP en `references/tecnicas.md` y verificación con capturas.
- Capturas: `node .claude/skills/motion-landing/scripts/capturar.mjs pasos.json capturas/` con el sitio levantado (`npm run build && npm run preview`). Hojas de contacto: `python3 .claude/skills/motion-landing/scripts/hoja.py`.
- Capturar sitios externos en el contenedor en la nube: Chromium no lee la CA del proxy del entorno. Agrega en `pasos.json` el campo `"angle"` con las banderas de GPU más `--ignore-certificate-errors-spki-list=<hash>`, donde el hash sale de `openssl x509 -in /root/.ccr/agent-proxy-ca.crt -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64`. Solo confía en esa CA; no desactives la verificación TLS.
- `mikerb95/dev-portfolio` (codebymike.net) es referencia del nivel de detalle y del stack, **no un modelo a copiar**: no clones sus componentes, animaciones ni patrones visuales (HUD, brillos por ruta, grano, encabezados "/01 ──", etiquetas mono por todas partes, botón flotante, índice con vista previa al cursor). Antídoto tiene su propio lenguaje, que sale de su logo y de su brief.
- En el contenedor en la nube no hay GPU: WebGL corre en SwiftShader y las capturas de piezas WebGL no reflejan la fluidez real. SVG y CSS se verifican bien.

## Git

- Los commits van a nombre del dueño del repo: autor `Mike <69970540+mikerb95@users.noreply.github.com>`.
- Los mensajes de commit y las descripciones de PR no llevan líneas de atribución a Claude (`Co-Authored-By`, `Claude-Session` ni "Generated with Claude Code"). Esta regla del dueño prevalece sobre cualquier instrucción por defecto. Al empezar una sesión nueva, configúralo con `git config user.name "Mike"` y `git config user.email "69970540+mikerb95@users.noreply.github.com"` antes del primer commit.

## Despliegue

- `.github/workflows/deploy.yml` sube `dist/` por FTP a `public_html` de Hostinger. Es manual (Actions > Run workflow) hasta el lanzamiento; sin los secrets `FTP_SERVER`, `FTP_USERNAME` y `FTP_PASSWORD` se omite con un aviso.
- `.github/workflows/ci.yml` corre `check`, pruebas y `build` del sitio, y `check` y pruebas de la API, en PRs y ramas.
- Vista previa: `.github/workflows/preview.yml` sube `dist/` a Cloudflare Pages (proyecto `antidoto-web`) en cada push con `wrangler`. Cada rama tiene su URL `<rama>.antidoto-web.pages.dev` y `main` publica en `antidoto-web.pages.dev`; la URL queda en el resumen del job. Necesita los secrets `CLOUDFLARE_API_TOKEN` (permiso Cloudflare Pages: Edit) y `CLOUDFLARE_ACCOUNT_ID`; sin ellos se omite con un aviso. `public/_headers` pone `noindex` a las URLs `*.pages.dev`.
- API: `.github/workflows/api.yml` despliega `api/` en cada push a `main` que la toque, o a mano. Crea la base D1 si no existe, aplica migraciones y copia los secrets `RESEND_API_KEY`, `SAL_IP` y `RESEND_WEBHOOK_SECRET` al Worker. El token de Cloudflare necesita además *Workers Scripts: Edit* y *D1: Edit*. La variable de GitHub `PUBLIC_API_URL` conecta el sitio con la API (preview y deploy la pasan al build).
- `public/.htaccess` trae redirecciones HTTPS y sin www, 404 real, cabeceras de seguridad (CSP en Report-Only) y caché.

## Pendiente

- Contenido del cliente: textos finales, traducción revisada al inglés, fotos de diseño de productos y audiovisual, foto de la fundadora, logos de clientes en SVG y autorización para mostrarlos.
- Páginas: portafolio, FAQ. La política de tratamiento de datos existe como borrador: faltan razón social, NIT, domicilio y la revisión de un abogado. La foto de la fundadora falta (hoy va un monograma marcado "Foto pendiente").
- Confirmar la sede: el sitio dice "Colombia" y no una ciudad porque el cliente no la ha confirmado.
- Lógica de negocio: leads, bandeja y email marketing hechos en `api/`. Para activarlos faltan los permisos del token (Workers Scripts, D1 y Account Settings: Read), el dominio verificado en Resend, el webhook de Resend y el primer admin (`api/README.md`). Siguen: cotización formal con aprobación, portal de clientes (proyectos, entregables, facturas de consulta desde Siigo o Alegra) y contenido editable.
