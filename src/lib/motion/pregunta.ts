// Preguntarle al facilitador del mundo pixel (PreguntaPixel.astro): la pregunta va al mismo asesor
// de IA de la burbuja flotante, con el historial compartido (src/lib/conversacion.ts), y la
// respuesta sale en la burbuja del facilitador con los botones de WhatsApp, del cotizador y
// "Seguir en el chat". Mientras conversa deja su guion; si nadie pregunta en un rato, lo retoma.
//
// No es motion: funciona también con movimiento reducido. En ese caso (o si el motor aún no cargó)
// responde la burbuja quieta del PNG.
import { ui } from '../../i18n/ui';
import { enlaceCotizador, enlaceWhatsapp, textoPlano } from '../asesor';
import { EVENTO_ABRIR, preguntarAsesor } from '../conversacion';
import { llenarBurbuja, type Accion } from './lienzo';

/** Quien responde: el facilitador del estudio o el de la sala. */
export interface Hablante {
  pensar(texto: string): void;
  decir(texto: string, acciones: Accion[]): void;
  soltar(): void;
}

/** Tiempo sin preguntas antes de que el facilitador vuelva a lo suyo. */
const ESPERA = 40_000;

/** La burbuja quieta del PNG, para cuando no hay escena animada. */
export function hablanteQuieto(raiz: HTMLElement): Hablante {
  return {
    pensar: (t) => llenarBurbuja(raiz, t),
    decir: (t, acciones) => llenarBurbuja(raiz, t, undefined, acciones),
    soltar: () => {},
  };
}

export function iniciarPregunta(form: HTMLFormElement, hablante: () => Hablante) {
  const locale = document.documentElement.lang.startsWith('es') ? 'es' : 'en';
  const a = ui[locale].asesor;
  const f = a.facilitador;
  const d = form.dataset;
  const campo = form.querySelector<HTMLInputElement>('[data-pregunta-campo]');
  const enviar = form.querySelector<HTMLButtonElement>('[data-pregunta-enviar]');
  const voz = form.querySelector<HTMLElement>('[data-pregunta-voz]');
  if (!campo || !enviar || !voz || !d.api) return;
  const api = d.api;

  let ocupado = false;
  let reloj = 0;
  let actual: Hablante | null = null;
  const soltarLuego = () => {
    clearTimeout(reloj);
    const revisar = () => {
      // Si la persona sigue en el campo o leyendo la burbuja, espera un poco más.
      if (form.matches(':focus-within') || document.querySelector('.burbuja-pixel:hover')) {
        reloj = window.setTimeout(revisar, 5000);
        return;
      }
      actual?.soltar();
      actual = null;
    };
    reloj = window.setTimeout(revisar, ESPERA);
  };

  const seguir: Accion = { texto: f.seguir, alClic: () => dispatchEvent(new CustomEvent(EVENTO_ABRIR)) };
  const soloWhatsapp: Accion = { texto: a.soloWhatsapp, href: enlaceWhatsapp(d.wa ?? '', d.mensaje ?? ''), externo: true };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = campo.value.trim();
    if (!texto || ocupado) return;
    ocupado = true;
    enviar.disabled = true;
    clearTimeout(reloj);
    actual = hablante();
    actual.pensar(f.pensando);
    voz.textContent = a.escribiendo;

    const r = await preguntarAsesor({ api, locale, pagina: 'inicio', texto, origen: 'facilitador' });
    let respuesta: string;
    const acciones: Accion[] = [];
    if (r.ok) {
      respuesta = textoPlano(r.respuesta.texto);
      if (r.respuesta.whatsapp) acciones.push({ texto: a.whatsapp, href: enlaceWhatsapp(d.wa ?? '', r.respuesta.whatsapp), externo: true });
      if (r.respuesta.contacto) acciones.push({ texto: a.contacto, href: enlaceCotizador(d.cotizador ?? '', r.respuesta.contacto.servicio) });
      acciones.push(seguir);
      campo.value = '';
    } else {
      respuesta = r.motivo === 'no_disponible' ? a.noDisponible : r.motivo === 'limite' ? a.limite : a.error;
      acciones.push(soloWhatsapp);
    }
    actual.decir(respuesta, acciones);
    voz.textContent = respuesta;
    ocupado = false;
    enviar.disabled = false;
    soltarLuego();
  });
}
