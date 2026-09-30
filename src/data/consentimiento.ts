// Texto de autorización de tratamiento de datos (Ley 1581 de 2012) que acepta quien pide una
// cotización. Lo usan el cotizador y la API: la API guarda la versión y el texto exacto
// aceptado como prueba. Si cambia el texto, sube la versión; nunca edites una versión ya usada.
export const CONSENTIMIENTO_VERSION = '2026-10-v1';

export const CONSENTIMIENTO = {
  es: 'Autorizo a Antídoto a tratar mis datos de contacto para responder esta solicitud y hacerle seguimiento, según su política de tratamiento de datos.',
  en: 'I authorize Antídoto to process my contact details to answer this request and follow up on it, under its data processing policy.',
} as const;
