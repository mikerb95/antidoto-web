# Pendientes

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
- [ ] Respuestas finales de la FAQ de la home. Cuando no queden datos entre corchetes, agregar el JSON-LD `FAQPage`. Google ya casi no lo muestra como resultado enriquecido, pero sí sirve para que los asistentes de IA entiendan el contenido.
- [ ] Una imagen OG por servicio (1200 × 630). Hoy todas las páginas comparten `og/antidoto-og.jpg`. Mejora cómo se ven los enlaces en WhatsApp, LinkedIn y los chats.
- [ ] Opcional: un correo con el dominio propio en lugar de `antidoto.colombia@outlook.com`. Da más confianza a quien llega por primera vez.

### Decidido no hacer

- `lastmod` en el sitemap: el sitio no tiene una fecha real de cambio por página, y poner la del build en todas sería un dato falso que Google aprende a ignorar.
- `hreflang` en el sitemap para las páginas internas: el plugin de Astro solo empareja rutas iguales, y los slugs cambian entre idiomas. El `hreflang` ya está en el HTML de cada página, y eso basta.
- `alt` en las fotos de la home: las del hero, las de las tarjetas de dolores y la ventana de `/servicios/` son decorativas o están ocultas para lectores de pantalla, así que `alt=""` es lo correcto.
