# Competencia, posicionamiento y hoja de ruta

Fecha: 2 de octubre de 2026
Ubicación sugerida en el repo: `auditoria/03-competencia-y-hoja-de-ruta.md`
Estado del repo al escribirlo: commit `c2c896c`. El sitio compila (23 páginas) y pasan las 11 pruebas del sitio y las 58 de la API.

Este documento complementa `CLAUDE.md`, no lo reemplaza. `CLAUDE.md` dice cómo está construido el proyecto y sus reglas. Aquí está el porqué de lo que sigue: qué negocio es Antídoto hoy, contra quién se mide, qué falta y en qué orden construirlo. Si algo de aquí contradice a `CLAUDE.md`, pregunta antes de actuar.

Cada dato lleva su origen: **[repo]** verificado en el código, **[web]** tomado de una fuente pública, **[Mike]** dicho por el dueño del proyecto, **[por confirmar]** falta el dato del cliente.

---

## 1. Meta del producto

Una sola plataforma para Antídoto con seis piezas:

1. Sitio público con contenido que retenga y convierta.
2. Panel de administración.
3. Panel de marketing.
4. Panel de clientes.
5. Biblioteca de actividades (ya existe, en otro repositorio): permite configurar empresas y actividades remotas o presenciales, algunas tipo trivia en vivo y juegos interactivos.
6. Panel de operaciones para eventos y catering.

Las piezas 1 a 3 ya tienen base en este repo. Las piezas 4 a 6 no existen aquí.

---

## 2. Hechos del negocio que cambian el plan

### 2.1 Licencia de SST (nuevo)

- **[Mike]** Antídoto acaba de recibir licencia de Seguridad y Salud en el Trabajo.
- **[web]** Marco: Resolución 754 de 2021 del Ministerio de Salud. La expiden las secretarías departamentales o distritales de salud, tiene cobertura nacional para los campos de acción autorizados y vigencia de 10 años. El talento humano de una persona jurídica licenciada debe tener licencia propia vigente en esos mismos campos.
- **[por confirmar]** Titular (persona jurídica o natural), número, fecha, entidad que la expidió y, sobre todo, **los campos de acción autorizados**.

Reglas que salen de aquí:

- La licencia habilita a Antídoto para ofrecer servicios de SST, no solo piezas creativas para el área de SST. Es el cambio de posicionamiento más grande desde el brief original.
- Solo se publican servicios de SST que caigan dentro de los campos de acción autorizados. Hasta tener ese dato, toda página de servicio SST nueva se construye como borrador y no entra al build de producción.
- El número de licencia y la entidad van visibles en Nosotros y en el pie cuando el cliente los entregue. No los inventes ni pongas marcadores de posición visibles.
- La licencia no cubre auditoría o consultoría en ISO 9001 o ISO 14001 ni asesoría legal. Esas líneas siguen fuera del alcance salvo que el cliente diga lo contrario.

### 2.2 Canal de venta

- **[Mike]** Antídoto vende directo a empresas. El sitio es el canal principal, así que SEO, conversión y seguimiento comercial son prioridad.
- **[repo]** Aun así, en `marca/clientes.md` hay intermediarios: dos consultoras SST (SEQ Consultores y HSEQ Consultores), una aseguradora (Seguros Bolívar) y dos corredores (Gallagher y Correcol). Existe un canal indirecto de hecho. El modelo de datos debe permitir más adelante una cuenta madre con varias empresas, sin construir todavía ese panel.

### 2.3 Operación

- **[Mike]** Eventos y catering son operación propia, no tercerizada. Por eso el panel de operaciones es parte del producto y el sitio puede publicar paquetes con precio "desde" cuando el cliente dé las cifras.
- **[Mike]** La biblioteca de actividades es de Mike y puede modificarla sin restricciones. **[por confirmar]** Stack, modelo de datos y cómo maneja hoy el acceso de empresas y participantes.

### 2.4 Relación con SEQ Consultores (decisión abierta)

- **[Mike]** SEQ es la competencia que se quiere superar.
- **[repo]** SEQ aparece como cliente de Antídoto, con logo en el sitio.
- Con la licencia de SST, Antídoto se acerca más al terreno de SEQ, y el conflicto crece.
- **[por confirmar]** Si SEQ sigue siendo cliente y si el logo se mantiene.

Mientras no haya decisión:

