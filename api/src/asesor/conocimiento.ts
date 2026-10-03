// Lo que sabe el asesor: lo MISMO que publica el sitio. Los servicios y los clientes salen de
// publico.gen.ts (generado desde los Markdown y src/data/clientes.ts) y el resto de los textos
// de src/i18n/ui.ts, los mismos diccionarios que pintan la página. Si el asesor leyera de otra
// fuente, tarde o temprano diría algo distinto de lo que dice la página que tiene detrás.
//
// Lo que el cliente todavía no ha entregado aparece en el sitio entre corchetes ("[PEDIDO
// MÍNIMO]"). Eso no entra: el asesor solo sabe que está pendiente y lo manda a WhatsApp.
//
// Antídoto no publica precios: cada propuesta se arma a la medida. Por eso no hay tarifario
// ni calcular_precio, y la guardia de cifras no deja pasar ninguna cifra de dinero.
//
// Módulo PURO.
import type { Locale } from '../../../src/i18n/ui';
import { SERVICIOS_PUBLICOS, CLIENTES_PUBLICOS, UI as ui, RUTAS as rutas, SITE } from './publico.gen';

export type Clave = (typeof SERVICIOS_PUBLICOS)[number]['clave'];
export const CLAVES = SERVICIOS_PUBLICOS.map((s) => s.clave) as readonly Clave[];

/** Cifras de dinero publicadas (ninguna: Antídoto cotiza a la medida). */
export const CIFRAS_PUBLICAS: readonly number[] = [];

const PENDIENTE = /\[[^\]]*\]/g;
const TIENE_PENDIENTE = /\[[^\]]*\]/;

/** Quita los datos pendientes entre corchetes; null si no queda nada. */
export function sinPendientes(s: string): string | null {
  const limpio = s.replace(PENDIENTE, '').replace(/\s{2,}/g, ' ').trim();
  return limpio || null;
}

export function conocimiento(locale: Locale): string {
  const s = ui[locale];
  const i = s.inicio;
  const es = locale === 'es';
  const L = es
    ? { servicios: 'Servicios', incluye: 'Incluye', datos: 'Datos', pagina: 'Página', perfiles: 'Para quién', pasos: 'Cómo trabajamos', actividades: 'Actividades digitales', faq: 'Preguntas frecuentes', pend: 'Pendiente de confirmar: el equipo lo responde por WhatsApp.', clientes: 'Clientes publicados en el sitio', cifras: 'Cifras publicadas', fundadora: 'Fundadora', historia: 'Historia', contacto: 'Contacto', aliados: 'Aliados' }
    : { servicios: 'Services', incluye: 'Includes', datos: 'Facts', pagina: 'Page', perfiles: 'Who it is for', pasos: 'How we work', actividades: 'Digital activities', faq: 'FAQ', pend: 'Not confirmed yet: the team answers this on WhatsApp.', clientes: 'Clients published on the site', cifras: 'Published figures', fundadora: 'Founder', historia: 'History', contacto: 'Contact', aliados: 'Partners' };

  const lista = (xs: readonly string[]) => xs.map(sinPendientes).filter(Boolean).map((x) => `- ${x}`).join('\n');
  const base = `${SITE.url}${rutas.servicios[locale]}`;

  // Solo el Markdown de cada servicio: los puntos y cifras de la home repiten lo mismo con otras
  // palabras, y con dos listas el modelo cuenta dos veces.
  const servicios = SERVICIOS_PUBLICOS.map((sv) => {
    const t = sv[locale];
    return [
      `### ${t.titulo} (${es ? 'clave' : 'key'}: ${sv.clave})`,
      t.resumen,
      `${L.incluye}:`,
      lista(t.incluye),
      `${L.datos}:`,
      lista(t.datos),
      `${L.pagina}: ${base}${t.slug}/`,
    ].join('\n');
  }).join('\n\n');

  const faq = i.faq.items
    .map(([p, r]) => `- ${p} ${sinPendientes(r) ?? L.pend}${sinPendientes(r) && TIENE_PENDIENTE.test(r) ? ` (${L.pend})` : ''}`)
    .join('\n');

  return `## ${es ? 'Quién es Antídoto' : 'Who Antídoto is'}
${s.nosotrosLead}
${i.lead}
${i.servicios.lead}
${s.footerLema}
${i.insignia}.

## ${L.servicios}
${servicios}

## ${L.actividades}
${i.actividades.lead}
${lista(i.actividades.puntos)}

## ${L.perfiles}
${i.paraQuien.perfiles.map(([p, d]) => `- ${p}: ${d}`).join('\n')}
- ${i.paraQuien.aliados[0]} ${i.paraQuien.aliados[1]}

## ${L.pasos}
${i.pasos.items.map(([t, d], n) => `${n + 1}. ${t}: ${d}`).join('\n')}

## ${L.cifras}
${i.cifras.map(([n, d]) => `- ${n} ${d}`).join('\n')}

## ${L.fundadora}
${s.fundadoraNombre}, ${s.fundadoraCargo}. ${s.fundadoraBio}

## ${L.historia}
${s.historia.map(([a, t, d]) => `- ${a}: ${t}. ${d}`).join('\n')}

## ${L.clientes}
${CLIENTES_PUBLICOS.join(', ')}.

## ${L.faq}
${faq}

## ${L.contacto}
${es ? 'WhatsApp y teléfono' : 'WhatsApp and phone'}: ${SITE.phoneDisplay}. ${es ? 'Correo' : 'Email'}: ${SITE.email}. ${es ? 'Cotizador' : 'Quote form'}: ${SITE.url}${rutas.contacto[locale]}`;
}
