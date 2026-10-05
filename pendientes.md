# Pendientes

## Documentación (/docs/) al 03/10/2026

Revisión pendiente tras actualizar `src/data/docs/`.

- [x] Páginas `/novedades/` y `/novedades/preferencias/` (y `/en/news/` y `/en/news/preferences/`). Hechas y probadas con la API en local; RF-46, HU-32 y K-49 ya están como implementados.
- [x] ~~Marcar RF-28 y RF-30 como parciales~~: ya no hace falta, las páginas existen.
- [x] Reflejar en el kanban y en los requisitos el sitio multipágina: K-34 hecho, RF-01, RF-05, RF-11 (parcial: faltan casos) y RF-47 actualizados. RF-48 sigue parcial por las respuestas pendientes.
- [ ] Activar el asesor en producción: secret `ANTHROPIC_API_KEY` y prueba con la API real (preguntas trampa de la receta `chat-ia`). Cubre RF-39 y HU-30.
- [x] Medir de nuevo el rendimiento (LCP y JS inicial) con el hero actual, el asesor y las secciones nuevas (05/10/2026, cifras en CLAUDE.md, dentro del presupuesto). Falta confirmarlo con PageSpeed Insights sobre la URL publicada. Cubre RNF-01 a RNF-03.
- [ ] Auditoría de accesibilidad formal posterior al rediseño. Cubre RNF-06.
- [ ] Pasar la CSP de Report-Only a enforcement tras revisar la consola. Cubre RNF-12.
- [ ] Decidir con el dueño si `/docs/` debe seguir desplegándose con el sitio público o quedarse solo en desarrollo.

## Sitio multipágina (03/10/2026)

El sitio ya tiene páginas e índices reales: líneas y ofertas, soluciones por área, portafolio, empresa, preguntas frecuentes, blog, legales y mapa del sitio, en los dos idiomas. Lo que queda:

### Técnico

- [x] Migas de pan en `/novedades/` y `/en/news/` (05/10/2026). `npm run verificar` ya corre en el CI después del build.
- [x] El asesor lee las preguntas de `src/data/faq.ts` (se borró `inicio.faq.items` de `ui.ts`) y conoce las ofertas y las soluciones, con enlace a sus páginas (05/10/2026). Hay que redesplegar el Worker para que lo use.
- [x] Barra inferior de WhatsApp: borrada por decisión del dueño (05/10/2026). La burbuja recibe el mensaje de cada página y, sin la API, queda solo con WhatsApp. RF-07 ajustado. Antes: Ahora que todas las páginas usan `tema="claro"`, `BarraWhatsapp` ya no aparece en ninguna. O se activa en las internas (cuidando que no choque con el botón del asesor) o se borra y se ajusta RF-07.
- [x] (05/10/2026, comparado con capturas antes y después) Limpiar el diseño oscuro que quedó sin uso: `Ambiente`, `BarraWhatsapp` (según lo anterior), `tema="oscuro"` en `Base.astro` y las clases `.panel`, `.btn`, `.eyebrow` y `.mono` de `global.css` que ya nadie use. El bloque de movimiento reducido de `global.css` repite reglas de `.resaltado`, `.boton` y `.pendiente`: revisar.
- [x] (05/10/2026) Cotizador: hoy acepta `?servicio=`. Sumar `?oferta=` para que el mensaje de WhatsApp nombre la oferta desde la que llegó la persona.
- [ ] Analítica sin cookies (Plausible o Cloudflare Web Analytics) con eventos de clic a WhatsApp, envío del cotizador y uso del asesor. Al activarla, completar la sección "Medición" de `/cookies/`.
- [ ] Prueba de accesibilidad del mega menú con lector de pantalla (NVDA y VoiceOver). La de solo teclado ya se hizo (05/10/2026): en escritorio, Tab, Enter, Esc y el foco al cerrar funcionan; en móvil, el Tab después de abrir Menú salía del panel y se corrigió poniendo el botón antes del panel en el DOM. También capturas con movimiento reducido de las páginas nuevas. Hasta ahora solo se verificó con capturas en 1440 y 390 px.
- [x] (05/10/2026: 68,6 KB gzip y LCP de 0,7 a 1,7 s) Medir el JS inicial y el LCP de las páginas nuevas (línea, oferta, solución) contra el presupuesto. Solo se sumó el script de la nav, pero no se midió con las importaciones dinámicas.
- [ ] Cuando haya varios casos o artículos: filtros como páginas propias en el portafolio (hoy son anclas) y búsqueda estática con Pagefind para el blog.
- [x] Imagen OG propia de cada línea, oferta y solución, en los dos idiomas (05/10/2026): se generan en el build (`src/lib/og.ts`). Cuando haya casos y artículos, sumarlos en `src/pages/og/[locale]/[nombre].jpg.ts` con su foto propia.
- [ ] Los avisos de colección vacía de `casos` y `blog` en el build desaparecen con el primer caso o artículo. No son errores.

### Para validar con el cliente (los escribí yo a partir del brief)

