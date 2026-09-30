// De dónde llegó la visita (UTM de la primera página y dominio que la refirió), para saber en
// la bandeja qué canales traen solicitudes. Vive en sessionStorage: dura la visita, no sigue a
// nadie entre visitas y no sale del navegador salvo con el lead autorizado.
const CLAVE = 'antidoto-origen';

interface Origen {
  utm?: { source?: string; medium?: string; campaign?: string };
  referente?: string;
}

/** Se llama al cargar cada página; solo guarda en la primera de la visita. */
export function registrarOrigen(): void {
  try {
    if (sessionStorage.getItem(CLAVE)) return;
    const p = new URLSearchParams(location.search);
    const utm = { source: p.get('utm_source') ?? undefined, medium: p.get('utm_medium') ?? undefined, campaign: p.get('utm_campaign') ?? undefined };
    const ref = document.referrer && new URL(document.referrer).origin !== location.origin ? document.referrer : undefined;
    const origen: Origen = { utm: Object.values(utm).some(Boolean) ? utm : undefined, referente: ref };
    sessionStorage.setItem(CLAVE, JSON.stringify(origen));
  } catch {
    // Sin almacenamiento (modo privado estricto): el lead llega sin origen.
  }
}

export function leerOrigen(): Origen {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE) ?? '{}') as Origen;
  } catch {
    return {};
  }
}
