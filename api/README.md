# API de Antídoto

Función Node en Vercel con Turso (libSQL, SQLite) como base, Drizzle y un store privado de Vercel Blob para imágenes y archivos. Guarda las solicitudes del cotizador, las conversaciones del chat con IA, el contenido que el equipo publica en el sitio y los proyectos con sus clientes. Sirve el panel de administración (`/admin/`) y el portal de proyectos para clientes (`/portal/`).

## Qué hace

- **Leads:** `POST /v1/leads` recibe lo que arma el cotizador de `/contacto/`, solo si la persona marca la autorización de datos. Valida los campos y tiene trampa para bots, tiempo mínimo y límite de 5 envíos por IP y hora. Guarda el lead, la prueba del consentimiento (versión, texto, fecha y hash de IP) y avisa por correo al equipo y a quien pidió la cotización. Si la persona habló con el chat en la misma visita, el lead queda ligado a esa conversación.
- **Seguimiento:** sin tareas programadas. Cuando alguien usa el panel (como mucho cada 5 minutos, `src/pendientes.ts`) se avisa una vez por lead cuando sigue en "nuevo" después de `HORAS_SEGUIMIENTO` (24 por defecto), limpia enlaces y sesiones vencidos y borra las conversaciones de más de 90 días.
- **Ley 1581:** supresión de datos desde el panel (solo admin). Borra lo personal del lead, revoca la autorización, suprime su suscripción, su conversación del chat y su contacto en las organizaciones, y conserva solo servicio, fechas y estado para las métricas.

Si la API falla o no está configurada, el cotizador sigue abriendo WhatsApp igual (fail-open).

### Panel de administración

Preact y Vite en `admin/` (sin router ni librerías de estado: unos 15 KB gzip de base y cada pantalla se carga aparte). Vite lo construye en `dist-admin/` (`npm run admin:build`) y la API lo sirve (`src/panel.ts`) y una CSP estricta: nada en línea ni de otros dominios. Todas las rutas de la interfaz devuelven el mismo `index.html`; los enlaces viejos de la bandeja (`/admin/#<id>`) llevan a las rutas nuevas.

- **Acceso:** enlace mágico por correo, de un solo uso y que vence en 15 minutos. `GET /auth/entrar?t=` no lo gasta: redirige a `/admin/entrar#t=…` (el token va en el fragmento, que no viaja al servidor) y un botón hace el POST. Sesión de 30 días que se cierra tras 7 sin usar el panel (`DIAS_INACTIVIDAD`), en una cookie `__Host-antidoto`, `HttpOnly`, `SameSite=Lax`. Pedir el enlace responde al instante y lo mismo exista o no el correo: la búsqueda y el envío van después de responder. Cupos por hora: 10 pedidos por IP, 5 enlaces por persona desde cada IP y 20 en total por persona (`puedeMandarEnlace`, que comparte el portal); así nadie deja a otra persona sin enlace pidiéndolo con su correo. Los tokens se guardan solo como SHA-256. Cada persona ve y cierra sus sesiones en *Mi cuenta*.
- **Roles** (`src/permisos.ts`): admin, comercial, producción, contenido y solo lectura. La API aplica la matriz en cada ruta (`src/rutas/`); el panel solo esconde lo que no se puede usar. Suprimir datos, gestionar el equipo, los ajustes, la auditoría y publicar en producción son solo de admin. El valor de los proyectos solo lo ven admin y comercial.
- **Auditoría** (`src/auditoria.ts`): cada cambio que sale bien queda con quién, qué y cuándo, sin datos personales en el detalle.
- **Ajustes** (`src/configuracion.ts`): encender o apagar el chat, su tope diario, el regalo por suscribirse y el video del hero (estos dos los lee el build del sitio en `GET /v1/ajustes`).
- **Pantallas:** Inicio (lo que pide atención según el rol), Solicitudes, Conversaciones, Proyectos, Organizaciones, Campañas, Contactos, Contenido, Métricas, Equipo, Ajustes, Auditoría y Sistema. Ctrl+K busca en todo lo que el rol puede ver.
- **Exportaciones:** solicitudes, contactos, conversaciones (sin el texto) y proyectos, en CSV protegido contra fórmulas.
- **Sistema** (`src/rutas/sistema.ts`): qué servicios están configurados (sin mostrar secretos), última revisión de pendientes, última publicación y filas por tabla.

