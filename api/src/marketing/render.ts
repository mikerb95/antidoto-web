// Formato de las campañas: texto simple que el equipo escribe en la bandeja y que aquí se
// convierte en el HTML del correo (y su versión en texto plano). Todo se escapa primero; solo
// se aceptan enlaces http(s) y mailto. Bloques separados por una línea en blanco:
//
//   # Título grande            ## Subtítulo
//   - elemento de lista        (líneas seguidas que empiezan con "- ")
//   [[Texto del botón|https://…]]
//   ![Descripción de la imagen](https://…)
//   Cualquier otro bloque es un párrafo; un salto de línea simple es <br>.
//
// En línea: **negrita**, *cursiva*, [texto](https://…) y {{nombre}} (o "hola" si no hay nombre).
import { escapar } from '../util';

export interface Datos {
  nombre?: string | null;
}

export interface Pieza {
  asunto: string;
  preheader?: string | null;
  cuerpo: string;
  locale: 'es' | 'en';
}

const URL_SEGURA = /^(https?:\/\/|mailto:)[^\s"'<>]+$/i;
const segura = (u: string) => (URL_SEGURA.test(u) ? u : null);

/** Reemplaza {{nombre}}. Sin nombre usa una forma neutra según el idioma. */
export function personalizar(texto: string, datos: Datos, locale: 'es' | 'en'): string {
  const nombre = datos.nombre?.trim().split(/\s+/)[0];
  return texto.replace(/\{\{\s*nombre\s*\}\}/g, nombre || (locale === 'en' ? 'there' : 'hola'));
}

/** Formato en línea sobre texto YA escapado. */
function enLinea(t: string): string {
  return t
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (todo, texto: string, url: string) => {
      const u = segura(url.replace(/&amp;/g, '&'));
      return u ? `<a href="${escapar(u)}" style="color:#0C5C7D">${texto}</a>` : todo;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

const enLineaPlano = (t: string) =>
  t
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, texto, url) => (segura(url) ? `${texto} (${url})` : texto))
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1$2');

/** Convierte el cuerpo a HTML (sin el marco) y a texto plano. */
export function convertir(cuerpo: string): { html: string; texto: string } {
  const bloques = cuerpo.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const html: string[] = [];
  const texto: string[] = [];
  for (const b of bloques) {
    const boton = b.match(/^\[\[([^|\]]+)\|([^\]\s]+)\]\]$/);
    const imagen = b.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (boton && segura(boton[2]!)) {
      html.push(
        `<p style="margin:24px 0"><a href="${escapar(boton[2])}" style="display:inline-block;background:#0F181D;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:600">${escapar(boton[1])}</a></p>`,
      );
      texto.push(`${boton[1]}: ${boton[2]}`);
    } else if (imagen && /^https:\/\//i.test(imagen[2]!) && segura(imagen[2]!)) {
      html.push(`<p style="margin:16px 0"><img src="${escapar(imagen[2])}" alt="${escapar(imagen[1])}" width="504" style="display:block;width:100%;height:auto;border-radius:10px"></p>`);
      if (imagen[1]) texto.push(`[${imagen[1]}]`);
    } else if (/^#{1,2}\s/.test(b)) {
      const grande = b.startsWith('# ');
      const t = b.replace(/^#{1,2}\s+/, '');
      html.push(`<h2 style="margin:24px 0 8px;font-size:${grande ? 24 : 19}px;line-height:1.25;color:#0F181D">${enLinea(escapar(t))}</h2>`);
      texto.push(enLineaPlano(t).toUpperCase());
    } else if (b.split('\n').every((l) => /^-\s+/.test(l))) {
      const items = b.split('\n').map((l) => l.replace(/^-\s+/, ''));
      html.push(`<ul style="margin:0 0 16px;padding-left:20px">${items.map((i) => `<li style="margin:4px 0">${enLinea(escapar(i))}</li>`).join('')}</ul>`);
      texto.push(items.map((i) => `- ${enLineaPlano(i)}`).join('\n'));
    } else {
      html.push(`<p style="margin:0 0 16px">${enLinea(escapar(b)).replace(/\n/g, '<br>')}</p>`);
      texto.push(enLineaPlano(b));
    }
  }
  return { html: html.join('\n'), texto: texto.join('\n\n') };
}

const PIE = {
  es: {
    motivo: 'Recibes este correo porque te suscribiste a las novedades de Antídoto.',
    baja: 'Darte de baja',
    responsable: 'Antídoto · Estudio creativo empresarial · Colombia',
  },
  en: {
    motivo: 'You are receiving this email because you subscribed to news from Antídoto.',
    baja: 'Unsubscribe',
    responsable: 'Antídoto · Creative studio for organizations · Colombia',
  },
};

/** Correo completo de una campaña para un contacto. */
export function renderizar(p: Pieza, datos: Datos, enlaceBaja: string): { asunto: string; html: string; texto: string } {
  const { html, texto } = convertir(personalizar(p.cuerpo, datos, p.locale));
  const pie = PIE[p.locale];
  const preheader = p.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapar(personalizar(p.preheader, datos, p.locale))}${'&#847; '.repeat(40)}</div>`
    : '';
  return {
    asunto: personalizar(p.asunto, datos, p.locale),
    html: `<!doctype html><html lang="${p.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapar(p.asunto)}</title></head>
<body style="margin:0;background:#F1EFE9;font-family:Helvetica,Arial,sans-serif;color:#0F181D">${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px">
<tr><td style="padding:24px 28px 4px;border-top:4px solid #3BC8F3;border-radius:14px 14px 0 0"><p style="margin:0;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#0C5C7D">Antídoto</p></td></tr>
<tr><td style="padding:8px 28px 20px;font-size:15px;line-height:1.6">${html}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:18px 28px;font-size:12px;line-height:1.5;color:#5b6b70">
${escapar(pie.motivo)} <a href="${escapar(enlaceBaja)}" style="color:#0C5C7D">${escapar(pie.baja)}</a>.<br>${escapar(pie.responsable)}
</td></tr></table>
</td></tr></table></body></html>`,
    texto: `${texto}\n\n--\n${pie.motivo}\n${pie.baja}: ${enlaceBaja}\n${pie.responsable}`,
  };
}
