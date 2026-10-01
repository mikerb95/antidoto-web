// Versiones de las autorizaciones que acepta la API. El sitio (FTP, a mano) y la API (Worker)
// se despliegan por separado: durante el cambio de un texto, alguna de las dos partes lleva la
// versión anterior. Por eso se acepta la vigente y las de "anteriores", y se guarda el texto
// exacto de la versión que la persona vio.
import datos from '../../src/data/consentimiento.json';

export interface Version {
  version: string;
  es: string;
  en: string;
}

export type Bloque = Version & { anteriores?: Version[] };

const BLOQUES: Record<'cotizacion' | 'novedades', Bloque> = { cotizacion: datos, novedades: datos.marketing };

/** Versión vigente de una autorización. */
export const vigente = (tipo: keyof typeof BLOQUES): Version => BLOQUES[tipo];

/** La versión de un bloque si es la vigente o una anterior conocida; si no, null. Función pura. */
export function buscarVersion(b: Bloque, version: unknown): Version | null {
  if (typeof version !== 'string') return null;
  return [b, ...(b.anteriores ?? [])].find((v) => v.version === version) ?? null;
}

export const aceptada = (tipo: keyof typeof BLOQUES, version: unknown) => buscarVersion(BLOQUES[tipo], version);
