// Herramientas del asesor: preparar el mensaje de WhatsApp y mostrar el enlace al cotizador.
// Las dos se ejecutan en el servidor con funciones puras; el modelo solo elige qué pedir.
// No hay calcular_precio: Antídoto no publica precios (ver conocimiento.ts).
//
// Módulo PURO.
import type { Locale } from '../../../src/i18n/ui';
import { CLAVES, CIFRAS_PUBLICAS, type Clave } from './conocimiento';
import { verificarCifras } from './guardia';

export interface PedidoWhatsapp {
  necesidad: string;
  pendiente?: string;
  servicio?: Clave;
}

const esClave = (v: unknown): v is Clave => typeof v === 'string' && (CLAVES as readonly string[]).includes(v);

/**
 * Valida la entrada de preparar_whatsapp. Objeto plano: la API exige `type: object` en la raíz
 * del esquema. Devuelve el pedido o un mensaje que el modelo puede corregir.
 */
export function leerWhatsapp(v: unknown): PedidoWhatsapp | string {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return 'la entrada debe ser un objeto';
  const o = v as Record<string, unknown>;
  const extra = Object.keys(o).filter((k) => !['necesidad', 'pendiente', 'servicio'].includes(k));
  if (extra.length) return `campos no permitidos: ${extra.join(', ')}`;
  if (typeof o.necesidad !== 'string' || o.necesidad.trim().length < 3 || o.necesidad.length > 300) return '"necesidad" debe tener entre 3 y 300 caracteres';
  if (o.pendiente !== undefined && (typeof o.pendiente !== 'string' || o.pendiente.length > 300)) return '"pendiente" debe tener hasta 300 caracteres';
  if (o.servicio !== undefined && !esClave(o.servicio)) return `"servicio" debe ser una de: ${CLAVES.join(', ')}`;
  return { necesidad: o.necesidad, pendiente: o.pendiente as string | undefined, servicio: o.servicio as Clave | undefined };
}

/** Entrada de pedir_contacto: el servicio, si ya se sabe, para dejarlo elegido en el cotizador. */
export function leerContacto(v: unknown): { servicio?: Clave } | string {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return 'la entrada debe ser un objeto';
  const o = v as Record<string, unknown>;
  if (Object.keys(o).some((k) => k !== 'servicio')) return 'solo se admite "servicio"';
  if (o.servicio !== undefined && !esClave(o.servicio)) return `"servicio" debe ser una de: ${CLAVES.join(', ')}`;
  return { servicio: o.servicio as Clave | undefined };
}

// Teléfonos (7 a 15 dígitos con espacios, puntos, guiones o paréntesis) y correos.
const TELEFONO = /\+?\d[\d\s().-]{5,}\d/g;
const CORREO = /[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}/g;

/** Tapa teléfonos y correos: ningún dato de contacto llega al modelo ni sale en un resumen. */
export function taparDatos(texto: string, locale: Locale): string {
  const [tel, correo] = locale === 'es' ? ['[teléfono]', '[correo]'] : ['[phone]', '[email]'];
  return texto
    .replace(CORREO, correo)
    .replace(TELEFONO, (m) => {
      const n = m.replace(/\D/g, '').length;
      return n >= 7 && n <= 15 ? tel : m;
    });
}

/**
 * Mensaje que se precarga en WhatsApp. Lo compone el servidor: el modelo solo aporta qué
 * necesita la persona y qué quedó pendiente.
 */
export function mensajeWhatsapp(p: PedidoWhatsapp, locale: Locale): string {
  const es = locale === 'es';
  // Si el modelo coló una cifra de dinero o un dato de contacto en el resumen, se descarta ese
  // campo entero: lo que llega a WhatsApp tiene que poder respaldarse.
  const limpio = (s: string | undefined) => {
    const v = s?.trim();
    if (!v) return null;
    return verificarCifras(v, CIFRAS_PUBLICAS).ok && taparDatos(v, locale) === v ? v : null;
  };
  const necesidad = limpio(p.necesidad);
  const pendiente = limpio(p.pendiente);
  const lineas = [
    es
      ? 'Hola Antídoto, vengo de antidotocolombia.com. Hablé con su asistente y quiero seguir con ustedes.'
      : 'Hi Antídoto, I come from antidotocolombia.com. I talked to your assistant and want to continue with you.',
  ];
  // Sin etiqueta delante: el modelo ya lo escribe en primera persona.
  if (necesidad) lineas.push('', necesidad);
  if (pendiente) lineas.push(`${es ? 'Me queda la duda' : 'Still unsure about'}: ${pendiente}`);
  return lineas.join('\n');
}

const SERVICIO = {
  type: 'string',
  enum: [...CLAVES],
  description: 'Clave del servicio del que se habla, si ya está claro.',
} as const;

/** Definiciones para la API, en español (el modelo responde en el idioma de la página). */
export function definiciones() {
  return [
    {
      name: 'preparar_whatsapp',
      description:
        'Prepara el botón "Enviar a Antídoto por WhatsApp", que abre WhatsApp con un resumen ya escrito. Úsala cuando la ' +
        'persona quiera avanzar, pida una cotización o pida hablar con alguien. El mensaje lo envía la persona, así que ' +
        'escribe en PRIMERA persona, como si ella le escribiera al equipo ("Necesito una formación para 40 personas de mi ' +
        'área de SST en marzo...", nunca "Quiere..."). "necesidad": qué necesita, en una o dos frases y en su idioma, con ' +
        'lo que ya se sepa (servicio, tipo de organización, fecha aproximada, número de personas, ciudad), SIN precios ni ' +
        'cifras de dinero. "pendiente": la duda que le quedó, también en primera persona, si la hay. No incluyas nombres, ' +
        'teléfonos ni correos.',
      input_schema: {
        type: 'object',
        properties: {
          necesidad: { type: 'string', minLength: 3, maxLength: 300 },
          pendiente: { type: 'string', maxLength: 300 },
          servicio: SERVICIO,
        },
        required: ['necesidad'],
        additionalProperties: false,
      },
    },
    {
      name: 'pedir_contacto',
      description:
        'Muestra en el chat un enlace al cotizador del sitio, donde la persona deja nombre, organización, correo o ' +
        'teléfono con su autorización de datos, para que el equipo la contacte. Úsala cuando la persona quiera que la ' +
        'llamen o le escriban y no quiera escribir por WhatsApp. Ofrécelo una sola vez por conversación. Tú no ves lo que ' +
        'escriba en el cotizador.',
      input_schema: {
        type: 'object',
        properties: { servicio: SERVICIO },
        additionalProperties: false,
      },
    },
  ];
}
