# Auditoría técnica: antidotocolombia.com

Fecha: 22 de septiembre de 2026
Alcance: home one-page en producción (`https://antidotocolombia.com/`), build del 13 de enero de 2026 (`index-D-jNzWn8.js`).
Método: `curl`/`openssl`/`dig` para red, cabeceras, TLS y DNS; análisis estático del bundle JS/CSS; revisión en Chrome (desktop 1440 px y móvil 390 px); Lighthouse (móvil y desktop). Sin escaneo de puertos ni pruebas intrusivas.

Severidad: **Crítico** (rompe negocio, SEO o seguridad hoy) · **Alto** (impacto claro, arreglar este sprint) · **Medio** · **Bajo**.

---

## 0. Resumen ejecutivo

| # | Hallazgo | Área | Severidad |
|---|---|---|---|
| 1 | `canonical`, `og:url`, `og:image`, `twitter:image` y el JSON-LD apuntan a `antidoto.com`, un dominio ajeno (hoy muestra "antidoto.com - Temporary Home Page") | SEO | Crítico |
| 2 | Al compartir el enlace por WhatsApp/LinkedIn no hay imagen de vista previa (las imágenes OG no existen) | SEO / Negocio | Crítico |
| 3 | Las tarjetas de contacto (WhatsApp, Instagram, Correo) son `div` con `onClick` que abren el enlace en un `setTimeout` de 800 ms: no son enlaces, no se pueden usar con teclado y los bloqueadores de popups (Safari iOS en particular) pueden bloquearlos | UX / A11y / Conversión | Crítico |
| 4 | JS y CSS se sirven **sin compresión** (solo el HTML va con gzip): 360 KB de JS que serían 114 KB | Red | Alto |
| 5 | Video del hero móvil de **9 MB**, 480x854, con pista de audio, `moov` al final (sin faststart) y `preload="auto"` | Red / UX | Alto |
| 6 | Sin cabeceras de seguridad (HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy). El sitio se puede incrustar en un iframe (clickjacking comprobado) | Seguridad | Alto |
| 7 | Servidor anuncia `nginx/1.22.0 (Ubuntu)`: esa versión empaquetada corresponde a Ubuntu 22.10/23.04, ambas sin soporte de seguridad (verificar) | Infra | Alto |
| 8 | Todo se renderiza en cliente (`<div id="root"></div>` vacío). Bots sin JS (redes sociales, varios buscadores y crawlers de IA) ven una página vacía | SEO | Alto |
| 9 | Soft 404: cualquier URL (`/lo-que-sea`, `/sitemap.xml`, `/favicon.ico`, `/.env`) responde 200 con la home. `www` y sin `www` sirven ambos 200 (contenido duplicado) | SEO | Alto |
| 10 | Sin `sitemap.xml`, sin analítica ni medición de clics a WhatsApp: no hay forma de saber qué convierte | SEO / Negocio | Medio |

Lighthouse (22/09/2026, Lighthouse 13.5.0, emulación por defecto):

| Categoría | Móvil | Desktop |
|---|---|---|
| Performance | 74 | 77 |
| Accesibilidad | 85 | 85 |
| Buenas prácticas | 100 | 100 |
| SEO | 92 (engañoso, ver §1) | 92 |
| FCP | 3,3 s | 0,9 s |
| LCP | 3,5 s | 3,5 s |
| TBT | 310 ms | 60 ms |
| Speed Index | 5,7 s | 1,8 s |
| TTI | 7,0 s | 3,6 s |
| Peso total | 5,1 MB | 8,3 MB |
| Trabajo en hilo principal | 6,0 s | 2,1 s |

---

## 1. SEO y metadatos

