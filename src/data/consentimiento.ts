// Textos de autorización de tratamiento de datos (Ley 1581 de 2012). El dato vive en
// consentimiento.json porque también lo importa la API (api/), que se compila sin las
// dependencias del sitio. La API guarda la versión y el texto exacto aceptado como prueba:
// si cambia un texto, sube su versión; nunca edites una versión ya usada. La versión que se
// reemplaza pasa entera (versión y textos) a "anteriores": el sitio y la API se despliegan por
// separado y, mientras tanto, la API debe seguir aceptando la que tenga la otra parte.
import datos from './consentimiento.json';

/** Autorización para responder y hacer seguimiento a una solicitud de cotización. */
export const CONSENTIMIENTO_VERSION: string = datos.version;
export const CONSENTIMIENTO: Record<'es' | 'en', string> = { es: datos.es, en: datos.en };

/** Autorización aparte para recibir novedades por correo (email marketing). */
export const NOVEDADES_VERSION: string = datos.marketing.version;
export const NOVEDADES: Record<'es' | 'en', string> = { es: datos.marketing.es, en: datos.marketing.en };
