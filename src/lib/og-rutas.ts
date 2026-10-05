// Ruta de la imagen para compartir de cada página (la genera src/pages/og/[locale]/[nombre].jpg.ts).
import type { Locale } from '../i18n/ui';

export type TipoOg = 'linea' | 'oferta' | 'solucion';

export const ogRuta = (tipo: TipoOg, clave: string, locale: Locale): string => `/og/${locale}/${tipo}-${clave}.jpg`;