### Crítico
- **Canonical a dominio ajeno.** `<link rel="canonical" href="https://antidoto.com" />`. Le dice a Google que la versión "oficial" de la página es otro sitio. `antidoto.com` responde 200 con una página temporal de otro dueño. Riesgo real de que Google ignore o consolide mal la home. Lighthouse no lo marca porque un canonical cross-domain es técnicamente válido, por eso el 92 en SEO es engañoso.
- **Open Graph / Twitter roto.** `og:url`, `og:image` (`https://antidoto.com/og-image.jpg`) y `twitter:image` apuntan al dominio ajeno. Además `/og-image.jpg` y `/twitter-image.jpg` tampoco existen en el dominio propio (devuelven el HTML de la home). Resultado: cada vez que alguien comparte el sitio por WhatsApp (el canal principal de venta) sale sin imagen.
- **JSON-LD con placeholders.** `"telephone": "+57-xxx-xxx-xxxx"`, `"https://wa.me/57xxxxxxxxx"`, `url` y `logo` en `antidoto.com`, `sameAs` a perfiles que no son los reales (`instagram.com/antidoto` en vez de `instagram.com/antidoto.colombia`; `linkedin.com/company/antidoto` en vez de `.../antidoto-colombia-s-a-s/`). `services` no es una propiedad válida de `Organization` (usar `hasOfferCatalog`/`makesOffer`). `availableLanguage` omite inglés aunque el sitio dice "3 idiomas".

### Alto
- **Render solo en cliente (CSR).** El HTML inicial no tiene contenido. Google renderiza JS con retraso; las vistas previas sociales, Bing en parte y los crawlers de IA (GPTBot, ClaudeBot, PerplexityBot) no ejecutan JS. Recomendación: pre-render estático (SSG) de la home.
- **Soft 404 y hosts duplicados.** Toda ruta devuelve 200 con la home. El router solo define `/` y `*`, así que cualquier otra URL debería ser 404 real. `https://www.` y `https://` sirven lo mismo sin redirección: elegir uno (recomendado sin `www`) y redirigir con 301.
- **Sin `sitemap.xml`** (la ruta devuelve HTML) y `robots.txt` sin directiva `Sitemap:`. Las reglas por bot son redundantes (todas `Allow: /`).
- **Una sola URL para cuatro servicios.** No hay páginas por servicio, así que no se puede posicionar para búsquedas concretas ("catering empresarial Bogotá", "videos de inducción SST", "formaciones vivenciales para colegios"). Oportunidad: landings por servicio.

### Medio
- `<title>` de 85 caracteres (Google corta ~60) y `description` de 210 (recomendado 140 a 160). Propuesta:
  - Title (60): `Antídoto | Formaciones, audiovisual y catering para empresas`
  - Description: `Estudio creativo empresarial en Colombia: formaciones vivenciales, producción audiovisual, catering corporativo y diseño de experiencias para empresas.`
- **El mensaje de los meta no coincide con el sitio.** Meta: "diseño gráfico", "capacitaciones bilingües". Sitio: "diseño de productos y experiencias", "formaciones vivenciales en 3 idiomas".
- `<meta name="keywords">`: obsoleta, se puede quitar.
- **Jerarquía de encabezados rota.** Dos `H1` en desktop (el del hero y un párrafo largo en "Soluciones"); en móvil el `H1` del hero queda oculto y el mensaje visible está incrustado en el video. Los títulos de sección son `H3` debajo de `H2` de servicios (orden invertido; Lighthouse `heading-order` en rojo).
- **Imágenes sin `alt`**: las 11 fotos del carrusel (x2 en el DOM). 10 logos de clientes tienen literalmente `alt="name"` (placeholder sin reemplazar, x4 por el marquee).
- Favicon declarado como `type="image/png"` pero es `.svg`. No hay `favicon.ico` (devuelve HTML), `apple-touch-icon`, `manifest` ni `theme-color`.

### Bajo
- Falta `hreflang` solo si en el futuro hay versiones en portugués/inglés.
- Añadir `LocalBusiness`/`ProfessionalService` con ciudad si hay sede física, y enlazar el perfil de Google Business.

### Propuesta de `<head>` corregido (referencia)
```html
<title>Antídoto | Formaciones, audiovisual y catering para empresas</title>
<meta name="description" content="Estudio creativo empresarial en Colombia: formaciones vivenciales, producción audiovisual, catering corporativo y diseño de experiencias para empresas." />
<link rel="canonical" href="https://antidotocolombia.com/" />
<meta name="theme-color" content="#0F181D" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="icon" href="/favicon.ico" sizes="32x32" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="Antídoto" />
<meta property="og:locale" content="es_CO" />
<meta property="og:url" content="https://antidotocolombia.com/" />
<meta property="og:title" content="Antídoto: experiencias que conectan, inspiran y transforman" />
<meta property="og:description" content="Formaciones vivenciales, producción audiovisual, catering corporativo y diseño para empresas, colegios y organizaciones." />
<meta property="og:image" content="https://antidotocolombia.com/og/antidoto-og.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Antídoto, estudio creativo empresarial" />
<meta name="twitter:card" content="summary_large_image" />
```

