// Plataforma de misiones (proyecto aparte) vista desde el panel: formas de su resumen y la entrada
// sin otra contraseña. El panel nunca guarda sus datos: los pide a la API cada vez.
import type { ResumenMisiones, EmpresaMisiones, ActividadMisiones } from '@api/misiones';
import { api, mensajeError, ErrorApi } from './api';
import { avisar } from './ui/dialogos';
import { fecha } from './formato';
import type { Punto } from './ui/graficas';

export type { ResumenMisiones, EmpresaMisiones, ActividadMisiones };

export interface DatosMisiones {
  configurada: boolean;
  url?: string;
  puedeEntrar?: boolean;
  resumen?: ResumenMisiones;
}

export const ESTADOS_ACTIVIDAD: Record<ActividadMisiones['estado'], { texto: string; tono: string }> = {
  activo: { texto: 'Activa', tono: 'exito' },
  pausado: { texto: 'En pausa', tono: 'alerta' },
  vencido: { texto: 'Vencida', tono: 'apagado' },
};

const SEMANA = 7 * 86_400_000;

/** La serie semanal del resumen (de la más vieja a la actual) como puntos de una gráfica. */
export function semanasMisiones(semanas: number[], ahora = Date.now()): Punto[] {
  return semanas.map((n, i) => {
    const desde = ahora - (semanas.length - i) * SEMANA;
    return { etiqueta: fecha(desde), detalle: `Semana del ${fecha(desde)}`, n };
  });
}

/** Mensaje cuando la plataforma de misiones no responde (la API del panel contesta 502). */
export const mensajeMisiones = (e: unknown): string =>
  e instanceof ErrorApi && e.status === 502 ? 'La plataforma de misiones no respondió. Intenta de nuevo en un momento.' : mensajeError(e);

/**
 * Abre la plataforma de misiones en otra pestaña, ya con sesión. La pestaña se abre antes de pedir
 * el pase (si no, el navegador la bloquea como ventana emergente) y después se lleva al enlace.
 */
export async function abrirMisiones(destino = '/admin'): Promise<void> {
  const pestana = window.open('', '_blank');
  try {
    const { url } = await api<{ url: string }>('/admin/api/misiones/pase', { body: { destino } });
    if (pestana) {
      pestana.opener = null;
      pestana.location.href = url;
    } else {
      location.href = url;
    }
  } catch (e) {
    pestana?.close();
    avisar(mensajeMisiones(e), 'error');
  }
}
