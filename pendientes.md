# Pendientes

Estado al 21/10/2026. El kanban de `/docs/` (`src/data/docs/iteraciones.ts`) lleva las mismas tarjetas; al cerrar algo, márcalo aquí y allá.

## Puesta en marcha (técnico)

Todo va en un solo proyecto de Vercel, `antidoto-web`. Pasos detallados en `api/README.md`, sección *Producción (Vercel)*.

### Vercel y GitHub (K-67)

- [x] Turso `db-antidoto`, Blob privado `antidoto-archivos` y `SAL_IP` en Production (18/10/2026).
- [ ] Apuntar el DNS de `antidotocolombia.com` al proyecto. Al tenerlo, `PORTAL.url` (`src/data/site.ts`) pasa a `juegos.antidotocolombia.com`.
- [ ] Borrar el proyecto `antidoto-api`, creado por error.
- [ ] Secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID` en GitHub, para `deploy.yml` y el job `vercel` de `preview.yml`.
- [ ] Token fine-grained `GITHUB_DISPATCH_TOKEN` (Actions: Read and write) en las variables de Vercel, para publicar desde el panel (K-63).
- [ ] Primer admin en la base de producción (`api/README.md`, paso 7) (K-30).

### Correo con Resend (K-30)

- [ ] Cuenta en Resend, dominio `antidotocolombia.com` verificado (SPF y DKIM) y `RESEND_API_KEY` en Vercel.
- [ ] Registro DMARC: `_dmarc.antidotocolombia.com TXT "v=DMARC1; p=none; rua=mailto:<correo>"`. Subirlo a `quarantine` cuando los informes salgan limpios.
- [ ] Recomendado: subdominio solo para campañas (por ejemplo `news.antidotocolombia.com`) y `MAIL_FROM_NOVEDADES` apuntando a él.
- [ ] Webhook hacia `https://antidotocolombia.com/v1/resend/webhook` con `email.delivered`, `email.opened`, `email.clicked`, `email.bounced` y `email.complained`, y su secreto como `RESEND_WEBHOOK_SECRET`.
- [ ] Seguimiento de aperturas y clics del dominio de campañas (sin eso la prueba A/B no decide).
- [ ] `MAIL_DIRECCION` en Vercel con la razón social y el domicilio de `EMPRESA` (`src/data/site.ts`) para el pie legal de las campañas. El dato ya existe; falta la variable.
- Límite del plan gratis: 100 correos al día. Una campaña más grande sale en partes.

### Antes de abrirlo al público

- [ ] Chat con IA: repetir en producción las preguntas trampa de la skill `chat-ia` (la prueba del 03/10/2026 se hizo con la API en local).
- [ ] Enviarse una prueba de la bienvenida y de una campaña y revisarlas en Gmail, Outlook y el celular.
- [ ] Si se importan contactos, solo personas con relación previa con Antídoto (clientes, asistentes, aliados).
- [ ] Pasar la CSP de Report-Only a enforcement tras revisar la consola (RNF-12, K-80).
- [ ] Confirmar el rendimiento con PageSpeed Insights sobre la URL publicada (RNF-01 a RNF-03). La medición local del 05/10/2026 está en `CLAUDE.md`.
- [ ] Prueba con lector de pantalla (NVDA y VoiceOver) del mega menú, el cotizador y el chat (RNF-06, K-81). La auditoría con axe y la de solo teclado ya están.
- [ ] Decidir con el dueño si `/docs/` sigue desplegándose con el sitio público o se queda solo en desarrollo.

## Indexación y lanzamiento (K-51)

El rediseño ya tiene HTML estático, `canonical`, `hreflang`, sitemap, `noindex` donde toca, JSON-LD por idioma (con la dirección de la sede) y `/llms.txt`.

Mientras no se lance, antidotocolombia.com sigue con la SPA de React: `canonical`, `og:url` y `og:image` apuntan a `https://antidoto.com`, el HTML llega vacío para los rastreadores de IA, cualquier URL responde 200 con la portada y los textos ya no coinciden con la oferta. La solución es lanzar el rediseño.

- [ ] Redirecciones 301 de las URLs viejas de la SPA hacia las nuevas (rutas en `scripts/vercel-build.mjs`). Antes, revisar en Search Console cuáles tiene indexadas Google.
- [ ] Google Search Console: verificar el dominio, enviar `https://antidotocolombia.com/sitemap-index.xml` y revisar la cobertura.
- [ ] Bing Webmaster Tools: verificar el dominio y enviar el sitemap. ChatGPT search y Copilot usan el índice de Bing.
- [ ] Opcional: IndexNow.
- [ ] Decidir con el cliente sobre los bots de IA. Hoy `robots.txt` deja pasar a todos; para aparecer en los chats sin entrar al entrenamiento se bloquean `GPTBot` y `Google-Extended` y se dejan `OAI-SearchBot`, `PerplexityBot` y `Claude-SearchBot`.
- [ ] Perfil de Google Business con la sede (Pontevedra, Bogotá).
- [ ] Opcional: un correo con el dominio propio en lugar de `antidoto.colombia@outlook.com`.