### Contenido del sitio

El equipo publica artículos del blog, casos, vacantes, preguntas frecuentes y clientes desde el panel (`src/contenido/esquemas.ts` declara los campos y la validación de cada tipo; el panel arma el formulario con eso). Los servicios, las ofertas y los textos de interfaz siguen en el código.

- **Borrador y copia publicada:** guardar deja un borrador (puede ir incompleto) y la versión anterior en el historial (las últimas 20, restaurables). Publicar exige todo en los dos idiomas y una dirección que no use otra entrada, y guarda una foto aparte: editar algo publicado no cambia el sitio hasta volver a publicarlo. Lo que alguna vez salió en el sitio se archiva, no se borra.
- **Imágenes:** PNG, JPEG o WebP de hasta 4 MB (el tope de cuerpo de una función de Vercel), validadas por sus primeros bytes (nunca SVG), en `medios/` de Blob (`src/archivos.ts`). Se sirven en `/v1/medios/<id>`.
- **Lectura pública:** `GET /v1/contenido?tipo=` devuelve solo lo publicado, con las URL de sus imágenes. El build del sitio lo lee con el cargador de `../src/lib/cms/`, que baja las imágenes para que `astro:assets` las optimice.
- **Publicar el sitio** (`src/publicacion.ts`): el sitio es estático, así que publicar es volver a construirlo. La API dispara el workflow de GitHub (`preview.yml`, o `deploy.yml` para producción, solo admin), que construye el sitio y lo publica en Vercel. Varios pedidos en 2 minutos se juntan en uno y los que fallen se reintentan al usar el panel. Necesita `GITHUB_DISPATCH_TOKEN` y `GITHUB_REPO`.

### Proyectos y portal de clientes

- **Proyectos** (`src/rutas/proyectos.ts`): una solicitud ganada se convierte en proyecto con su organización (se reutiliza si ya existe con el mismo nombre) y su contacto. Arranca con las etapas de la plantilla de su línea (`src/proyectos/plantillas.ts`) y suma tareas, entregables con estados de revisión y versiones, archivos y una bitácora. Lo que el cliente ve va marcado como visible. No duplica la plataforma de misiones: el proyecto solo guarda su enlace.
- **Archivos:** `archivos/` del store privado de Blob, con subida directa del navegador, hasta 50 MB por archivo. Solo se descargan con sesión, siempre como adjunto y con `nosniff`.
- **Organizaciones:** ficha con contactos, proyectos, solicitudes, conversaciones del chat que llevaron a cotizar y accesos al portal.
- **Portal** (`src/portal/`, interfaz en `admin/src/portal/`): el cliente entra con su propio enlace mágico (otra tabla, otros enlaces, otras sesiones y la cookie `__Host-antidoto-cliente` con `SameSite=Strict`), ve solo los proyectos de su organización y lo marcado como visible, descarga los archivos, aprueba los entregables o pide cambios y comenta. El equipo da y quita accesos desde la ficha de la organización (permiso `portal.gestionar`). Cuando un entregable visible pasa a revisión les llega un correo; cuando el cliente aprueba, pide cambios o comenta, le llega al responsable. Mientras no haya control del DNS comparte origen con el panel; conviene moverlo a `portal.antidotocolombia.com`.

### Plataforma de misiones

La plataforma de misiones es otro proyecto (`../antidoto`, Next.js con su propia base). El panel es su puerta de entrada, sin copiar sus datos:

- **Sección Misiones** (`/admin/misiones`), más un bloque en Inicio y en Métricas: actividades activas, participantes, cuántos terminan, empresas y participantes nuevos por semana. Se lee de `GET /api/panel/resumen` de misiones cada vez. Si misiones no responde, el panel contesta 502 en esas rutas y lo demás sigue.
- **Entrada sin otra contraseña** (`POST /admin/api/misiones/pase`, permiso `misiones.gestionar`, solo rol Admin): el panel firma un pase de 60 segundos y un solo uso con el correo de la persona; misiones lo canjea en `/admin/entrar` por su sesión de superadmin (crea la cuenta la primera vez, sin contraseña). Los admins de empresa siguen entrando allá con usuario y contraseña.
- **Organización y empresa**: `organizaciones.mision_empresa_id` (migración 0012) guarda el id de la empresa en misiones. Desde la ficha se enlaza con una que ya existe o se crea con el mismo nombre (`PUT /admin/api/organizaciones/<id>/misiones`), y la ficha muestra sus actividades, códigos y avance. Una empresa pertenece a una sola organización.
- **Pases** (`src/misiones.ts`): `v1.<datos>.<HMAC-SHA256>` en base64url, con `uso` (`entrar` o `api`), `exp` y `jti`. Los verifica `src/lib/panel-pass.ts` en misiones: si el formato cambia aquí, cambia allá.
- **Variables**: `MISIONES_URL` y `MISIONES_SECRETO` (32 caracteres o más, el mismo valor que `PANEL_SHARED_SECRET` en misiones). Sin ellas la sección dice que no está conectada. Permisos: `misiones.ver` (admin, comercial, producción y solo lectura) y `misiones.gestionar` (admin).

### Email marketing

- **Suscripción:** desde el formulario del pie del sitio o con la segunda casilla del cotizador ("Quiero recibir novedades"). Es una autorización aparte de la del lead, con su propio texto y versión en `src/data/consentimiento.json`.
- **Doble confirmación:** la persona recibe un correo y queda `activo` solo cuando confirma. El GET de la página no confirma, así que los filtros de correo no la activan solos. El equipo puede invitar a alguien desde el panel; su autorización se registra cuando confirma.
- **Campañas** (panel > Campañas):
  - Asunto, texto de vista previa y mensaje en un formato simple (títulos, negrita, listas, botones, imágenes y `{{nombre}}`), con vista previa del correo real.
  - Audiencia por idioma y, si quieres, por servicios de interés.
  - Prueba a tu correo.
  - Al enviar se pide confirmar el número de destinatarios, y se rechaza si cambió mientras tanto.
- **Envío:**
  - Lotes de 100 con la API de lotes de Resend: salen todos al pulsar Enviar, uno tras otro. Lo que no alcance a salir (por ejemplo, si Resend limita) sale la próxima vez que alguien use el panel.
  - Reclamar cada lote es atómico, así que nadie recibe dos veces.
  - Si Resend está limitado o caído, se reintenta hasta 3 veces.
  - Quien se da de baja antes de que salga su lote no recibe nada.
- **Baja de un clic:** cada correo trae un enlace de baja y las cabeceras `List-Unsubscribe` y `List-Unsubscribe-Post` (RFC 8058), que Gmail y Yahoo exigen a quien envía en volumen.
- **Webhook de Resend** (`/v1/resend/webhook`, firmado con Svix):
  - Registra entregas, aperturas, clics, rebotes y quejas.
  - Un rebote permanente marca al contacto como `rebotado` y una queja lo da de baja.
  - Las métricas de cada campaña salen de aquí.
