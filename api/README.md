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

- `npm test`: pruebas unitarias y de punta a punta contra una D1 local (miniflare).
- `npm run check`: tipos.
- Cambios de esquema: edita `src/db/schema.ts`, corre `npm run migraciones:generar` y versiona la migración nueva.

## Producción

1. **Token de Cloudflare:** al token de `CLOUDFLARE_API_TOKEN` agrégale los permisos *Workers Scripts: Edit* y *D1: Edit* (hoy solo tiene Pages).
2. **Correo:** crea una cuenta en Resend, verifica el dominio `antidotocolombia.com` (registros DNS en Hostinger) y guarda la clave como secret `RESEND_API_KEY` en GitHub. Si el remitente va a ser otro, cambia `MAIL_FROM` en `wrangler.toml`.
3. **Sal de IP:** guarda un texto aleatorio largo como secret `SAL_IP` (por ejemplo `openssl rand -base64 32`).
4. **Desplegar:** en Actions, corre *API (Cloudflare Worker)*. También corre solo en cada push a `main` que toque `api/`. La primera vez crea la base D1 y, siempre, aplica las migraciones. La URL queda en el resumen del job.
5. **Conectar el sitio:** guarda esa URL como variable `PUBLIC_API_URL` en GitHub (Variables, no Secrets). El build del sitio la usa para activar el paso de contacto del cotizador, y la API la usa para los enlaces de los correos. Lo ideal es un dominio propio (`api.antidotocolombia.com`) apuntado al Worker.
6. **Primer admin:**

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
- `src/db/schema.ts`: modelo de datos. Migraciones en `migraciones/`.
- `src/admin-ui/`: interfaz de la bandeja (HTML, CSS y JS propios, sin dependencias). `scripts/empaquetar-ui.mjs` la mete en el Worker antes de `dev`, `deploy`, `check` y `test`.
- El texto de la autorización vive en `../src/data/consentimiento.ts` y lo comparten el sitio y la API.
