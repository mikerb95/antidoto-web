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
- View transitions con `<ClientRouter />`. Los scripts de componentes se inicializan en `astro:page-load` y limpian observers en `astro:before-swap`.
- Imágenes con `astro:assets` (WebP y `srcset` en el build). Fotos en `src/assets/fotos/`, logos de clientes en `src/assets/clientes/` (en blanco; el CSS los pasa a tinta con `filter: brightness(0)` sobre fondos claros).
- Sin React todavía. Se agrega como isla cuando haga falta interactividad real (cotizador).

## Estructura

- `src/pages/`: rutas. Español sin prefijo (`/`, `/servicios/<slug>/`), inglés en `/en/` (`/en/services/<slug>/`).
- `src/components/pages/`: plantillas de página compartidas por idioma (`Home.astro`, `Servicio.astro`).
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
- **Motion:** contenido visible por defecto (nada arranca en `opacity: 0` esperando un observer). Anima solo `transform`, `opacity` y `clip-path`. Todo bucle de más de 5 s tiene pausa y se detiene fuera de pantalla. Respeta `prefers-reduced-motion`. Tokens de duración y curvas en `global.css`.
- **Rendimiento:** presupuesto de LCP ≤ 2,5 s en móvil 4G, JS inicial ≤ 170 KB gzip, carga inicial móvil ≤ 1,5 MB.

## Despliegue

- `.github/workflows/deploy.yml` sube `dist/` por FTP a `public_html` de Hostinger en cada push a `main`. Necesita los secrets `FTP_SERVER`, `FTP_USERNAME` y `FTP_PASSWORD`.
- `.github/workflows/ci.yml` corre `check` y `build` en PRs y ramas.
- `public/.htaccess` trae redirecciones HTTPS y sin www, 404 real, cabeceras de seguridad (CSP en Report-Only) y caché.

## Pendiente

- Contenido del cliente: textos finales, traducción revisada al inglés, fotos de diseño de productos y audiovisual, foto de la fundadora, logos de clientes en SVG y autorización para mostrarlos.
- Páginas: nosotros (fundadora y línea de tiempo), portafolio, FAQ, política de tratamiento de datos (Ley 1581 de 2012).
- Cotizador de 3 pasos (isla React), service worker para la PWA, paneles de admin y clientes (fase 2).