- No nombres a SEQ ni a ningún competidor en el sitio, ni hagas comparaciones.
- No copies textos, estructura ni nombres de programas de SEQ (ConquiSSTadores, Rompiendo Silos, CAYAC).
- LEGO Serious Play y MTa Learning son marcas registradas de terceros. No las uses para describir los talleres de Antídoto salvo que el cliente confirme facilitadores certificados. Las fotos muestran piezas de construcción: descríbelas así.

---

## 3. La competencia: SEQ Consultores

Referencia de lo que hay que superar, no modelo a copiar. Revisado en seqconsultores.com el 02/10/2026.

**Negocio. [web]** Constituida en 2001, empresa pequeña (cerca de 7 empleados en 2025). Se presenta como aliada de las principales ARL. Tres capas de oferta:

1. Cumplimiento: auditorías, consultorías, capacitaciones, asesoría legal y formación de auditores internos sobre Decreto 1072 de 2015, Resolución 0312 de 2019, RUC, ISO 9001, 14001 y 45001.
2. Programas experienciales con marca propia: talleres con LEGO Serious Play y MTa Learning, ConquiSSTadores, Rompiendo Silos, Estrategia Emergente y un kit de Riesgos y Oportunidades.
3. Software: CAYAC, plataforma de gestión de contratistas en SST.

**Debilidades de su sitio. [web]**

- URLs del tipo `?page_id=2916` y títulos internos expuestos ("SERVICIOS_español").
- Todos los botones van a `wa.me/3176467327`, sin indicativo de país.
- Propuesta de valor, beneficios y valores están dentro de imágenes sin texto alternativo.
- Una sola página para todos los servicios: no puede posicionar cada uno por separado.
- Sin casos, testimonios, equipo, precios, agenda, blog ni recursos descargables.
- Dos páginas en español cargan con menú en inglés y pie de 2025.
- No menciona ISO 9001:2026 ni ninguna norma reciente.

**Dónde este repo ya gana. [repo]** URLs limpias, texto real en HTML, `hreflang` y `canonical` correctos, sitemap, WhatsApp con indicativo, cotizador por pasos, bandeja de leads con consentimiento, PWA con modo sin conexión y cabeceras de seguridad.

---

## 4. Posicionamiento propuesto

Antídoto no gana imitando la capa de cumplimiento de SEQ. Gana uniendo cuatro cosas que SEQ no tiene bajo un mismo techo:

- Licencia de SST y una fundadora ingeniera civil especialista en Gerencia de SST.
- Producción propia: video, diseño, eventos y catering.
- Una biblioteca de actividades digitales que funciona en remoto y presencial.
- IA aplicada a la formación.

Frase de trabajo (no es copy final): "SST y formación que la gente sí recuerda, con evidencia para la auditoría". El comprador es el mismo de SEQ: responsables de SST y HSEQ, talento humano, bienestar y comunicaciones internas. El brief original también incluye colegios y universidades; se mantienen.

Ideas de producto que salen de esa unión, en orden de cercanía a lo que ya existe:

1. **Evidencia automática.** Cada actividad de la biblioteca deja asistencia, evaluación y certificado verificable, exportable para auditoría del programa de capacitación.
2. **Videos de inducción y de plan de emergencia** como línea con página propia. Ya es servicio real.
3. **Semana de la SST llave en mano.** Taller, logística, catering, actividad en vivo e informe final.
4. **IA aplicada para equipos de SST.** Depende de que el cliente confirme la oferta.
5. **Actividades personalizadas con IA** a partir de la matriz de peligros de cada empresa, con revisión humana.
6. **Inducción remota de contratistas** con verificación por actividad.

Nada de esta lista se publica como servicio hasta que el cliente lo confirme. Sirve para decidir qué estructura construir.

---

## 5. Estado actual frente a la meta

| Pieza | Estado **[repo]** | Qué se reutiliza |
|---|---|---|
| Sitio público | Estructura, sistema visual, bilingüe y PWA hechos. Contenido delgado. | Todo |
| Panel admin | Bandeja de leads con estados, métricas, CSV, equipo y supresión de datos | Enlace mágico, sesiones, roles, historial |
| Panel marketing | Suscripción con doble confirmación, campañas segmentadas, lotes, webhook y baja | Motor de envíos completo |
| Panel clientes | No existe | Autenticación y versionado de consentimientos |
| Biblioteca | Fuera de este repo | Por definir al ver ese repo |
| Operaciones | No existe | Nada aún |

