# API de Antídoto

Worker de Cloudflare con base D1 (SQLite) y Drizzle. Fase 1 de la lógica de negocio: las solicitudes del cotizador se guardan como leads, el equipo las gestiona en una bandeja y el sistema avisa lo que se queda sin respuesta.

## Qué hace

- **Leads:** `POST /v1/leads` recibe lo que arma el cotizador de `/contacto/`, solo si la persona marca la autorización de datos. Valida los campos y tiene trampa para bots, tiempo mínimo y límite de 5 envíos por IP y hora. Guarda el lead, la prueba del consentimiento (versión, texto, fecha y hash de IP) y avisa por correo al equipo y a quien pidió la cotización.
- **Bandeja** (`/admin/`): lista con filtros por estado, servicio y búsqueda. Estados: nuevo, contactado, cotizado, ganado y perdido. Cada lead tiene valor estimado, motivo de pérdida, notas, historial con autor y botones para responder por WhatsApp, correo o teléfono. Se puede exportar a CSV.
- **Métricas:** solicitudes por estado, servicio, origen (UTM o dominio) y mes; tasa de cierre, mediana de horas hasta la primera respuesta y valor ganado.
- **Seguimiento:** un cron horario avisa una vez por lead cuando sigue en "nuevo" después de `HORAS_SEGUIMIENTO` (24 por defecto), y limpia enlaces y sesiones vencidos.
- **Acceso del equipo:** enlace mágico por correo. El enlace es de un solo uso y vence en 15 minutos. El GET no lo gasta, así que los filtros de Outlook no lo queman. La sesión se revoca y dura 30 días en una cookie `__Host-`, `HttpOnly`, `SameSite=Lax`. Los tokens se guardan solo como SHA-256. Roles: `admin` (gestiona el equipo y suprime datos) y `equipo`.
- **Ley 1581:** supresión de datos desde la bandeja. Borra lo personal, revoca la autorización y conserva solo servicio, fechas y estado para las métricas.

Si la API falla o no está configurada, el cotizador sigue abriendo WhatsApp igual (fail-open).

### Email marketing

- **Suscripción:** desde el formulario del pie del sitio o con la segunda casilla del cotizador ("Quiero recibir novedades"). Es una autorización aparte de la del lead, con su propio texto y versión en `src/data/consentimiento.json`.
- **Doble confirmación:** la persona recibe un correo y queda `activo` solo cuando confirma. El GET de la página no confirma, así que los filtros de correo no la activan solos. El equipo puede invitar a alguien desde la bandeja; su autorización se registra cuando confirma.
- **Campañas** (bandeja > Campañas):
  - Asunto, texto de vista previa y mensaje en un formato simple (títulos, negrita, listas, botones, imágenes y `{{nombre}}`), con vista previa del correo real.
  - Audiencia por idioma y, si quieres, por servicios de interés.
  - Prueba a tu correo.
  - Al enviar se pide confirmar el número de destinatarios, y se rechaza si cambió mientras tanto.
- **Envío:**
  - Lotes de 100 con la API de lotes de Resend: el primero sale al instante y el resto con un cron cada 5 minutos.
  - Reclamar cada lote es atómico, así que nadie recibe dos veces.
  - Si Resend está limitado o caído, se reintenta hasta 3 veces.
  - Quien se da de baja antes de que salga su lote no recibe nada.
- **Baja de un clic:** cada correo trae un enlace de baja y las cabeceras `List-Unsubscribe` y `List-Unsubscribe-Post` (RFC 8058), que Gmail y Yahoo exigen a quien envía en volumen.
- **Webhook de Resend** (`/v1/resend/webhook`, firmado con Svix):
  - Registra entregas, aperturas, clics, rebotes y quejas.
  - Un rebote permanente marca al contacto como `rebotado` y una queja lo da de baja.
  - Las métricas de cada campaña salen de aquí.
