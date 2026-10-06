// Piezas comunes del panel. Todo el texto que viene de la base se pinta como texto (Preact
// escapa por defecto); nunca se usa dangerouslySetInnerHTML.
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import { ErrorApi, mensajeError } from '../api';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro';

export function Boton({
  variante = 'secundario',
  chico,
  class: clase,
  type = 'button',
  ...resto
}: { variante?: Variante; chico?: boolean } & JSX.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} class={`btn btn-${variante}${chico ? ' btn-chico' : ''}${clase ? ` ${clase}` : ''}`} {...resto} />;
}

export function BotonEnlace({ variante = 'secundario', chico, class: clase, ...resto }: { variante?: Variante; chico?: boolean } & JSX.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a class={`btn btn-${variante}${chico ? ' btn-chico' : ''}${clase ? ` ${clase}` : ''}`} {...resto} />;
}

/** Cabecera de una pantalla: título (el único h1), descripción y acciones. */
export function Cabecera({ titulo, descripcion, acciones, volver }: { titulo: ComponentChildren; descripcion?: ComponentChildren; acciones?: ComponentChildren; volver?: { href: string; texto: string } }) {
  const h1 = useRef<HTMLHeadingElement>(null);
  return (
    <header class="cabecera">
      <div class="cabecera-texto">
        {volver && (
          <a class="volver" href={volver.href}>
            <span aria-hidden="true">←</span> {volver.texto}
          </a>
        )}
        <h1 ref={h1} tabIndex={-1} id="titulo-pagina">
          {titulo}
        </h1>
        {descripcion && <p class="cabecera-desc">{descripcion}</p>}
      </div>
      {acciones && <div class="cabecera-acciones">{acciones}</div>}
    </header>
  );
}