**La API no está en producción. [repo]** Faltan los permisos del token de Cloudflare, el dominio verificado en Resend, el webhook y el primer admin (`api/README.md`, sección Producción). No es trabajo de código, pero es lo primero que da resultados.

### Brechas medidas en el build

- Cada página de servicio tiene cerca de 240 palabras contando menú y pie.
- En las páginas de servicio el primer `h2` repite el texto del `h1`.
- Solo la home lleva datos estructurados (`ProfessionalService`). Faltan `Service`, `BreadcrumbList` y `FAQPage` en las demás.
- El contenido vive en `src/data/servicios.ts` y `src/i18n/ui.ts`. No hay colecciones de contenido, así que cada página nueva exige tocar código.
- No hay portafolio, preguntas frecuentes, casos ni artículos.
- El sitio dice "Colombia" sin ciudad: no compite en búsquedas locales.
- La licencia de SST no aparece en ninguna parte.

---

## 6. Hoja de ruta

Cada fase se entrega en PRs pequeños. Antes de cerrar cualquiera: `npm run check`, `npm test` y `npm run build` en la raíz, y `npm run check` y `npm test` en `api/` si se tocó.

### Fase 1. Contenido y SEO (solo sitio, sin backend nuevo)

1. **Colecciones de contenido.** Migrar `src/data/servicios.ts` a colecciones de Astro manteniendo el modelo bilingüe y las rutas actuales. Criterio: el HTML generado de las páginas existentes no cambia salvo por hashes.
2. **Campo `borrador`.** Toda entrada lo soporta. En producción un borrador no genera página ni entra al sitemap. Así se construyen plantillas sin publicar contenido sin validar.
3. **Corregir la página de servicio.** Quitar el `h2` que repite el `h1` y agregar `Service` y `BreadcrumbList` en JSON-LD, generados desde los datos.
4. **Tipo de página "solución".** Página por necesidad concreta, hija de un servicio, con: problema, qué incluye, cómo se entrega, preguntas frecuentes y llamada a cotizar con el servicio ya elegido. Primeras candidatas, todas como borrador hasta tener texto del cliente:
   - Videos de inducción SST
   - Videos de plan de emergencia
   - Formaciones vivenciales para brigadas y comités
   - Semana de la SST
   - Catering para eventos corporativos
5. **Licencia de SST.** Componente que la muestre en Nosotros y en el pie, alimentado desde `src/data/site.ts`. Sin datos, no se renderiza. Agregarla al JSON-LD de la organización cuando existan número y entidad.
6. **Hub de SST.** Página que agrupe las soluciones de SST y muestre la licencia. Decidir con Mike si SST pasa a ser un quinto servicio o una capa transversal sobre los cuatro actuales; no asumas.
7. **Preguntas frecuentes y portafolio.** Ya están en los pendientes de `CLAUDE.md`. FAQ con `FAQPage` en JSON-LD.
8. **Artículos.** Colección para contenido editorial. Ver sección 8 para los temas con fecha.
9. **Ciudad.** En cuanto el cliente confirme la sede, agregar dirección al JSON-LD y a los textos.

### Fase 2. Catálogo de actividades

1. **Catálogo en base de datos.** Hoy `SERVICIOS` es una lista fija en `api/src/db/schema.ts` y en la validación. Pasarlo a una tabla para poder agregar programas y actividades sin una migración por cada una. Los leads existentes deben seguir siendo válidos.
2. **Catálogo público** con filtros por objetivo, modalidad, duración y tamaño de grupo, y cotización por actividad reutilizando el cotizador y `POST /v1/leads`.
3. **Demo jugable** en la home, corta, sin registro.

Esta fase depende de conocer el repositorio de la biblioteca. No la empieces sin él.

### Fase 3. Portal de clientes

- Tabla `empresas` y rol `cliente` sobre la autenticación actual. Hoy la empresa es un texto libre en el lead.
- Toda tabla nueva del portal lleva `empresa_id` desde el primer día.
- Participantes sin cuenta: acceso por QR o documento, pensado para celular básico y mala señal. La PWA ya tiene base para modo sin conexión.
- Evidencia por actividad y certificados verificables.

### Fase 4. Operaciones y cotización formal

- Cotización formal con aprobación y consulta de facturas desde Siigo o Alegra (ya en pendientes).
- Eventos y catering: disponibilidad, costos por persona, personal, proveedores y listas de chequeo.