- **Supresión:** un admin borra el correo, el nombre y la organización del contacto, y se revoca su autorización.
- **Páginas en el sitio:** los enlaces de confirmar, baja y preferencias apuntan a la API (así sirven los correos viejos y la baja de un clic), pero su GET redirige a `/novedades/preferencias/` del sitio (`SITIO_URL`). Ahí los botones son formularios normales que hacen POST a la API, y la API vuelve al sitio con el resultado. La baja de un clic de RFC 8058 (cuerpo `List-Unsubscribe=One-Click`) responde 200 sin redirigir.
- **Preferencias y pausa:** desde cualquier correo la persona elige temas, idioma o una pausa de 1, 3 o 6 meses. Quien está en pausa no entra en la audiencia.
- **Correos automáticos** (panel > Campañas > Correos automáticos):
  - Bienvenida al confirmar, editable en español e inglés, con vista previa y prueba. `{{sitio}}` es la URL del sitio. Si hay regalo (una guía), su enlace va aquí y su nombre en `REGALO_NOVEDADES` del sitio.
  - Un solo recordatorio a quien se suscribió en el sitio y no confirmó en 48 horas (no a los invitados).
- **Importar CSV** (panel > Contactos): cada persona nueva queda pendiente y recibe una invitación; salen por lotes cuando alguien usa el panel. Quien ya estaba, incluido quien se dio de baja, no se toca.
- **Campañas avanzadas:** programar el envío, prueba A/B de asunto (una muestra se parte en A y B; pasadas las horas elegidas el resto recibe la de más clics, o más aperturas), plantillas y duplicar.
- **Archivo público:** las campañas marcadas como públicas se listan en `/novedades/` del sitio (`GET /v1/novedades`). Cada correo tiene versión web (`/v1/novedades/<id>`), que es también el "Ver en el navegador" del correo.
- **Métricas de la lista** (panel > Métricas): altas, confirmaciones y bajas por semana, activos y en pausa, confirmación por origen (home, pie, cotizador, importados...) y apertura de las campañas. La ficha de cada lead dice si está suscrito y qué abrió.

### Chat con IA

Un asistente en todas las páginas indexables del sitio (`src/components/Asesor.astro`), con Claude Haiku 4.5. Sale de la receta del asesor de codebymike.net (skill `chat-ia`). **La IA prepara la venta; la cierra el equipo.**

- `GET /v1/asesor` dice si está disponible; `POST /v1/asesor` responde una pregunta. Solo desde los orígenes del sitio.
- **Sabe lo que publica el sitio:** `scripts/empaquetar-conocimiento.mjs` arma `src/asesor/publico.gen.ts` desde los Markdown de servicios y de ofertas (sin borradores), `src/data/soluciones.ts`, `src/data/faq.ts` (las mismas preguntas de `/preguntas-frecuentes/`) y `src/data/clientes.ts`, y el resto sale de `src/i18n/ui.ts`. Enlaza a la página de cada línea, oferta y solución. Lo que está entre corchetes en el sitio (dato pendiente del cliente) no entra: el asesor dice que el equipo lo confirma por WhatsApp. Si cambia un texto, se redespliega la API.
- **Sin precios:** Antídoto no publica tarifas, así que no hay herramienta de cálculo y la guardia de cifras (`guardia.ts`) rechaza cualquier cifra de dinero. Con una cifra hay un reintento; si insiste, sale un texto de respaldo que manda a WhatsApp.
- **Herramientas:** `preparar_whatsapp` (el servidor arma el mensaje en primera persona; si el modelo cuela una cifra o un dato de contacto, ese campo se descarta) y `pedir_contacto` (enlace al cotizador con `?servicio=`, donde la persona deja sus datos con autorización).
- **Historial:** lo guarda el navegador en `sessionStorage` y lo reenvía; el servidor solo toma texto, con roles alternados y largos acotados. Teléfonos y correos se tapan antes de llegar al modelo.
- **Conversaciones guardadas** (`guardado.ts`, panel > Conversaciones): el sitio manda un id de conversación de la pestaña (UUID v4) y el origen (burbuja o facilitador). Cada pregunta guarda solo su turno (pregunta y respuesta, con teléfonos y correos tapados, herramientas, respaldo, tokens y costo) con un índice único, así que un reintento no duplica y un historial alterado no reescribe lo guardado. El tope de 30 preguntas lo cuenta el servidor. Guardar falla abierto. Se borran a los 90 días (al usar el panel, `src/pendientes.ts`); el visitante las borra con "empezar de nuevo" (`POST /v1/asesor/borrar`) y admin desde el panel. Si en la misma visita la persona cotiza con la autorización marcada, el lead queda ligado a su conversación. Los contadores del día (`gasto_asesor`) no llevan datos personales y sobreviven al borrado. Los temas de cada pregunta se clasifican por palabras clave (`temas.ts`), sin modelo.
- **Lo publicado en el panel:** las preguntas frecuentes y los clientes publicados desde el panel se suman a lo empaquetado (`publicado.ts`, 5 minutos en memoria); una pregunta del panel con la misma clave reemplaza a la del sitio.
- **Costo:** tope diario en USD (el de panel > Ajustes o, si no hay, `ASESOR_TOPE_DIARIO_USD`, 1 por defecto) en la tabla `gasto_asesor`, por día de Bogotá. **Falla cerrado:** sin clave, apagado desde Ajustes o si no se puede leer el gasto, el chat no responde y ofrece solo WhatsApp. Además, 60 preguntas por IP y hora, 30 por conversación, 700 tokens por respuesta y 4 llamadas al modelo por pregunta. El prompt mide unos 2.300 tokens, por debajo del mínimo de caché de Haiku: cada pregunta cuesta unos US$0,005.
- **Aviso al equipo:** cuando el asesor prepara WhatsApp o lleva al cotizador, sale un correo a `MAIL_EQUIPO` con el resumen (sin datos personales), máximo 2 por IP y hora.

