// Datos de contacto y cifras dadas por el cliente. Fuente: auditoria/02-prompt-claude-design.md §1.

export const SITE = {
  name: 'Antídoto',
  url: 'https://antidotocolombia.com',
  whatsapp: '573125568016',
  phoneDisplay: '+57 312 556 8016',
  email: 'antidoto.colombia@outlook.com',
  instagram: 'https://www.instagram.com/antidoto.colombia/',
  linkedin: 'https://www.linkedin.com/company/antidoto-colombia-s-a-s/',
  foundingYear: 2020,
} as const;

/** Enlace de WhatsApp con el mensaje ya escrito. */
export function waLink(message: string): string {
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
}