```json
{
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "@id": "https://antidotocolombia.com/#org",
  "name": "Antídoto",
  "legalName": "Antídoto S.A.S. (confirmar razón social)",
  "url": "https://antidotocolombia.com/",
  "logo": "https://antidotocolombia.com/logo-512.png",
  "image": "https://antidotocolombia.com/og/antidoto-og.jpg",
  "description": "Estudio creativo empresarial: formaciones vivenciales, producción audiovisual, catering corporativo y diseño de productos y experiencias.",
  "telephone": "+57 312 556 8016",
  "email": "antidoto.colombia@outlook.com",
  "foundingDate": "2020",
  "founder": { "@type": "Person", "name": "María Paula Ramos", "jobTitle": "CEO y fundadora" },
  "areaServed": { "@type": "Country", "name": "Colombia" },
  "knowsLanguage": ["es", "pt", "en"],
  "sameAs": [
    "https://www.instagram.com/antidoto.colombia/",
    "https://www.linkedin.com/company/antidoto-colombia-s-a-s/"
  ],
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Servicios",
    "itemListElement": [
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Formaciones vivenciales" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Producción audiovisual y digital" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Catering corporativo" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Diseño de productos y experiencias" } }
    ]
  }
}
```

---

## 2. Red y rendimiento

### Hallazgos medidos
| Recurso | Hoy | Problema | Objetivo |
|---|---|---|---|
| `index-*.js` | 360 KB sin comprimir | nginx solo comprime `text/html` (falta `gzip_types`) | ~114 KB gzip, <100 KB brotli |
| `index-*.css` | 41 KB sin comprimir | igual | ~7 KB gzip |
| `hero.mp4` (solo móvil) | 8,98 MB, 480x854, H.264 2,5 Mbps + AAC, 28,6 s | `preload="auto"`, audio innecesario (va en mute), `moov` al final: no arranca hasta leer el final del archivo. En pantallas 3x se ve borroso (480 px estirados a ~1170 px) | ≤1,5 MB, sin audio, `+faststart`, WebM/AV1 + MP4, `preload="none"`/`metadata` |
| `video-poster.png` | 833 KB PNG, 506x904 | Se descarga también en desktop aunque el contenedor está oculto (`lg:hidden`) | AVIF/WebP ~40 KB, solo en móvil |
| Carrusel `img1..img11.jpg` | 1,8 MB en total, todas en carga inicial | Sin `loading="lazy"` salvo la primera, sin `srcset`, sin WebP/AVIF, sin `width/height`, duplicadas en el DOM (versión móvil + desktop) | 1.ª imagen con `fetchpriority="high"`, resto lazy, AVIF/WebP con `srcset` |
| Foto fundadora | 144 KB, 1280x960 para un avatar de 120x120 | Además vive en un bucket Supabase de **otro proyecto** (`elevarte_imgs`) | Local, 240x240 AVIF (~10 KB) |
| Fuentes | 325 KB en TTF (CalSans, Modulus, Poppins), `Content-Type: application/octet-stream` | Sin WOFF2, sin subset, sin `preload`. `Inter` y `Playfair Display` se usan en CSS pero no se cargan (fallback a Arial/serif del sistema). `font-bold` sobre fuentes de un solo peso: negrita sintética | WOFF2 con subset latino, ≤2 familias, preload de la display |
| Protocolo | HTTP/1.1 | Sin HTTP/2 ni HTTP/3: 6 conexiones para ~45 peticiones | HTTP/2 mínimo |
| Caché | Sin `Cache-Control` | Assets con hash deberían ser `immutable`. Lighthouse estima 3,7 MB de ahorro en visitas repetidas | `max-age=31536000, immutable` en `/assets/` |

### Hallazgos de runtime
- **LCP no descubrible**: la imagen/elemento LCP no está en el HTML inicial (CSR), no tiene `fetchpriority` y espera a que el JS descargue y ejecute. En móvil el LCP es el logo; en desktop, `img1.jpg` (3,5 s en ambos).
- **117 KB de JS sin usar** en carga inicial y 1,6 s de bootup en móvil.
- **Parallax con `setState` en scroll**: el hero aplica `transform` inline recalculado en cada evento de scroll (con `transition: 0.1s`), lo que provoca re-render de React y reflows forzados (Lighthouse `forced-reflow-insight`). Usar motion values (`useScroll`/`useTransform`) o CSS scroll-driven.
- **97 `<img>` en el DOM**: logos x4 y testimonios x2 por los marquees, carrusel x2.
- El FCP móvil de 3,3 s es casi todo espera de JS: con pre-render bajaría a <1,5 s.