export function Tarjeta({ titulo, acciones, children, class: clase, sinRelleno }: { titulo?: ComponentChildren; acciones?: ComponentChildren; children: ComponentChildren; class?: string; sinRelleno?: boolean }) {
  return (
    <section class={`tarjeta${sinRelleno ? ' sin-relleno' : ''}${clase ? ` ${clase}` : ''}`}>
      {(titulo || acciones) && (
        <div class="tarjeta-cabeza">
          {titulo && <h2>{titulo}</h2>}
          {acciones && <div class="tarjeta-acciones">{acciones}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Cifra destacada (stat tile): etiqueta, valor y nota opcional. */
export function Cifra({ etiqueta, valor, nota, href, tono }: { etiqueta: string; valor: ComponentChildren; nota?: ComponentChildren; href?: string; tono?: 'alerta' }) {
  const cuerpo = (
    <>
      <p class="cifra-etq">{etiqueta}</p>
      <p class="cifra-valor">{valor}</p>
      {nota && <p class="cifra-nota">{nota}</p>}
    </>
  );
  return href ? (
    <a class={`cifra cifra-enlace${tono ? ` cifra-${tono}` : ''}`} href={href}>
      {cuerpo}
    </a>
  ) : (
    <div class={`cifra${tono ? ` cifra-${tono}` : ''}`}>{cuerpo}</div>
  );
}

export const Cifras = ({ children }: { children: ComponentChildren }) => <div class="cifras">{children}</div>;

/** Insignia de estado: punto de color más texto (el color nunca va solo). */
export function Insignia({ tono, children }: { tono: string; children: ComponentChildren }) {
  return (
    <span class={`insignia t-${tono}`}>
      <span class="insignia-punto" aria-hidden="true" />
      {children}
    </span>
  );
}

export function Campo({ etiqueta, ayuda, error, children, ancho }: { etiqueta: ComponentChildren; ayuda?: ComponentChildren; error?: string | null; children: ComponentChildren; ancho?: 'completo' }) {
  return (
    <label class={`campo${ancho ? ' campo-completo' : ''}${error ? ' campo-error' : ''}`}>
      <span class="campo-etq">{etiqueta}</span>
      {children}
      {ayuda && <span class="campo-ayuda">{ayuda}</span>}
      {error && <span class="campo-msj">{error}</span>}
    </label>
  );
}

export function Casilla({ children, ...resto }: { children: ComponentChildren } & JSX.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label class="casilla">
      <input type="checkbox" {...resto} />
      <span>{children}</span>
    </label>
  );
}

/** Grupo de filtros tipo chip (aria-pressed). */
export function Chips<T extends string>({ opciones, valor, alCambiar, etiqueta }: { opciones: { valor: T; texto: string; n?: number }[]; valor: T; alCambiar: (v: T) => void; etiqueta: string }) {
  return (
    <div class="chips" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button type="button" class="chip" aria-pressed={o.valor === valor} onClick={() => alCambiar(o.valor)}>
          {o.texto}
          {o.n !== undefined && <span class="chip-n">{o.n}</span>}
        </button>
      ))}
    </div>
  );
}

export function Buscador({ valor, alCambiar, placeholder, etiqueta }: { valor: string; alCambiar: (v: string) => void; placeholder: string; etiqueta: string }) {
  const t = useRef<number>();
  const id = useId();
  return (
    <div class="buscador">
      <label class="sr" for={id}>
        {etiqueta}
      </label>
      <svg class="buscador-icono" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="9" cy="9" r="6" />
        <path d="M14 14l4 4" />
      </svg>
      <input
        id={id}
        type="search"
        placeholder={placeholder}
        defaultValue={valor}
        onInput={(e) => {
          const v = (e.target as HTMLInputElement).value;
          clearTimeout(t.current);
          t.current = window.setTimeout(() => alCambiar(v.trim()), 250);
        }}
      />
    </div>
  );
}

export function Paginacion({ total, pagina, porPagina, alCambiar }: { total: number; pagina: number; porPagina: number; alCambiar: (p: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (total <= porPagina) return <p class="paginacion-texto">{total === 1 ? '1 resultado' : `${total} resultados`}</p>;
  return (
    <nav class="paginacion" aria-label="Paginación">
      <Boton chico disabled={pagina === 0} onClick={() => alCambiar(pagina - 1)}>
        Anteriores
      </Boton>
      <span class="paginacion-texto">
        {total} resultados · página {pagina + 1} de {paginas}
      </span>
      <Boton chico disabled={pagina + 1 >= paginas} onClick={() => alCambiar(pagina + 1)}>
        Siguientes
      </Boton>
    </nav>
  );
}

export function Vacio({ titulo, children, accion }: { titulo: string; children?: ComponentChildren; accion?: ComponentChildren }) {
  return (
    <div class="vacio">
      <p class="vacio-titulo">{titulo}</p>
      {children && <p class="vacio-texto">{children}</p>}
      {accion}
    </div>
  );
}

export function Cargando({ texto = 'Cargando' }: { texto?: string }) {
  return (
    <div class="cargando" role="status">
      <span class="cargando-punto" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}

export function FalloCarga({ error, reintentar }: { error: ErrorApi | null; reintentar?: () => void }) {
  return (
    <div class="aviso aviso-error" role="alert">
      <p>{mensajeError(error, 'No se pudo cargar.')}</p>
      {reintentar && (
        <Boton chico onClick={reintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  );
}

export function Aviso({ tono = 'info', children }: { tono?: 'info' | 'exito' | 'alerta' | 'error'; children: ComponentChildren }) {
  return (
    <div class={`aviso aviso-${tono}`} role={tono === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

/** Lista de definiciones que omite los datos vacíos. */
export function Datos({ filas }: { filas: [string, ComponentChildren][] }) {
  const llenas = filas.filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false);
  return (
    <dl class="datos">
      {llenas.map(([k, v]) => (
        <div class="datos-fila">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Panel lateral de detalle. En pantallas angostas cubre la lista; Escape lo cierra. */
export function PanelLateral({ titulo, etiqueta, alCerrar, children, ancho }: { titulo: ComponentChildren; etiqueta?: ComponentChildren; alCerrar: () => void; children: ComponentChildren; ancho?: 'ancho' }) {
  const h2 = useRef<HTMLHeadingElement>(null);
  const id = useId();
  useEffect(() => {
    h2.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('dialog[open]') && alCerrar();
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
  return (
    <aside class={`lateral${ancho ? ' lateral-ancho' : ''}`} aria-labelledby={id}>
      <div class="lateral-cabeza">
        <div>
          {etiqueta && <p class="lateral-etq">{etiqueta}</p>}
          <h2 id={id} ref={h2} tabIndex={-1}>
            {titulo}
          </h2>
        </div>
        <button type="button" class="cerrar" onClick={alCerrar} aria-label="Cerrar detalle">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
      <div class="lateral-cuerpo">{children}</div>
    </aside>
  );
}

export function Seccion({ titulo, children, acciones }: { titulo: string; children: ComponentChildren; acciones?: ComponentChildren }) {
  return (
    <section class="seccion">
      <div class="seccion-cabeza">
        <h3>{titulo}</h3>
        {acciones}
      </div>
      {children}
    </section>
  );
}

/** Pestañas accesibles (role=tablist) con flechas izquierda y derecha. */
export function Pestanas<T extends string>({ opciones, valor, alCambiar, etiqueta }: { opciones: { valor: T; texto: string; n?: number }[]; valor: T; alCambiar: (v: T) => void; etiqueta: string }) {
  const tecla = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + opciones.length) % opciones.length;
    alCambiar(opciones[j]!.valor);
    ((e.currentTarget as HTMLElement).parentElement?.children[j] as HTMLElement | undefined)?.focus();
  };
  return (
    <div class="pestanas" role="tablist" aria-label={etiqueta}>
      {opciones.map((o, i) => (
        <button type="button" role="tab" class="pestana" aria-selected={o.valor === valor} tabIndex={o.valor === valor ? 0 : -1} onClick={() => alCambiar(o.valor)} onKeyDown={(e) => tecla(e, i)}>
          {o.texto}
          {o.n !== undefined && <span class="chip-n">{o.n}</span>}
        </button>
      ))}
    </div>
  );
}