- **Supresión:** un admin borra el correo, el nombre y la organización del contacto, y se revoca su autorización.

### Chat con IA

Un asistente en todas las páginas indexables del sitio (`src/components/Asesor.astro`), con Claude Haiku 4.5. Sale de la receta del asesor de codebymike.net (skill `chat-ia`). **La IA prepara la venta; la cierra el equipo.**

- `GET /v1/asesor` dice si está disponible; `POST /v1/asesor` responde una pregunta. Solo desde los orígenes del sitio.
- **Sabe lo que publica el sitio:** `scripts/empaquetar-conocimiento.mjs` arma `src/asesor/publico.gen.ts` desde los Markdown de servicios (sin borradores) y `src/data/clientes.ts`, y el resto sale de `src/i18n/ui.ts`. Lo que está entre corchetes en el sitio (dato pendiente del cliente) no entra: el asesor dice que el equipo lo confirma por WhatsApp. Si cambia un texto, se redespliega el Worker.
- **Sin precios:** Antídoto no publica tarifas, así que no hay herramienta de cálculo y la guardia de cifras (`guardia.ts`) rechaza cualquier cifra de dinero. Con una cifra hay un reintento; si insiste, sale un texto de respaldo que manda a WhatsApp.
- **Herramientas:** `preparar_whatsapp` (el servidor arma el mensaje en primera persona; si el modelo cuela una cifra o un dato de contacto, ese campo se descarta) y `pedir_contacto` (enlace al cotizador con `?servicio=`, donde la persona deja sus datos con autorización).
- **Historial:** lo guarda el navegador en `sessionStorage` y lo reenvía; el servidor solo toma texto, con roles alternados y largos acotados. Teléfonos y correos se tapan antes de llegar al modelo.
- **Costo:** tope diario en USD (`ASESOR_TOPE_DIARIO_USD`, 1 por defecto) en la tabla `gasto_asesor`, por día de Bogotá. **Falla cerrado:** sin clave o si no se puede leer el gasto, el chat no responde y ofrece solo WhatsApp. Además, 60 preguntas por IP y hora, 30 por conversación, 700 tokens por respuesta y 4 llamadas al modelo por pregunta. El prompt mide unos 2.300 tokens, por debajo del mínimo de caché de Haiku: cada pregunta cuesta unos US$0,005.
- **Aviso al equipo:** cuando el asesor prepara WhatsApp o lleva al cotizador, sale un correo a `MAIL_EQUIPO` con el resumen (sin datos personales), máximo 2 por IP y hora.

## Local

```sh
cd api
npm install
cp .dev.vars.ejemplo .dev.vars                 # ENTORNO=local: acepta localhost e imprime los correos
npm run migraciones:local
npx wrangler d1 execute antidoto --local --command \
  "insert into usuarios (id,email,nombre,rol,activo,creado) values ('$(uuidgen)','tu@correo.com','Tu nombre','admin',1,$(date +%s)000)"
npm run dev                                    # http://localhost:8787/admin/
```

Sin `RESEND_API_KEY`, el enlace de acceso sale en la consola de `wrangler dev`. Para que el sitio envíe leads a esta API, levanta el sitio con `PUBLIC_API_URL=http://localhost:8787 npm run build && npm run preview`.

Para el chat con IA, agrega `ANTHROPIC_API_KEY` a `.dev.vars`. Para probarlo sin gastar, apunta `ANTHROPIC_URL` a un Claude falso (solo se respeta con `ENTORNO=local`).

- `npm test`: pruebas unitarias y de punta a punta contra una D1 local (miniflare).
- `npm run check`: tipos.
- Cambios de esquema: edita `src/db/schema.ts`, corre `npm run migraciones:generar` y versiona la migración nueva.

## Producción