### Decidido no hacer

- `lastmod` en el sitemap: no hay una fecha real de cambio por página, y la del build en todas sería un dato falso.
- `hreflang` en el sitemap para las internas: los slugs cambian entre idiomas y el `hreflang` ya está en el HTML.
- `alt` en las fotos decorativas de la home: `alt=""` es lo correcto.

## Desarrollo que sigue

- [ ] Cotización formal con aprobación desde un enlace (RF-21, K-31).
- [ ] Facturas de consulta desde Siigo o Alegra en el portal y mover el portal a un subdominio cuando haya DNS (RF-37, K-32).
- [ ] Notificaciones dentro del panel (K-64).
- [ ] Archivos de entregables de más de 50 MB.
- [ ] Decidir qué hacer con los tokens de suscripción, que hoy se guardan en claro en `contactos.token` (auditoría OWASP del 21/10/2026, K-82). No basta con guardar el hash: la API necesita el token para armar el enlace de baja y `List-Unsubscribe` de cada campaña. Opciones: derivarlo con HMAC del id del contacto y un secreto nuevo en Vercel (si el secreto se pierde o cambia, se rompen los enlaces de baja ya enviados; los actuales seguirían con una búsqueda de respaldo), o dejarlo así (con la base filtrada se podría dar de baja o cambiar preferencias, pero esa copia ya trae todos los datos). Recomendación: dejarlo así.
- [ ] Cuando haya varios casos o artículos: filtros como páginas propias en el portafolio, Pagefind en el blog, y su imagen OG en `src/pages/og/[locale]/[nombre].jpg.ts`.
- [ ] Servicios, ofertas y textos de interfaz editables desde el panel (hoy siguen en Markdown y en `ui.ts`). Solo si Antídoto lo necesita.
- Los avisos de colección vacía de `casos` y `blog` en el build desaparecen con el primer caso o artículo. No son errores.

## Del cliente

Lo que falta no se muestra en el sitio: ningún bloque vacío ni texto entre corchetes.

### Textos y traducciones

- [ ] Textos finales y traducción revisada al inglés (K-35).
- [ ] Revisión del portugués por una persona nativa y quién atiende en portugués por WhatsApp y correo (K-78).
- [ ] Validar lo que se escribió a partir del brief: las 17 ofertas (`src/content/ofertas/`), las ofertas recomendadas y los retos por área (`src/data/soluciones.ts`), a qué página lleva cada dolor de la home (`home/Dolores.astro`), las preguntas frecuentes nuevas y los textos de Trabaja con nosotros.
- [ ] Confirmaciones de María Paula (K-76): verbos de las auditorías de `/sg-sst/`, los nombres "Misiones Antídoto" y "Detecta el riesgo", la duración de cada juego y qué cuenta cada cifra.

### Contenido

- [ ] Detalle de cada oferta (qué incluye, formato, duración, entregables y 2 o 3 fotos) y descripción larga de cada línea (K-52).
- [ ] Respuestas pendientes de la FAQ: uso de la IA en las formaciones, tiempo de entrega de un video, pedido mínimo de catering y tiempo de respuesta a una cotización (K-53).
- [ ] Casos del portafolio con autorización escrita (plantilla en `src/content/casos/_plantilla.md`), uno por línea como mínimo.
- [ ] Primeros artículos del blog y quién los escribe.
- [ ] Retos típicos de colegios y universidades para su página de solución.
- [ ] Cómo trabajamos: entregables al cierre y tiempos por servicio.
- [ ] Equipo y vacantes abiertas, si las hay.
- [ ] Fotos de diseño de productos, audiovisual y la fundadora (en el hero va un monograma) (K-36).
- [ ] Clip de 720p para el fondo del hero (`VIDEO_HERO`, K-29, RNF-05).
- [ ] Logos de clientes en SVG y autorización escrita para cada uno (K-37). Se publican desde el panel.
- [ ] Novedades (K-54): frecuencia de envío y, si lo hay, el regalo por suscribirse (`REGALO_NOVEDADES` en `src/data/site.ts` y su enlace en la bienvenida). Revisar el texto de bienvenida por defecto en los tres idiomas desde el panel.

### Legal (K-38, K-66)

- [ ] Revisión del abogado de la política de datos (razón social, NIT y domicilio ya están), incluida la finalidad de novedades, la pausa y la importación de contactos.
- [ ] Revisión de los borradores de términos y cookies, que siguen con `noindex`.
- [ ] Revisión del chat guardado (aviso y retención de 90 días) y del tratamiento de los contactos de clientes en el portal.

### Traspaso de cuentas (K-75)

- [ ] Repositorio, Vercel, Turso, Resend y Anthropic a nombre de Antídoto, con codebymike como colaborador. Al mover el proyecto de equipo en Vercel, cambiar `EQUIPO_VERCEL` en `api/src/cors.ts`.
- [ ] DNS exportado del primer programador.
- [ ] Clave `ANTHROPIC_API_KEY`: vence el 03/10/2027. Límite de gasto de la organización: bajarlo de US$50 a US$20 al mes en noviembre.
