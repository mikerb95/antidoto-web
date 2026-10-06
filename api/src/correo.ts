// Correos con Resend (API HTTP, sin SDK). Sin RESEND_API_KEY no se envía nada: se registra
// en el log y el flujo sigue (fail-open). Las plantillas son funciones puras para probarlas.
import type { Env } from './env';
import type { Lead } from './db/schema';
import { escapar } from './util';

export interface Correo {
  para: string | string[];
  asunto: string;
  html: string;
  texto: string;
  responderA?: string;
  /** Remitente; por defecto MAIL_FROM. */
  de?: string;
  cabeceras?: Record<string, string>;
}

export async function enviar(env: Env, c: Correo): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    // En local se imprime completo para poder usar el enlace de acceso sin Resend.
    console.log(`[correo omitido: falta RESEND_API_KEY] ${c.asunto}${env.ENTORNO === 'local' ? `\n${c.texto}` : ''}`);
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: c.de ?? env.MAIL_FROM,
        to: Array.isArray(c.para) ? c.para : [c.para],
        subject: c.asunto,
        html: c.html,
        text: c.texto,
        reply_to: c.responderA,
        headers: c.cabeceras,
      }),
    });
    if (!res.ok) console.error(`[correo] Resend respondió ${res.status}: ${await res.text()}`);
    return res.ok;
  } catch (e) {
    console.error('[correo] fallo de red', e);
    return false;
  }
}

export const NOMBRE_SERVICIO: Record<Lead['servicio'], { es: string; en: string }> = {
  formaciones: { es: 'Formaciones vivenciales', en: 'Experiential training' },
  audiovisual: { es: 'Producción audiovisual', en: 'Video production' },
  catering: { es: 'Catering corporativo', en: 'Corporate catering' },
  diseno: { es: 'Diseño de productos y experiencias', en: 'Product and experience design' },
  ia: { es: 'Capacitación en IA para el trabajo', en: 'AI training for work' },
};

/** Marco común: tinta sobre blanco, con el cian de marca solo en el acento. */
function marco(titulo: string, cuerpo: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F1EFE9;font-family:Helvetica,Arial,sans-serif;color:#0F181D">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px">
<tr><td style="padding:28px 28px 8px;border-top:4px solid #3BC8F3;border-radius:14px 14px 0 0">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#0C5C7D">Antídoto</p>
<h1 style="margin:0;font-size:22px;line-height:1.25">${escapar(titulo)}</h1></td></tr>
<tr><td style="padding:12px 28px 28px;font-size:15px;line-height:1.55">${cuerpo}</td></tr>
</table></td></tr></table></body></html>`;
}

const filas = (pares: [string, string | number | null | undefined][]) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 16px">${pares
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#5b6b70;font-size:13px;white-space:nowrap;vertical-align:top">${escapar(k)}</td><td style="padding:6px 0;border-bottom:1px solid #eee">${escapar(v)}</td></tr>`,
    )
    .join('')}</table>`;

const boton = (href: string, texto: string) =>
  `<p style="margin:20px 0"><a href="${escapar(href)}" style="display:inline-block;background:#0F181D;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">${escapar(texto)}</a></p>`;

const textoPlano = (pares: [string, string | number | null | undefined][]) =>
  pares
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

/**
 * Aviso interno: alguien mostró interés en el chat con IA. No lleva datos personales (el chat
 * no los pide y tapa los que se escriban); solo lo que el asistente resumió y desde dónde.
 */
export function correoInteresAsesor(d: {
  accion: 'whatsapp' | 'cotizador';
  servicio: Lead['servicio'] | null;
  necesidad: string | null;
  pagina: string | null;
  locale: 'es' | 'en';
}): Omit<Correo, 'para'> {
  const servicio = d.servicio ? NOMBRE_SERVICIO[d.servicio].es : null;
  const que = d.accion === 'whatsapp' ? 'preparó un mensaje para WhatsApp' : 'pidió el enlace al cotizador para dejar sus datos';
  const pares: [string, string | null][] = [
    ['Servicio', servicio],
    ['Lo que necesita', d.necesidad],
    ['Página', d.pagina],
    ['Idioma', d.locale === 'en' ? 'Inglés' : 'Español'],
  ];
  const nota = 'Si escribe por WhatsApp, el mensaje llega con este mismo resumen. El chat no guarda la conversación.';
  return {
    asunto: `Interés en el chat con IA${servicio ? `: ${servicio}` : ''}`,
    html: marco(`Alguien ${que}`, `${filas(pares)}<p style="margin:0;color:#5b6b70;font-size:13px">${escapar(nota)}</p>`),
    texto: `Alguien ${que} en el chat con IA.\n\n${textoPlano(pares)}\n\n${nota}`,
  };
}

/** Aviso interno de lead nuevo. */
export function correoLeadEquipo(lead: Lead, appUrl: string): Omit<Correo, 'para'> {
  const servicio = NOMBRE_SERVICIO[lead.servicio].es;
  const quien = lead.empresa ? `${lead.nombre} (${lead.empresa})` : (lead.nombre ?? '');
  const pares: [string, string | number | null][] = [
    ['Servicio', servicio],
    ['Nombre', lead.nombre],
    ['Organización', lead.empresa],
    ['Tipo', lead.tipoOrganizacion],
    ['Correo', lead.email],
    ['Teléfono', lead.telefono],
    ['Fecha', lead.fecha],
    ['Personas', lead.personas],
    ['Ciudad', lead.ciudad],
    ['Idioma', lead.locale === 'en' ? 'Inglés' : 'Español'],
    ['Origen', [lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean).join(' / ') || lead.referente || 'Directo'],
    ['Página', lead.pagina],
  ];
  const enlace = `${appUrl}/admin/solicitudes/${lead.id}`;
  const wa = lead.telefono ? `https://wa.me/${lead.telefono.replace(/\D/g, '')}` : null;
  return {
    asunto: `Nuevo lead: ${servicio} · ${quien}`,
    responderA: lead.email ?? undefined,
    html: marco(
      `Nueva solicitud de ${servicio.charAt(0).toLowerCase()}${servicio.slice(1)}`,
      `${filas(pares)}${lead.mensaje ? `<p style="margin:0 0 6px;color:#5b6b70;font-size:13px">Mensaje</p><p style="margin:0;white-space:pre-wrap">${escapar(lead.mensaje)}</p>` : ''}${boton(enlace, 'Abrir en la bandeja')}${wa ? `<p style="margin:0"><a href="${escapar(wa)}" style="color:#0C5C7D">Escribir por WhatsApp</a></p>` : ''}`,
    ),
    texto: `Nueva solicitud de ${servicio}\n\n${textoPlano(pares)}\n\n${lead.mensaje ?? ''}\n\nBandeja: ${enlace}`,
  };
}