## Local

```sh
cd api
npm install
cp .env.ejemplo .env                           # ENTORNO=local: acepta localhost e imprime los correos
npm run crear-admin -- tu@correo.com "Tu nombre"
npm run dev                                    # construye el panel y abre http://127.0.0.1:8787/admin/
```

`npm run dev` aplica las migraciones a la base local (`.local/antidoto.db`), empaqueta `src/plataforma/local.ts` con esbuild y lo corre con Node; al guardar un archivo se reinicia solo. Las imágenes y los archivos quedan en `.local/`. Sin `RESEND_API_KEY`, el enlace de acceso sale en la consola. Para cambiar el panel mientras corre la API, deja `npm run admin:watch` en otra terminal: Vite reconstruye `dist-admin/` y la API sirve lo nuevo (con la CSP y la cookie reales). Para que el sitio envíe leads a esta API, levanta el sitio con `PUBLIC_API_URL=http://127.0.0.1:8787 npm run build && npm run preview`; ese build también lee el contenido publicado en el panel (en local, si la API no responde, solo avisa).

Para el chat con IA, agrega `ANTHROPIC_API_KEY` a `.env`. Para probarlo sin gastar, apunta `ANTHROPIC_URL` a un Claude falso (solo se respeta con `ENTORNO=local`).

- `npm test`: pruebas de la API (de punta a punta contra una base libSQL y un almacén en carpetas temporales) y del panel (componentes en happy-dom).
- `npm run check`: tipos de la API, de las pruebas y del panel.
- Cambios de esquema: edita `src/db/schema.ts`, corre `npm run migraciones:generar`, revisa el SQL (SQLite no recrea bien tablas con llaves foráneas: ver `0005_cimientos.sql`) y versiona la migración nueva. `npm run migrar` las aplica a la base de `TURSO_DATABASE_URL`.

## Producción (Vercel)

Una función Node (Fluid Compute) con Turso (libSQL) como base y un store **privado** de Vercel Blob para imágenes y archivos. `src/plataforma/vercel.ts` arma el `Env` (cliente de Turso, Blob y los archivos del panel desde el disco) y `scripts/vercel-build.mjs` empaqueta todo con la Build Output API, sin tareas programadas.

Una función de Vercel no recibe cuerpos de más de 4,5 MB, así que las imágenes del contenido van hasta 4 MB y los archivos de entregables suben directo del navegador a Blob con una URL firmada para una sola clave (`src/plataforma/subida-blob.ts`) y después se registran. La IP sale de `x-real-ip`, que pone Vercel.