1. **Token de Cloudflare:** al token de `CLOUDFLARE_API_TOKEN` agrégale los permisos *Workers Scripts: Edit*, *D1: Edit* y *Account Settings: Read* (hoy solo tiene Pages; el primer despliegue falló por eso).
2. **Correo:** crea una cuenta en Resend, verifica el dominio `antidotocolombia.com` (registros DNS en Hostinger) y guarda la clave como secret `RESEND_API_KEY` en GitHub. Si el remitente va a ser otro, cambia `MAIL_FROM` en `wrangler.toml`.
3. **Sal de IP:** guarda un texto aleatorio largo como secret `SAL_IP` (por ejemplo `openssl rand -base64 32`).
4. **Webhook de Resend (métricas de campañas):** en Resend > Webhooks crea uno hacia `<URL de la API>/v1/resend/webhook` con los eventos `email.delivered`, `email.opened`, `email.clicked`, `email.bounced` y `email.complained`, y guarda su *signing secret* (`whsec_…`) como secret `RESEND_WEBHOOK_SECRET`. Para contar aperturas y clics, activa el seguimiento de aperturas y clics del dominio en Resend. Las campañas salen de `MAIL_FROM_NOVEDADES` (en `wrangler.toml`).
5. **Chat con IA:** crea una clave en la consola de Claude, ponle un límite de gasto mensual allá también y guárdala como secret `ANTHROPIC_API_KEY` en GitHub. El tope diario se cambia en `ASESOR_TOPE_DIARIO_USD` de `wrangler.toml`. Antes de abrirlo al público, prueba las preguntas trampa de la skill `chat-ia` (`references/pruebas.md`).
6. **Desplegar:** en Actions, corre *API (Cloudflare Worker)*. También corre solo en cada push a `main` que toque `api/`. La primera vez crea la base D1 y, siempre, aplica las migraciones. La URL queda en el resumen del job.
7. **Conectar el sitio:** guarda esa URL como variable `PUBLIC_API_URL` en GitHub (Variables, no Secrets). El build del sitio la usa para activar el paso de contacto del cotizador, y la API la usa para los enlaces de los correos. Lo ideal es un dominio propio (`api.antidotocolombia.com`) apuntado al Worker.
8. **Primer admin:**

   ```sh
   npx wrangler d1 execute antidoto --remote --command \
     "insert into usuarios (id,email,nombre,rol,activo,creado) values ('<uuid>','antidoto.colombia@outlook.com','María Paula','admin',1,<epoch ms>)"
   ```

   Desde ahí, las demás personas se agregan en la bandeja, en *Equipo*.

## Estructura

- `src/index.ts`: rutas y cabeceras de seguridad.
- `src/leads.ts`: alta de leads.
- `src/validar.ts`: validación pura del cotizador.
- `src/auth.ts`: enlace mágico y sesiones.
- `src/admin.ts`: bandeja, métricas, CSV y equipo.
- `src/seguimiento.ts`: cron.
- `src/correo.ts`: Resend y plantillas.
- `src/marketing/`: suscripciones y baja (`suscripciones.ts`), formato de campañas (`render.ts`), motor de envío (`envios.ts`), webhook de Resend (`webhook.ts`) y API de la bandeja (`admin.ts`).
- `src/asesor/`: chat con IA. Prompt (`prompt.ts`), conocimiento (`conocimiento.ts`), herramientas, bucle con el modelo inyectado (`bucle.ts`), guardia de cifras, costo y tope diario (`costo.ts`, `presupuesto.ts`), llamada a la API de Claude con `fetch` (`motor.ts`) y ruta (`ruta.ts`).
- `src/db/schema.ts`: modelo de datos. Migraciones en `migraciones/`.
- `src/admin-ui/`: interfaz de la bandeja (HTML, CSS y JS propios, sin dependencias). `scripts/empaquetar-ui.mjs` la mete en el Worker antes de `dev`, `deploy`, `check` y `test`.
- El texto de la autorización vive en `../src/data/consentimiento.ts` y lo comparten el sitio y la API.
