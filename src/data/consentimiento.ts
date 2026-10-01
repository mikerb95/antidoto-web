// Texto de autorización de tratamiento de datos (Ley 1581 de 2012) que acepta quien pide una
// cotización. El dato vive en consentimiento.json porque también lo importa la API (api/),
// que se compila sin las dependencias del sitio. La API guarda la versión y el texto exacto
// aceptado como prueba: si cambia el texto, sube la versión; nunca edites una versión ya usada.
import datos from './consentimiento.json';

export const CONSENTIMIENTO_VERSION: string = datos.version;

export const CONSENTIMIENTO: Record<'es' | 'en', string> = { es: datos.es, en: datos.en };