### Configuración de video recomendada (ffmpeg)
```bash
# MP4 ligero, sin audio, arranque rápido
ffmpeg -i hero.mp4 -an -vf "scale=720:-2" -c:v libx264 -crf 28 -preset slow -movflags +faststart hero-720.mp4
# WebM (AV1) para navegadores modernos
ffmpeg -i hero.mp4 -an -vf "scale=720:-2" -c:v libsvtav1 -crf 38 -b:v 0 hero-720.webm
# Poster en WebP (~30-50 KB)
ffmpeg -i hero.mp4 -frames:v 1 -vf "scale=720:-2" -c:v libwebp -quality 75 poster.webp
```

---

## 3. Seguridad (cabeceras, XSS, superficie)

### Cabeceras ausentes (Alto)
| Cabecera | Estado | Recomendación |
|---|---|---|
| `Strict-Transport-Security` | Ausente | `max-age=31536000; includeSubDomains` (luego `preload`) |
| `Content-Security-Policy` | Ausente | Empezar en `Report-Only` (ver config) |
| `X-Frame-Options` / `frame-ancestors` | Ausente. **Comprobado**: la página carga dentro de un iframe de terceros | `DENY` + `frame-ancestors 'none'` |
| `X-Content-Type-Options` | Ausente | `nosniff` |
| `Referrer-Policy` | Ausente | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Ausente | `camera=(), microphone=(), geolocation=(), payment=()` |
| `Server` | `nginx/1.22.0 (Ubuntu)` expone versión | `server_tokens off;` |

### XSS (Bajo)
- No hay formularios, parámetros reflejados ni sinks peligrosos en código de la app: las 14 apariciones de `dangerouslySetInnerHTML`/`innerHTML` en el bundle son internas de React. Sondas con `?q=<script>` y rutas con payload: sin reflexión.
- React escapa el contenido. **Riesgo actual bajo**, pero sin CSP no hay defensa en profundidad si una dependencia se compromete.
- Si se añade el cotizador/formulario propuesto: validar en cliente y servidor, no renderizar entradas con HTML y mantener CSP estricta.
- `window.open(url, "_blank")` sin `noopener`: la página abierta (wa.me) recibe `window.opener`. Riesgo bajo al ser WhatsApp, pero usar enlaces `<a rel="noopener">` lo elimina.

### Infraestructura (Alto / Medio)
- **SO probablemente sin soporte.** `nginx/1.22.0 (Ubuntu)` es el paquete de Ubuntu 22.10 (fin de soporte jul 2023) o 23.04 (fin de soporte ene 2024). Verificar con `lsb_release -a`; si aplica, el droplet no recibe parches de seguridad. Migrar a Ubuntu 24.04 LTS o sacar el sitio estático a un hosting gestionado.
- **TLS correcto**: solo TLS 1.2 y 1.3, certificado Let's Encrypt válido hasta el 31/10/2026 (confirmar que la renovación automática funciona).
- **DNS (DigitalOcean)**: sin registro CAA, sin IPv6, sin SPF ni DMARC. Como el dominio no envía correo, publicar `v=spf1 -all` y `_dmarc` con `p=reject` evita que suplanten `@antidotocolombia.com` en phishing.
- **Dependencia externa frágil**: la foto de la fundadora se sirve desde el Supabase de otro proyecto (`yahanudbuxwjkhcybtsc.supabase.co/.../elevarte_imgs/paula.jpeg`). Si ese proyecto se borra, la imagen desaparece.
- Correcto: sin source maps expuestos, `/assets/` sin listado (403), `TRACE`/`OPTIONS` devuelven 405.

### Configuración nginx recomendada (referencia)
```nginx
# /etc/nginx/snippets/antidoto-headers.conf
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
add_header Content-Security-Policy-Report-Only "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" always;
```

