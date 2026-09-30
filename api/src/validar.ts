// Validación del lead que envía el cotizador. Función pura: devuelve los datos limpios o la
// lista de errores, sin tocar la base.
import { SERVICIOS, type ServicioId } from './db/schema';
import consentimiento from '../../src/data/consentimiento.json';

export interface LeadEntrada {
  servicio: ServicioId;
  tipoOrganizacion: string | null;
  fecha: string | null;
  personas: number | null;
  ciudad: string | null;
  mensaje: string | null;
  nombre: string;
  empresa: string | null;
  email: string | null;
  telefono: string | null;
  locale: 'es' | 'en';
  pagina: string | null;
  referente: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

export type Resultado =
  | { ok: true; lead: LeadEntrada }
  /** Parece un bot (trampa llena o envío demasiado rápido): se responde bien y no se guarda. */
  | { ok: false; bot: true }
  | { ok: false; bot: false; errores: string[] };

/** Menos de esto entre abrir el cotizador y enviar no lo hace una persona. */
export const TIEMPO_MINIMO_MS = 2500;

const texto = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  // Quita caracteres de control (deja saltos de línea) y espacios sobrantes.
  const limpio = v.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim();
  return limpio ? limpio.slice(0, max) : null;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Deja solo dígitos y el + inicial. Acepta 7 a 15 dígitos (E.164). */
export function normalizarTelefono(v: unknown): string | null {
  const t = texto(v, 40);
  if (!t) return null;
  const digitos = t.replace(/\D/g, '');
  if (digitos.length < 7 || digitos.length > 15) return null;
  return (t.startsWith('+') ? '+' : '') + digitos;
}

/** Solo rutas del propio sitio, sin query: la página no debe filtrar datos en la URL. */
const ruta = (v: unknown): string | null => {
  const t = texto(v, 200);
  return t && /^\/[\w\-/.%]*$/.test(t) ? t : null;
};

/** Del referente solo interesa el dominio. */
const dominio = (v: unknown): string | null => {
  const t = texto(v, 500);
  if (!t) return null;
  try {
    return new URL(t).hostname.slice(0, 120) || null;
  } catch {
    return null;
  }
};

export function validarLead(entrada: unknown): Resultado {
  if (!entrada || typeof entrada !== 'object') return { ok: false, bot: false, errores: ['cuerpo'] };
  const d = entrada as Record<string, unknown>;

  if (texto(d.web, 200)) return { ok: false, bot: true };
  if (typeof d.t !== 'number' || d.t < TIEMPO_MINIMO_MS) return { ok: false, bot: true };

  const errores: string[] = [];
  const servicio = SERVICIOS.includes(d.servicio as ServicioId) ? (d.servicio as ServicioId) : null;
  if (!servicio) errores.push('servicio');

  const nombre = texto(d.nombre, 120);
  if (!nombre || nombre.length < 2) errores.push('nombre');

  const emailBruto = texto(d.email, 200)?.toLowerCase() ?? null;
  const email = emailBruto && EMAIL.test(emailBruto) ? emailBruto : null;
  if (emailBruto && !email) errores.push('email');

  const telefonoBruto = texto(d.telefono, 40);
  const telefono = normalizarTelefono(telefonoBruto);
  if (telefonoBruto && !telefono) errores.push('telefono');

  if (!emailBruto && !telefonoBruto) errores.push('contacto');

  if (d.consentimiento !== consentimiento.version) errores.push('consentimiento');

  const fechaBruta = texto(d.fecha, 7);
  const fecha = fechaBruta && /^\d{4}-(0[1-9]|1[0-2])$/.test(fechaBruta) ? fechaBruta : null;
  if (fechaBruta && !fecha) errores.push('fecha');

  let personas: number | null = null;
  if (d.personas !== undefined && d.personas !== null && d.personas !== '') {
    const n = Number(d.personas);
    if (Number.isInteger(n) && n >= 1 && n <= 100000) personas = n;
    else errores.push('personas');
  }

  const locale = d.locale === 'en' ? 'en' : 'es';
  if (errores.length || !servicio || !nombre) return { ok: false, bot: false, errores };

  const utm = (d.utm && typeof d.utm === 'object' ? d.utm : {}) as Record<string, unknown>;
  return {
    ok: true,
    lead: {
      servicio,
      tipoOrganizacion: texto(d.tipo, 60),
      fecha,
      personas,
      ciudad: texto(d.ciudad, 80),
      mensaje: texto(d.mensaje, 2000),
      nombre,
      empresa: texto(d.empresa, 120),
      email,
      telefono,
      locale,
      pagina: ruta(d.pagina),
      referente: dominio(d.referente),
      utmSource: texto(utm.source, 80),
      utmMedium: texto(utm.medium, 80),
      utmCampaign: texto(utm.campaign, 120),
    },
  };
}