1. **Proyecto:** no hay proyecto aparte. La API va en el mismo proyecto que el sitio, `antidoto-web`: el `vercel.json` de la raíz corre `scripts/vercel-build.mjs`, que llama a `npm run vercel-build` de esta carpeta (la función en `functions/_api.func`) y la publica junto al sitio en `/v1/`, `/admin/`, `/portal/`, `/auth/` y `/salud`.
2. **Base:** crea una base en Turso (Marketplace de Vercel: `vercel integration add turso`, o en turso.tech) y pon `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` **solo en Production**: las vistas previas no deben escribir en la base real. El build de producción aplica las migraciones (`npm run migrar`).
3. **Archivos:** crea un store de Blob **privado** (`vercel blob create-store antidoto --access private`) y conéctalo al proyecto (queda `BLOB_STORE_ID` o `BLOB_READ_WRITE_TOKEN`). Sin él, el panel no sube imágenes ni archivos.
4. **Variables:** `SAL_IP`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `GITHUB_DISPATCH_TOKEN` y, para la sección Misiones, `MISIONES_URL` y `MISIONES_SECRETO`. `APP_URL` y `SITIO_URL` son por defecto el dominio de producción del proyecto. Los demás valores por defecto están en `VARS` de `src/plataforma/vercel.ts`; una variable de Vercel con el mismo nombre los reemplaza.
5. **Sin tareas programadas:** la API no usa Vercel Cron. Lo que antes corría solo (campañas programadas, lotes pendientes, invitaciones, avisos de solicitudes sin respuesta, recordatorios y borrado de conversaciones vencidas) corre cuando alguien usa el panel, como mucho cada 5 minutos (`src/pendientes.ts`). Todo funciona en el plan gratis de Vercel.
6. **Sitio:** no hay nada que conectar: el build pone `PUBLIC_API_URL` en el dominio del despliegue. Revisa `ORIGENES` si el sitio sale por otro dominio.
7. **Primer admin:** con las variables de Turso de producción, `TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run crear-admin -- antidoto.colombia@outlook.com "María Paula"`.

   Desde ahí, las demás personas se agregan en el panel, en *Equipo*, cada una con su rol.

Servicios externos:

- **Correo:** crea una cuenta en Resend, verifica el dominio `antidotocolombia.com` (los registros DNS van donde quede el DNS del dominio) y guarda la clave como `RESEND_API_KEY`. Si el remitente va a ser otro, cambia `MAIL_FROM`.
  - **DMARC:** Resend crea SPF y DKIM, pero Gmail y Yahoo exigen además un registro DMARC a quien envía en volumen. Empieza con `_dmarc.antidotocolombia.com TXT "v=DMARC1; p=none; rua=mailto:<correo>"` y súbelo a `quarantine` cuando los informes salgan limpios.
  - **Subdominio para campañas (recomendado):** verifica también un subdominio (por ejemplo `news.antidotocolombia.com`) y usa `MAIL_FROM_NOVEDADES = "Antídoto <novedades@news.antidotocolombia.com>"`. Así la reputación de las campañas no afecta los enlaces de acceso ni los avisos de leads, y el seguimiento de clics (que reescribe enlaces) no toca los correos de acceso.
  - **Plan:** el plan gratis de Resend permite 100 correos al día. Una campaña a más personas sale en partes: lo que Resend no acepte ese día sale la próxima vez que alguien use el panel.
  - **Pie legal:** pon la razón social y el domicilio en `MAIL_DIRECCION`. Sin ella, las campañas dicen solo "Antídoto · Estudio creativo empresarial · Colombia".
  - **Sitio:** `SITIO_URL` es el sitio al que redirigen confirmar, baja y preferencias.