### Fase 5. IA y cuentas madre

- Personalización de actividades con IA y revisión humana.
- Cuenta madre para grupos empresariales, consultoras, aseguradoras o corredores.

---

## 7. Decisiones de arquitectura pendientes

No las tomes por tu cuenta. Preséntale opciones a Mike con costo y riesgo.

1. **Interfaz del admin.** Hoy es un solo `app.js` de 879 líneas sin dependencias, empaquetado dentro del Worker. Sirve para la bandeja, pero no para cuatro paneles más. Opciones: partirlo en módulos por panel manteniendo cero dependencias, o adoptar una librería ligera de componentes.
2. **Tiempo real.** Las actividades en vivo necesitan conexiones persistentes. En Cloudflare eso apunta a Durable Objects. Depende de cómo lo resuelva hoy la biblioteca.
3. **Archivos.** Evidencias y certificados necesitan almacenamiento de objetos. En Cloudflare, R2.
4. **Una sola identidad.** Sitio, portal y biblioteca deben compartir usuarios y empresas. Construir dos sistemas y sincronizarlos después es el camino caro.
5. **Hospedaje.** El sitio sale estático a Hostinger y la API vive en Cloudflare. El portal puede obligar a mover todo a Cloudflare. No lo cambies sin decisión explícita.

---

## 8. Temas de contenido con fecha

Sirven para artículos y para el calendario de campañas del panel de marketing. **Vienen de fuentes secundarias: verifica cada norma contra su texto oficial antes de escribir una línea**, y no publiques nada de SST fuera de los campos de acción de la licencia.

| Tema | Dato **[web]** | Relación con Antídoto |
|---|---|---|
| Autoevaluación de estándares mínimos | Resolución 0312 de 2019. Se aplica en diciembre; el plan anual arranca el 1 de enero. La Circular 027 de 2026 fijó el 31 de julio de 2026 para registrar la de 2025. | Pico de demanda de capacitación y eventos entre noviembre y febrero |
| Salud mental en el trabajo | Resolución 347 de 2026, llamada "Código Dorado" | Formaciones vivenciales y video |
| Comité de Convivencia Laboral | Resolución 3461 de 2025: nueva conformación y funciones | Formaciones para comités |
| Exámenes médicos ocupacionales | Resolución 1843 de 2025 | Solo como contexto; no es servicio de Antídoto |
| ISO 9001:2026 | Publicada el 16/09/2026; transición hasta el 30/09/2029 | Fuera de alcance. Útil solo si el cliente confirma esa competencia |

---

## 9. Datos que faltan del cliente

Reúne aquí lo que bloquea publicar. Varios ya están en `CLAUDE.md`.

- [ ] Licencia de SST: titular, número, fecha, entidad y campos de acción.
- [ ] Decisión sobre SEQ: cliente, competidor o aliado, y si su logo se queda.
- [ ] Si los talleres usan metodologías de marca registrada y con qué certificación.
- [ ] Repositorio y stack de la biblioteca de actividades.
- [ ] Lista real de servicios de SST que se van a ofrecer.
- [ ] Sede y ciudad.
- [ ] Razón social, NIT y domicilio para la política de datos, más la revisión de un abogado.
- [ ] Testimonios validados con nombre, cargo, empresa y autorización.
- [ ] Autorización para mostrar los logos de clientes.
- [ ] Fotos de audiovisual, de diseño de productos y de la fundadora.
- [ ] Casos con cifras y precios "desde" para paquetes.
- [ ] Acuerdo escrito sobre la biblioteca: licencia de uso o cesión.

---

## 10. Reglas para trabajar con este documento

- Las reglas de `CLAUDE.md` siguen vigentes: marca, accesibilidad, motion, presupuesto de rendimiento, textos en los dos idiomas, sin emojis ni guiones largos, commits a nombre de Mike y sin atribución.
- No inventes clientes, cifras, testimonios, servicios, números de licencia ni campos de acción.
- Lo que no esté confirmado se construye como borrador o no se construye.
- Todo dato personal nuevo pasa por el esquema de consentimiento versionado que ya existe. Las restricciones alimentarias de un evento son dato sensible: se piden solo para ese evento y se borran al cierre.
- Mide el peso de JS de la home después de cada pieza nueva y actualiza la línea base en `CLAUDE.md`.
- Al cerrar una fase, actualiza la sección Pendiente de `CLAUDE.md` y marca aquí lo resuelto.