```nginx
server_tokens off;

server {
    listen 80;
    server_name antidotocolombia.com www.antidotocolombia.com;
    return 301 https://antidotocolombia.com$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.antidotocolombia.com;
    # ssl_certificate / ssl_certificate_key: los mismos de certbot
    return 301 https://antidotocolombia.com$request_uri;
}

server {
    listen 443 ssl http2;
    server_name antidotocolombia.com;
    root /var/www/antidoto/dist;

    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types text/css application/javascript application/json image/svg+xml font/ttf application/xml text/plain;

    include snippets/antidoto-headers.conf;

    # Ojo: un add_header dentro de location anula los del server, por eso se repite el include
    location /assets/ {
        include snippets/antidoto-headers.conf;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        try_files $uri =404;
    }

    location ~* \.(avif|webp|jpg|jpeg|png|svg|mp4|webm|woff2)$ {
        include snippets/antidoto-headers.conf;
        add_header Cache-Control "public, max-age=2592000" always;
        try_files $uri =404;
    }

    location = / {
        include snippets/antidoto-headers.conf;
        add_header Cache-Control "no-cache" always;
        try_files /index.html =404;
    }

    # One-page: cualquier otra ruta es un 404 real
    location / {
        try_files $uri =404;
    }
    error_page 404 /404.html;
}
```
Alternativa con menos mantenimiento: poner Cloudflare delante del droplet (HTTP/3, brotli, caché en borde, reglas de cabeceras) o mover el `dist/` a un hosting estático gestionado (Cloudflare Pages, Vercel, Netlify). Cualquiera de las dos resuelve de golpe compresión, protocolo, caché y parches del SO.

---

## 4. Accesibilidad (WCAG 2.2 AA)

| Problema | Criterio | Severidad |
|---|---|---|
| Tarjetas de contacto como `div` con `onClick`, `tabindex=-1`: el camino principal de conversión no es operable con teclado ni lector de pantalla | 2.1.1, 4.1.2 | Crítico |
| Teléfono y correo del footer en texto plano (sin `tel:`/`mailto:`) | 2.4.4 (buena práctica) | Medio |
| Enlace de WhatsApp del footer con `aria-label="Síguenos en Instagram"` | 2.5.3, 4.1.2 | Medio |
| 11 fotos del carrusel sin `alt`; 10 logos con `alt="name"` | 1.1.1 | Alto |
| Carrusel autoplay cada 5 s sin pausa; marquees infinitos (testimonios y logos) sin pausa | 2.2.2 | Alto |
| Sin soporte de `prefers-reduced-motion` (ni CSS ni `MotionConfig reducedMotion="user"`) | 2.3.3 | Alto |
| Contenido duplicado de los marquees sin `aria-hidden`: el lector lee testimonios x2 y logos x4 | 1.3.1 | Medio |
| Puntos del carrusel de 8x8 px (Lighthouse `target-size`) | 2.5.8 | Medio |
| Botón hamburguesa sin `aria-expanded`/`aria-controls`, sin trampa de foco ni cierre con Esc, el scroll del body no se bloquea | 4.1.2, 2.4.3 | Medio |
| Sin enlace "Saltar al contenido" | 2.4.1 | Medio |
| Anclas del menú: el título de la sección queda tapado por el nav fijo (sin `scroll-margin-top`) | 2.4.11 | Medio |
| Contenido que arranca en `opacity: 0` y depende de la animación de entrada: al saltar por ancla, la línea de tiempo aparece vacía unos segundos | 1.3.1 (robustez) | Medio |
| Encabezados fuera de orden, 2 `H1` | 1.3.1 | Medio |
| Texto de cuerpo en Modulus (ancha y fina) a 14 px en testimonios: legibilidad baja aunque pase contraste | 1.4.8 (AAA, recomendación) | Bajo |
| Sin estilos `:focus-visible` propios (1 regla en todo el CSS) | 2.4.7 | Medio |

---

## 5. UI

