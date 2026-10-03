// Preguntas frecuentes de todo el sitio, en los dos idiomas. La home muestra las destacadas;
// /preguntas-frecuentes/ las agrupa por tema y cada línea de servicio muestra las suyas.
// Las respuestas entre corchetes son datos que faltan del cliente: se muestran como .pendiente.
// Regla: solo hechos del brief o del sitio; nada de cifras ni promesas sin validar.
import type { Locale } from '../i18n/ui';

export const TEMAS_FAQ = ['general', 'formaciones', 'audiovisual', 'catering', 'diseno', 'cotizacion'] as const;
export type TemaFaq = (typeof TEMAS_FAQ)[number];

export interface Pregunta {
  clave: string;
  tema: TemaFaq;
  /** Sale en la home. */
  destacada?: boolean;
  es: [pregunta: string, respuesta: string];
  en: [pregunta: string, respuesta: string];
}

export const FAQ: Pregunta[] = [
  {
    clave: 'ciudades',
    tema: 'general',
    destacada: true,
    es: ['¿En qué ciudades prestan el servicio?', 'Atendemos eventos en todo el país. [SEDE Y CIUDADES PRINCIPALES]'],
    en: ['Which cities do you work in?', 'We serve events across the country. [MAIN OFFICE AND MAIN CITIES]'],
  },
  {
    clave: 'idiomas',
    tema: 'general',
    destacada: true,
    es: ['¿En qué idiomas trabajan?', 'Español, portugués e inglés.'],
    en: ['Which languages do you work in?', 'Spanish, Portuguese and English.'],
  },
  {
    clave: 'publico',
    tema: 'general',
    es: ['¿Trabajan solo con empresas?', 'No. Trabajamos con empresas, colegios, universidades y otras organizaciones.'],
    en: ['Do you only work with companies?', 'No. We work with companies, schools, universities and other organizations.'],
  },
  {
    clave: 'combinar',
    tema: 'general',
    es: ['¿Puedo contratar varios servicios para un mismo evento?', 'Sí. Los servicios se contratan por separado o como un solo evento, con un solo equipo a cargo.'],
    en: ['Can I book several services for the same event?', 'Yes. Services can be booked separately or as a single event, with one team in charge.'],
  },
  {
    clave: 'virtual',
    tema: 'formaciones',
    destacada: true,
    es: ['¿Las formaciones pueden ser virtuales?', 'Sí. Las actividades digitales funcionan en sala, en campo o por videollamada.'],
    en: ['Can the training be virtual?', 'Yes. The digital activities work in a room, in the field or on a video call.'],
  },
  {
    clave: 'ia',
    tema: 'formaciones',
    es: ['¿Qué quiere decir que las formaciones tienen apoyo de IA?', '[CÓMO SE USA LA IA EN LAS FORMACIONES]'],
    en: ['What does it mean that the training is AI supported?', '[HOW AI IS USED IN THE TRAINING]'],
  },
  {
    clave: 'colegios',
    tema: 'formaciones',
    es: ['¿Tienen formaciones para colegios?', 'Sí. Hacemos orientación vocacional e inclusión con metodología vivencial para colegios y universidades.'],
    en: ['Do you offer training for schools?', 'Yes. We run career guidance and inclusion programs with an experiential method for schools and universities.'],
  },
  {
    clave: 'entrega-video',
    tema: 'audiovisual',
    destacada: true,
    es: ['¿Cuánto tarda la entrega de un video de inducción?', '[TIEMPO DE ENTREGA]'],
    en: ['How long does an onboarding video take to deliver?', '[DELIVERY TIME]'],
  },
  {
    clave: 'calidad-video',
    tema: 'audiovisual',
    es: ['¿En qué calidad entregan los videos?', 'Entregamos en calidad 4K y podemos sumar tomas aéreas con dron.'],
    en: ['What quality do you deliver videos in?', 'We deliver in 4K and can add aerial drone footage.'],
  },
  {
    clave: 'pedido-minimo',
    tema: 'catering',
    destacada: true,
    es: ['¿Cuál es el pedido mínimo de catering?', '[PEDIDO MÍNIMO]'],
    en: ['What is the minimum catering order?', '[MINIMUM ORDER]'],
  },
  {
    clave: 'cobertura-catering',
    tema: 'catering',
    es: ['¿El catering tiene cobertura nacional?', 'Sí. Atendemos eventos empresariales, académicos y sociales en todo el país, con logística flexible.'],
    en: ['Is the catering available nationwide?', 'Yes. We serve corporate, academic and social events across the country, with flexible logistics.'],
  },
  {
    clave: 'diseno-proceso',
    tema: 'diseno',
    es: ['¿Pueden llevar una idea hasta el producto final?', 'Sí. Acompañamos desde el prototipo hasta el producto funcional, con la identidad de tu marca.'],
    en: ['Can you take an idea all the way to a finished product?', 'Yes. We work from the prototype to the functional product, with your brand’s identity.'],
  },
  {
    clave: 'como-cotizar',
    tema: 'cotizacion',
    es: ['¿Cómo pido una cotización?', 'Con el cotizador del sitio: eliges el servicio, la fecha y el tamaño del grupo, y el mensaje nos llega por WhatsApp. También puedes escribirnos al correo.'],
    en: ['How do I request a quote?', 'With the quote builder on this site: choose the service, the date and the group size, and the message reaches us on WhatsApp. You can also email us.'],
  },
  {
    clave: 'tiempo-respuesta',
    tema: 'cotizacion',
    es: ['¿Cuánto tardan en responder una cotización?', '[TIEMPO DE RESPUESTA]'],
    en: ['How long does it take to get a quote?', '[RESPONSE TIME]'],
  },
];

/** Una respuesta que es un dato pendiente del cliente (va entera entre corchetes). */
export const esPendiente = (respuesta: string) => /^\[.*\]$/.test(respuesta.trim());

/** Preguntas de un tema o de una lista de claves, en el idioma pedido. */
export function preguntas(locale: Locale, filtro: { tema?: TemaFaq; destacadas?: boolean } = {}) {
  return FAQ.filter((p) => (!filtro.tema || p.tema === filtro.tema) && (!filtro.destacadas || p.destacada)).map((p) => ({
    clave: p.clave,
    tema: p.tema,
    pregunta: p[locale][0],
    respuesta: p[locale][1],
  }));
}
