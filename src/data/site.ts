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

/**
 * Clip del hero de la home. Cuando el cliente lo entregue (horizontal, 1080p, 15 a 25 s, sin
 * texto, logos ni audio), codifícalo a MP4 H.264 de 720p y ~1 MB (y si se quiere, WebM AV1),
 * déjalo en public/video/ y pon aquí sus rutas. Mientras sea null, la escena son las fotos.
 */
export const VIDEO_HERO: { mp4: string; webm?: string } | null = null as { mp4: string; webm?: string } | null;
