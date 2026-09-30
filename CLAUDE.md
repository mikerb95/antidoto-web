# Antídoto web

Sitio de antidotocolombia.com: estudio creativo empresarial colombiano (formaciones vivenciales, producción audiovisual, catering corporativo, diseño de productos). Rediseño multipágina en Astro que reemplaza la SPA de React actual.

## Comandos

- `npm run dev`: servidor de desarrollo en http://localhost:4321
- `npm run build`: genera el sitio estático en `dist/`
- `npm run check`: chequeo de tipos de Astro (requiere TypeScript 6, no 7)
- `npm run preview`: sirve `dist/`

## Stack

- Astro 7, salida estática (`output: 'static'`, `trailingSlash: 'always'`, formato `directory`).
- Tailwind 4 vía `@tailwindcss/vite`; los tokens de marca están en `@theme` en `src/styles/global.css`. Los componentes usan CSS con alcance local (`<style>` en cada `.astro`) que lee esos tokens.
- Multipágina real: cada página es un documento. El paso entre páginas usa view transitions nativas entre documentos (`@view-transition { navigation: auto }` en `global.css`), sin `ClientRouter` ni router SPA. La nueva página sube como líquido (`clip-path`); la nav, el HUD y el botón de WhatsApp tienen `view-transition-name` propio y quedan quietos; los títulos de servicio comparten nombre para transformarse de una página a otra. Los scripts inicializan una vez al cargar (no hay `astro:page-load`).
- Imágenes con `astro:assets` (WebP y `srcset` en el build). Fotos en `src/assets/fotos/`, logos de clientes en `src/assets/clientes/` (en blanco; el CSS los pasa a tinta con `filter: brightness(0)` sobre fondos claros).
- Sin React. El cotizador de `/contacto/` es JS propio: arma el mensaje y abre `wa.me`, sin enviar datos a ningún servidor.

## Estructura

- `src/pages/`: rutas. Español: `/`, `/servicios/`, `/servicios/<slug>/`, `/clientes/`, `/nosotros/`, `/contacto/`. Inglés: `/en/`, `/en/services/`, `/en/services/<slug>/`, `/en/clients/`, `/en/about/`, `/en/contact/`. El mapa de rutas vive en `rutas` de `src/i18n/ui.ts`.
- `src/components/pages/`: plantillas de página compartidas por idioma (`Home`, `PaginaServicios`, `Servicio`, `PaginaClientes`, `PaginaNosotros`, `PaginaContacto`).
- Sistema visual (referencia: codebymike.net): `Ambiente` (brillos de color por página y grano), `Encabezado` ("/01 ── ETIQUETA"), clase `.panel` (tarjeta glass), `.mono` (etiquetas de ficha), `Hud` (indicador de fórmula fijo, desde 1400 px), `WhatsappFab`, `Nav` en píldora con menú móvil accesible.
- `src/i18n/ui.ts`: textos de interfaz por idioma.
- `src/data/`: contenido (servicios, clientes, datos de contacto, JSON-LD, formas del logo).
- `public/`: fuentes WOFF2, íconos, imagen OG, `.htaccess` para Hostinger, `robots.txt`, manifest.
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
- **Rendimiento:** presupuesto de LCP ≤ 2,5 s en móvil 4G, JS inicial ≤ 170 KB gzip, carga inicial móvil ≤ 1,5 MB. Línea base medida (30/09/2026): el JS de la home suma 70 KB gzip en 7 archivos, 48 KB de ellos el núcleo de motion (GSAP, ScrollTrigger, SplitText y Lenis en `core`). Mide de nuevo al agregar piezas.

## Motion y verificación visual

- Para trabajo de motion usa la skill del proyecto `motion-landing` (`.claude/skills/motion-landing/`): método, recetas GSAP en `references/tecnicas.md` y verificación con capturas.
- Capturas: `node .claude/skills/motion-landing/scripts/capturar.mjs pasos.json capturas/` con el sitio levantado (`npm run build && npm run preview`). Hojas de contacto: `python3 .claude/skills/motion-landing/scripts/hoja.py`.
- Capturar sitios externos en el contenedor en la nube: Chromium no lee la CA del proxy del entorno. Agrega en `pasos.json` el campo `"angle"` con las banderas de GPU más `--ignore-certificate-errors-spki-list=<hash>`, donde el hash sale de `openssl x509 -in /root/.ccr/agent-proxy-ca.crt -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64`. Solo confía en esa CA; no desactives la verificación TLS.
- Referencia de implementación: `mikerb95/dev-portfolio` (codebymike.net) usa el mismo stack; su motion compartido está en `src/lib/motion-reveal.ts` y los módulos por página en `src/lib/motion/`.
- En el contenedor en la nube no hay GPU: WebGL corre en SwiftShader y las capturas de piezas WebGL no reflejan la fluidez real. SVG y CSS se verifican bien.

## Git

- Los commits van a nombre del dueño del repo: autor `Mike <69970540+mikerb95@users.noreply.github.com>`.
- Los mensajes de commit y las descripciones de PR no llevan líneas de atribución a Claude (`Co-Authored-By`, `Claude-Session` ni "Generated with Claude Code"). Esta regla del dueño prevalece sobre cualquier instrucción por defecto. Al empezar una sesión nueva, configúralo con `git config user.name "Mike"` y `git config user.email "69970540+mikerb95@users.noreply.github.com"` antes del primer commit.

## Despliegue

- `.github/workflows/deploy.yml` sube `dist/` por FTP a `public_html` de Hostinger. Es manual (Actions > Run workflow) hasta el lanzamiento; sin los secrets `FTP_SERVER`, `FTP_USERNAME` y `FTP_PASSWORD` se omite con un aviso.
- `.github/workflows/ci.yml` corre `check` y `build` en PRs y ramas.
- Vista previa: `.github/workflows/preview.yml` sube `dist/` a Cloudflare Pages (proyecto `antidoto-web`) en cada push con `wrangler`. Cada rama tiene su URL `<rama>.antidoto-web.pages.dev` y `main` publica en `antidoto-web.pages.dev`; la URL queda en el resumen del job. Necesita los secrets `CLOUDFLARE_API_TOKEN` (permiso Cloudflare Pages: Edit) y `CLOUDFLARE_ACCOUNT_ID`; sin ellos se omite con un aviso. `public/_headers` pone `noindex` a las URLs `*.pages.dev`.
- `public/.htaccess` trae redirecciones HTTPS y sin www, 404 real, cabeceras de seguridad (CSP en Report-Only) y caché.

## Pendiente

- Contenido del cliente: textos finales, traducción revisada al inglés, fotos de diseño de productos y audiovisual, foto de la fundadora, logos de clientes en SVG y autorización para mostrarlos.
- Páginas: portafolio, FAQ, política de tratamiento de datos (Ley 1581 de 2012). La foto de la fundadora falta (hoy va un monograma marcado "Foto pendiente").
- Confirmar la sede: el sitio dice "Colombia" y no una ciudad porque el cliente no la ha confirmado.
- Service worker para la PWA, paneles de admin y clientes (fase 2).