- [ ] Las 17 ofertas de formaciones, audiovisual, catering y diseño (`src/content/ofertas/`): nombre, descripción corta y "Para". Salen de los `includes` de cada servicio, pero las descripciones son redacción mía.
- [ ] Qué ofertas se recomiendan para cada área y qué retos de la home se muestran en cada una (`src/data/soluciones.ts`), y a qué página lleva cada dolor de la home (`src/components/home/Dolores.astro`).
- [ ] Las preguntas frecuentes nuevas que no venían de la home (`src/data/faq.ts`): público, combinar servicios, colegios, calidad de video, cobertura del catering, diseño y cotización.
- [ ] Textos de Trabaja con nosotros (aliados y talento) y de los borradores de términos y cookies. Los dos legales necesitan además la revisión del abogado, igual que la política de datos.

### Contenido que falta del cliente (hoy se ve en cajas `.pendiente`)

- [ ] Detalle de cada oferta: qué incluye, formato, duración, entregables y 2 o 3 fotos. Va en el cuerpo del Markdown y en `incluye` de cada archivo de `src/content/ofertas/`.
- [ ] Descripción larga de cada línea (metodología, formatos, diferenciales), en el cuerpo de `src/content/servicios/<clave>.<idioma>.md`.
- [ ] Casos del portafolio con autorización escrita (plantilla en `src/content/casos/_plantilla.md`): uno por línea como mínimo, y uno por área para las páginas de soluciones.
- [ ] Primeros artículos del blog y quién los escribe (plantilla en `src/content/blog/_plantilla.md`). Mientras no haya artículos publicados, el blog no aparece en la nav.
- [ ] Retos típicos de colegios y universidades para su página de solución.
- [ ] Respuestas pendientes de la FAQ: sede y ciudades, uso de la IA en las formaciones, tiempo de entrega de un video, pedido mínimo de catering y tiempo de respuesta a una cotización.
- [ ] Cómo trabajamos: entregables al cierre y tiempos de respuesta y anticipación por servicio.
- [ ] Nosotros: foto de la fundadora, integrantes del equipo y datos de la licencia de SST (resolución, entidad y campos de acción).
- [ ] Vacantes abiertas, si las hay, para Trabaja con nosotros.

## Email marketing con Resend (novedades)

Estado al 03/10/2026: el código está completo y probado (suscripción con doble confirmación, bienvenida, recordatorio, preferencias y pausa, campañas programadas, prueba A/B, plantillas, importación CSV, archivo público y métricas). Falta activarlo y los datos del cliente. Detalle técnico en `api/README.md`, sección Producción.

### Para activarlo (técnico)

- [ ] Token de Cloudflare con permisos *Workers Scripts: Edit*, *D1: Edit* y *Account Settings: Read*, además de Pages.
- [ ] Desplegar la API (Actions > *API (Cloudflare Worker)*). Aplica sola la migración `0004_novedades.sql`.
- [ ] Guardar la URL de la API como variable `PUBLIC_API_URL` en GitHub. Sin ella no aparecen la sección de la home, el formulario del pie ni el archivo `/novedades/`. Lo ideal es un dominio propio (`api.antidotocolombia.com`).
- [ ] Revisar `SITIO_URL` en `api/wrangler.toml` (hoy `https://antidotocolombia.com`): es a donde redirigen confirmar, baja y preferencias. Mientras el rediseño no esté publicado en ese dominio, esos enlaces llevarían a la SPA vieja.
- [ ] Primer admin en la base de producción (`api/README.md`, paso 7).
- [ ] Secret `SAL_IP` (texto aleatorio largo).

### Resend y DNS (en Hostinger)

- [ ] Cuenta en Resend, dominio `antidotocolombia.com` verificado (SPF y DKIM) y secret `RESEND_API_KEY` en GitHub.
- [ ] Registro DMARC: `_dmarc.antidotocolombia.com TXT "v=DMARC1; p=none; rua=mailto:<correo>"`. Gmail y Yahoo lo exigen a quien envía en volumen. Subirlo a `quarantine` cuando los informes salgan limpios.
- [ ] Recomendado: subdominio solo para campañas (por ejemplo `news.antidotocolombia.com`), verificado en Resend, y `MAIL_FROM_NOVEDADES` apuntando a él. Separa la reputación de las campañas de la de los correos de acceso y avisos de leads.
- [ ] Webhook de Resend hacia `<URL de la API>/v1/resend/webhook` con `email.delivered`, `email.opened`, `email.clicked`, `email.bounced` y `email.complained`, y su secreto como `RESEND_WEBHOOK_SECRET`. Sin él no hay métricas de campañas ni bajas automáticas por rebote o queja.
- [ ] Activar en Resend el seguimiento de aperturas y clics del dominio de campañas (sin eso la prueba A/B no tiene con qué decidir).
- [ ] Plan Pro de Resend cuando la lista pase de unas 100 personas: el gratis permite 100 correos al día.

### Datos del cliente (tarjeta K-54 en /docs/)