- **Tipografía inconsistente**: CalSans (display), Modulus (cuerpo), Poppins (UI), más `Inter` y `Playfair` declaradas pero no cargadas. Las estadísticas de servicios caen a la fuente del sistema (Arial/Liberation), se nota el cambio. CalSans con `font-bold` genera negrita sintética.
- **Iconografía mezclada**: emojis (🎬 📺 🚀 🎯 ⚡ ⭐ 🌎 📌 🤝 🎨 💡 🌍) conviven con iconos Lucide. Los emojis cambian según sistema operativo y abaratan la marca.
- **Paleta con colores fuera de marca**: verde en "Más de 50 clientes satisfechos", rosa/morado en gradientes del botón y de Instagram, naranja `#ffaa40`. La marca real es cian `#49C1EC` sobre `#0F181D`.
- **Logo mal exportado**: `antidoto.svg` tiene un lienzo de 3840x2160 con el logotipo en el centro, por eso el código usa márgenes negativos (`ml-[-27px]`) y un `h-24` dentro de un nav `h-16`. `antidoto_white.svg` es idéntico byte a byte a `antidoto.svg` (no hay versión blanca).
- **Vacíos enormes** entre secciones (200 a 300 px sin contenido) y antes del footer.
- **Cards de servicios sin imagen**: cuatro bloques de texto con borde cian brillante. Un estudio que vende producción audiovisual no muestra ni un fotograma de su trabajo en servicios.
- **Stat mal fusionado**: "Calidad 4K Ultra HD" y "Tomas aéreas con dron profesional" aparecen en la misma card. "Clientes que confían en nosotros" es un stat sin número.
- **Glow y bordes neón en casi todo**: el acento pierde fuerza por repetición.
- **`body` blanco en un sitio oscuro**: flash blanco antes de hidratar, y overscroll blanco en iOS.
- Logos de clientes en cajas blancas con rellenos distintos: se ve desordenado.

---

## 6. UX y heurísticas (Nielsen)

| Heurística | Hallazgo |
|---|---|
| 1. Visibilidad del estado | Las tarjetas de contacto esperan 800 ms sin feedback antes de abrir. Indicadores del carrusel diminutos. |
| 2. Relación con el mundo real | Desktop dice "Creamos experiencias que conectan..." y móvil dice "Todo gran evento nace de una idea" (texto incrustado en el video). Dos propuestas de valor distintas según dispositivo. |
| 3. Control y libertad | Carrusel automático sin pausa, marquees infinitos, contenido que aparece cuando la animación quiere. |
| 4. Consistencia | 3 CTAs distintos para lo mismo ("Hablemos", "Chatear Ahora", "Explorar Servicios"), 4 familias tipográficas, emojis + iconos. |
| 5. Prevención de errores | El `mailto:` se abre con `window.open` en una pestaña en blanco. |
| 6. Reconocer mejor que recordar | Correcto en general (one-page con nav por anclas). |
| 7. Flexibilidad y eficiencia | No hay forma rápida de pedir cotización con datos (servicio, fecha, personas, ciudad): todo va a un chat vacío. |
| 8. Estético y minimalista | Muchos vacíos, testimonios en muro infinito, glow en todo. |
| 9. Recuperarse de errores | No existe 404: cualquier URL mal escrita muestra la home sin avisar. |
| 10. Ayuda | Sin FAQ (cobertura geográfica, pedidos mínimos de catering, tiempos de entrega, idiomas, formatos de video). |

### Problemas de conversión y confianza
- **CTA principal débil**: el botón del hero es "Explorar Servicios" (scroll), no "Cotizar". En móvil el botón flotante es una flecha hacia abajo, justo donde debería ir un WhatsApp persistente.
- **Sin portafolio**: ni reel, ni casos, ni fotos por servicio. Para producción audiovisual es la prueba número uno.
- **Testimonios poco verificables**: solo nombre y apellido, sin empresa, cargo ni foto, repetidos en bucle. Restan credibilidad frente a los logos reales (Enel, Claro, WOM, Stanley Black & Decker, Seguros Bolívar, WSP, Gallagher).
- **Correo `@outlook.com`**: para propuestas formales a empresas conviene `@antidotocolombia.com`.
- **Hero móvil = reel vertical de Instagram** con el texto incrustado: no se lee como titular, pesa 9 MB y no se indexa.
- **Sin medición**: no hay analítica ni eventos, así que no se sabe cuántos clics a WhatsApp genera la web. Si se añade analítica o formulario, publicar política de tratamiento de datos (Ley 1581 de 2012).
- **Diferenciador desaprovechado**: la fundadora es especialista en Gerencia de SST y varios clientes son de ingeniería, energía y transporte (HSEQ, SEQ Consultores, WSP, Enel, Capital Bus). El ángulo "SST, inducciones y planes de emergencia" casi no aparece.