- **Sal de IP:** un texto aleatorio largo en `SAL_IP` (por ejemplo `openssl rand -base64 32`).
- **Webhook de Resend (métricas de campañas):** en Resend > Webhooks crea uno hacia `https://antidotocolombia.com/v1/resend/webhook` con los eventos `email.delivered`, `email.opened`, `email.clicked`, `email.bounced` y `email.complained`, y guarda su *signing secret* (`whsec_…`) como `RESEND_WEBHOOK_SECRET`. Para contar aperturas y clics, activa el seguimiento de aperturas y clics del dominio en Resend.
- **Chat con IA:** crea una clave en la consola de Claude, ponle un límite de gasto mensual allá también y guárdala como `ANTHROPIC_API_KEY`. El tope diario se cambia en panel > Ajustes (o en `ASESOR_TOPE_DIARIO_USD`, que es el valor por defecto). Antes de abrirlo al público, prueba las preguntas trampa de la skill `chat-ia` (`references/pruebas.md`).
- **Publicar desde el panel:** crea en GitHub un token *fine-grained* solo para este repositorio, con el permiso *Actions: Read and write* y con vencimiento, y guárdalo como `GITHUB_DISPATCH_TOKEN`. El panel dispara `deploy.yml` (producción en Vercel) o `preview.yml` (vista previa), que necesitan los secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID` del proyecto `antidoto-web`.

## Estructura

- `src/index.ts`: rutas públicas y acceso; las del panel van por módulos en `src/rutas/` (cada uno exige su permiso).
- `src/panel.ts`: archivos del panel y del portal con su CSP.
- `src/plataforma/`: la API en Vercel (Turso, Blob, subida directa y función Node) y en local (`local.ts`, base y archivos en `.local/`). `scripts/vercel-build.mjs` la empaqueta; `scripts/migrar.mjs` aplica las migraciones y `scripts/crear-admin.mjs` crea admins.
- `src/leads.ts` y `src/validar.ts`: alta y validación de leads.
- `src/auth.ts`: enlace mágico y sesiones del equipo. `src/portal/`: acceso y API del portal de clientes.
- `src/permisos.ts`, `src/auditoria.ts`, `src/configuracion.ts`: roles, bitácora y ajustes.
- `src/dominio.ts`: catálogos sin dependencias que comparten la API, el esquema y el panel.
- `src/admin.ts`: leads, métricas, CSV y equipo.
- `src/rutas/`: `leads`, `marketing`, `equipo` (cuenta, ajustes, auditoría), `inicio` (resumen y buscador), `conversaciones`, `contenido`, `proyectos`, `accesos` (portal), `sistema` y `exportar`.
- `src/contenido/`: esquemas del contenido editable y lecturas públicas para el build. `src/archivos.ts`: validación de imágenes. `src/publicacion.ts`: publicar el sitio.
- `src/proyectos/plantillas.ts`: etapas por línea.
- `src/seguimiento.ts`: aviso de leads sin respuesta. `src/pendientes.ts`: lo pendiente que corre al usar el panel.
- `src/correo.ts`: Resend y plantillas.
- `src/marketing/`: suscripciones, confirmación, baja y preferencias (`suscripciones.ts`), enlaces de los correos (`enlaces.ts`), formato de campañas (`render.ts`), motor de envío con programación y prueba A/B (`envios.ts`), bienvenida, recordatorio e invitaciones (`automaticos.ts`), archivo público (`publico.ts`), webhook de Resend (`webhook.ts`) y API del panel (`admin.ts`).
- `src/asesor/`: chat con IA. Prompt (`prompt.ts`), conocimiento (`conocimiento.ts` y lo publicado en el panel en `publicado.ts`), herramientas, bucle con el modelo inyectado (`bucle.ts`), guardia de cifras, costo y tope diario (`costo.ts`, `presupuesto.ts`), conversaciones guardadas (`guardado.ts`), temas (`temas.ts`), llamada a la API de Claude con `fetch` (`motor.ts`) y ruta (`ruta.ts`).
- `src/db/schema.ts`: modelo de datos. Migraciones en `migraciones/`.
- `admin/`: panel y portal en Preact (`index.html` y `portal.html`), con pruebas en `admin/test/`.
- El texto de la autorización vive en `../src/data/consentimiento.ts` y lo comparten el sitio y la API.