- [ ] Frecuencia de envío. Hoy se ve como "[FRECUENCIA DE ENVÍO]" en una caja pendiente en la home y en `/novedades/`.
- [ ] Razón social y domicilio para el pie legal de las campañas: `MAIL_DIRECCION` en `api/wrangler.toml`. Es el mismo dato que falta en la política de datos.
- [ ] Regalo por suscribirse (opcional, por ejemplo una guía en PDF). Cuando exista: su nombre en `REGALO_NOVEDADES` (`src/data/site.ts`) y su enlace en el correo de bienvenida (bandeja > Campañas > Correos automáticos).
- [ ] Revisar y ajustar el texto de bienvenida por defecto en los dos idiomas desde la bandeja.
- [ ] Revisión del abogado: incluir en la política de datos la finalidad de novedades, la pausa y la importación de contactos (invitaciones a personas con relación previa).

### Antes del primer envío real

- [ ] Enviarse una prueba de la bienvenida y de una campaña y revisarlas en Gmail, Outlook y el celular.
- [ ] Si se importan contactos, hacerlo solo con personas que ya tienen relación con Antídoto (clientes, asistentes, aliados).

## Indexación: buscadores y asistentes de IA

Revisión del 03/10/2026. El rediseño ya tiene HTML estático, `canonical`, `hreflang`, sitemap, `noindex` donde toca, JSON-LD por idioma y `/llms.txt`. Lo que sigue depende del cliente o del lanzamiento.

### Urgente: el sitio publicado hoy (SPA de React)

Mientras no se lance el rediseño, antidotocolombia.com sigue así:

- El `canonical`, el `og:url` y el `og:image` apuntan a `https://antidoto.com`, un dominio que no es el del cliente. Eso le dice a Google que la página original está en otro sitio.
- El HTML llega vacío (`<div id="root"></div>`). Los rastreadores de IA (GPTBot, ClaudeBot, PerplexityBot) no ejecutan JS y solo ven el título y la descripción.
- Cualquier URL responde 200 con la portada, incluida `/sitemap-index.xml`: 404 disfrazados y ningún sitemap real.
- Los textos ofrecen "diseño gráfico" y "capacitaciones bilingües", que ya no coinciden con la oferta.

La solución es lanzar el rediseño. Si el lanzamiento se demora, al menos hay que corregir el `canonical` de la SPA.

### Lanzamiento

- [ ] Redirecciones 301 en `public/.htaccess` de las URLs viejas de la SPA hacia las nuevas. Antes, revisar en Search Console cuáles tiene indexadas Google.
- [ ] Google Search Console: verificar el dominio, enviar `https://antidotocolombia.com/sitemap-index.xml` y revisar la cobertura.
- [ ] Bing Webmaster Tools: verificar el dominio y enviar el sitemap. ChatGPT search y Copilot usan el índice de Bing.
- [ ] Opcional: IndexNow, para avisarle a Bing de los cambios sin esperar al rastreo.
- [ ] Decidir con el cliente sobre los bots de IA. Hoy `robots.txt` deja pasar a todos. Si quiere aparecer en las respuestas de los chats pero no en el entrenamiento de modelos, se bloquean `GPTBot` y `Google-Extended` y se dejan `OAI-SearchBot`, `PerplexityBot` y `Claude-SearchBot`. Para un negocio que busca clientes, lo normal es dejarlo abierto.

### Contenido del cliente

- [ ] Más sustancia en cada página de servicio. Hoy las internas tienen entre 240 y 350 palabras. Faltan: qué incluye, para quién es, formatos, duración, casos y preguntas frecuentes del servicio. Es lo que más pesa para que Google y los chats citen a Antídoto en búsquedas como "formaciones vivenciales para empresas en Colombia".
- [ ] Sede y ciudades. Con eso se agrega `address` al JSON-LD de la organización (`src/data/schema.ts`), se completa la respuesta de la FAQ de la home que hoy va entre corchetes y se crea el perfil de Google Business para las búsquedas locales.
- [ ] Respuestas finales de la FAQ (`src/data/faq.ts`). El JSON-LD `FAQPage` ya existe en `/preguntas-frecuentes/` y en cada línea, y omite las respuestas que siguen entre corchetes: se completará solo al llenarlas. Google ya casi no lo muestra como resultado enriquecido, pero sí sirve para que los asistentes de IA entiendan el contenido.
- [x] (05/10/2026, ver Técnico) Una imagen OG por servicio (1200 × 630). Antes todas las páginas compartían `og/antidoto-og.jpg`. Mejora cómo se ven los enlaces en WhatsApp, LinkedIn y los chats.
- [ ] Opcional: un correo con el dominio propio en lugar de `antidoto.colombia@outlook.com`. Da más confianza a quien llega por primera vez.

### Decidido no hacer

- `lastmod` en el sitemap: el sitio no tiene una fecha real de cambio por página, y poner la del build en todas sería un dato falso que Google aprende a ignorar.
- `hreflang` en el sitemap para las páginas internas: el plugin de Astro solo empareja rutas iguales, y los slugs cambian entre idiomas. El `hreflang` ya está en el HTML de cada página, y eso basta.
- `alt` en las fotos de la home: las del hero, las de las tarjetas de dolores y la ventana de `/servicios/` son decorativas o están ocultas para lectores de pantalla, así que `alt=""` es lo correcto.