### Copy
- "producción audio visual" → "producción audiovisual".
- "Aprender haciendo programas con..." → "Aprender haciendo: programas con...".
- "De la idea al producto final diseñamos..." → falta coma tras "final".
- Línea de tiempo vaga: "Cambio de idea / Nunca nos fuimos, nos transformamos" no cuenta qué cambió.
- "En Antídoto convertimos tus retos en soluciones efectivas..." está marcado como `H1` y es un párrafo.

---

## 7. Diagnóstico del motion actual

Stack detectado: React 18.3.1 + React Router + Tailwind + Motion (framer-motion: `whileInView` x6, `whileHover` x15, `layoutId` x18, `useScroll` x2) + keyframes CSS (`marquee`, `marquee-vertical`, `pulse`).

| Qué hay | Problema |
|---|---|
| Parallax del hero con `setState` por evento de scroll | Re-render en cada scroll, reflows forzados, jank en móvil |
| Cards de servicios apiladas con `sticky` | En móvil el título de la card anterior queda cortado debajo de la siguiente; en el cambio se ven cards vacías |
| Reveals con `opacity: 0` inicial | Si el observer no dispara (salto por ancla, JS lento), el contenido no se ve |
| Carrusel `setInterval` 5 s | Sin pausa, sin swipe verificado, sin respeto a reduced motion |
| Marquees CSS de 17 s a 40 s | Infinitos, sin pausa, duplican DOM |
| Duraciones sueltas (200, 300, 400, 500, 700, 1000 ms) sin tokens ni curvas comunes | Movimiento sin carácter propio |
| `reducedMotion` no configurado | Todo se anima igual para quien pidió menos movimiento |

La librería correcta ya está en el proyecto. El problema no es falta de herramientas sino de sistema: no hay concepto, tokens ni reglas de accesibilidad y rendimiento.

---

## 8. Oportunidades frontend

1. **Pre-render estático** de la home (SSG): HTML con contenido, LCP descubrible, previews sociales correctos. Encaja con Vite + React (plugin de prerender) o con Astro usando islas de React para las piezas animadas.
2. **Concepto de motion propio**: el logo es un frasco con líquido (el "antídoto"). Ese líquido cian puede ser el hilo de toda la animación: se llena en el hero, "disuelve" los retos en soluciones, marca el progreso de la línea de tiempo y rellena los botones al hover.
3. **Sección de portafolio / reel** con previews en hover y lightbox con fachada ligera (sin cargar YouTube/Vimeo hasta el clic).
4. **Cotizador rápido** (servicio, fecha, personas, ciudad, tipo de organización) que arma el mensaje y abre WhatsApp con el texto prellenado. Sin backend.
5. **CTA persistente en móvil** ("Cotizar por WhatsApp") en lugar de la flecha flotante.
6. **Landings por servicio** (fase 2) con su propio título, descripción, OG y FAQ.
7. **Sistema de diseño**: 2 familias tipográficas, iconos SVG de una sola familia, tokens de color, espaciado y motion.
8. **Medición**: analítica respetuosa con la privacidad y eventos en cada CTA de contacto.

---

## 9. Plan de acción priorizado

### Semana 1: arreglos rápidos (sin rediseño)
1. Corregir `canonical`, OG, Twitter y JSON-LD (§1). Diseñar y subir la imagen OG 1200x630.
2. nginx: `gzip_types`, `http2`, `Cache-Control`, cabeceras de seguridad, `server_tokens off`, redirección `www` → apex, 404 real (§3).
3. Contacto: convertir tarjetas en `<a href>` reales sin `setTimeout`; `tel:` y `mailto:` en footer; corregir `aria-label`.
4. Recomprimir video y póster; `preload="none"` y póster solo en móvil.
5. `alt` en carrusel y logos; quitar `alt="name"`.
6. `sitemap.xml` y `Sitemap:` en `robots.txt`.
7. SPF `-all` + DMARC `p=reject`; registro CAA para Let's Encrypt.
8. Verificar versión de Ubuntu y plan de actualización.

### Semanas 2 a 4: rediseño con motion (ver `02-prompt-claude-design.md`)
- Sistema de diseño, hero nuevo, portafolio, cotizador, motion con reduced motion, pre-render.

### Fase 2
- Landings por servicio, blog/casos, correo corporativo, analítica con eventos.