/**
 * Confirmación a quien pidió la cotización, en su idioma. El correo no está verificado y
 * cualquiera puede escribir el de otra persona: por eso no repite nada de texto libre (nombre,
 * organización, ciudad), solo datos con forma fija. Así nadie puede usar el cotizador para mandar
 * su propio mensaje con el dominio de Antídoto.
 */
export function correoLeadCliente(lead: Lead, equipo: string): Omit<Correo, 'para'> {
  const en = lead.locale === 'en';
  const servicio = NOMBRE_SERVICIO[lead.servicio][lead.locale];
  const pares: [string, string | number | null][] = en
    ? [['Service', servicio], ['Date', lead.fecha], ['People', lead.personas]]
    : [['Servicio', servicio], ['Fecha', lead.fecha], ['Personas', lead.personas]];
  const hola = en ? 'Hi,' : 'Hola,';
  const recibido = en
    ? 'We received your quote request. Our team will contact you soon.'
    : 'Recibimos tu solicitud de cotización. Nuestro equipo te va a contactar pronto.';
  const derechos = en
    ? `You can ask us to see, correct or delete your data at any time by replying to this email or writing to ${equipo}.`
    : `Puedes pedirnos consultar, corregir o eliminar tus datos en cualquier momento respondiendo este correo o escribiendo a ${equipo}.`;
  return {
    asunto: en ? 'We received your request · Antídoto' : 'Recibimos tu solicitud · Antídoto',
    responderA: equipo,
    html: marco(
      en ? 'We received your request' : 'Recibimos tu solicitud',
      `<p style="margin:0 0 12px">${escapar(hola)}</p><p style="margin:0 0 8px">${escapar(recibido)}</p>${filas(pares)}<p style="margin:0;color:#5b6b70;font-size:13px">${escapar(derechos)}</p>`,
    ),
    texto: `${hola}\n\n${recibido}\n\n${textoPlano(pares)}\n\n${derechos}`,
  };
}

export function correoEnlaceAcceso(enlace: string, minutos: number): Omit<Correo, 'para'> {
  return {
    asunto: 'Tu enlace para entrar a la bandeja de Antídoto',
    html: marco(
      'Entrar a la bandeja',
      `<p style="margin:0 0 8px">Usa este botón para entrar. Sirve una sola vez y vence en ${minutos} minutos.</p>${boton(enlace, 'Entrar')}<p style="margin:0;color:#5b6b70;font-size:13px">Si no lo pediste, ignora este correo.</p>`,
    ),
    texto: `Entra a la bandeja con este enlace (sirve una vez, vence en ${minutos} minutos):\n${enlace}\n\nSi no lo pediste, ignora este correo.`,
  };
}

export function correoSeguimiento(pendientes: Lead[], appUrl: string, horas: number): Omit<Correo, 'para'> {
  const n = pendientes.length;
  const lista = pendientes.map((l) => {
    const quien = l.empresa ? `${l.nombre} (${l.empresa})` : (l.nombre ?? 'Sin nombre');
    const dias = Math.floor((Date.now() - l.creado) / 86_400_000);
    return { quien, servicio: NOMBRE_SERVICIO[l.servicio].es, hace: dias ? `hace ${dias} d` : 'hoy', href: `${appUrl}/admin/solicitudes/${l.id}` };
  });
  return {
    asunto: n === 1 ? `1 lead sin respuesta después de ${horas} h` : `${n} leads sin respuesta después de ${horas} h`,
    html: marco(
      'Leads sin respuesta',
      `<p style="margin:0 0 8px">Estos leads siguen en "nuevo" después de ${horas} horas:</p><ul style="padding-left:18px">${lista
        .map((l) => `<li style="margin:6px 0"><a href="${escapar(l.href)}" style="color:#0C5C7D">${escapar(l.quien)}</a> · ${escapar(l.servicio)} · ${escapar(l.hace)}</li>`)
        .join('')}</ul>${boton(`${appUrl}/admin/`, 'Abrir el panel')}`,
    ),
    texto: `Leads en "nuevo" después de ${horas} horas:\n\n${lista.map((l) => `- ${l.quien} · ${l.servicio} · ${l.hace}\n  ${l.href}`).join('\n')}`,
  };
}
