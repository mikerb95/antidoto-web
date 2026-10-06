// Confirmaciones, preguntas y avisos breves. Los diálogos usan <dialog> nativo (foco atrapado y
// Escape gratis); los avisos van en una región aria-live.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Boton } from './base';

interface Pedido {
  titulo: string;
  texto?: ComponentChildren;
  confirmar: string;
  peligro?: boolean;
  /** Si viene, el diálogo pide un texto (prompt). */
  campo?: { etiqueta: string; valor?: string };
  resolver: (r: string | boolean | null) => void;
}

let abrir: (p: Pedido) => void = () => {};
let avisarFn: (texto: string, tono?: 'exito' | 'error') => void = () => {};

export function confirmar(o: { titulo: string; texto?: ComponentChildren; confirmar?: string; peligro?: boolean }): Promise<boolean> {
  return new Promise((r) => abrir({ confirmar: 'Continuar', ...o, resolver: (x) => r(x === true) }));
}

export function preguntar(o: { titulo: string; texto?: ComponentChildren; etiqueta: string; valor?: string; confirmar?: string }): Promise<string | null> {
  return new Promise((r) =>
    abrir({ titulo: o.titulo, texto: o.texto, confirmar: o.confirmar ?? 'Guardar', campo: { etiqueta: o.etiqueta, valor: o.valor }, resolver: (x) => r(typeof x === 'string' ? x : null) }),
  );
}

export const avisar = (texto: string, tono?: 'exito' | 'error') => avisarFn(texto, tono);

export function AnfitrionDialogos() {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [texto, setTexto] = useState('');
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    abrir = (p) => {
      setTexto(p.campo?.valor ?? '');
      setPedido(p);
    };
  }, []);
  useEffect(() => {
    if (pedido && ref.current && !ref.current.open) ref.current.showModal();
  }, [pedido]);
  const cerrar = (r: string | boolean | null) => {
    pedido?.resolver(r);
    ref.current?.close();
    setPedido(null);
  };
  return (
    <dialog ref={ref} class="dialogo" aria-labelledby="dialogo-titulo" onCancel={(e) => (e.preventDefault(), cerrar(null))}>
      {pedido && (
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            cerrar(pedido.campo ? texto.trim() || null : true);
          }}
        >
          <h2 id="dialogo-titulo">{pedido.titulo}</h2>
          {pedido.texto && <div class="dialogo-texto">{pedido.texto}</div>}
          {pedido.campo && (
            <label class="campo">
              <span class="campo-etq">{pedido.campo.etiqueta}</span>
              <input value={texto} onInput={(e) => setTexto((e.target as HTMLInputElement).value)} required maxLength={120} autoFocus />
            </label>
          )}
          <div class="dialogo-acciones">
            <Boton onClick={() => cerrar(null)}>Cancelar</Boton>
            <Boton type="submit" variante={pedido.peligro ? 'peligro' : 'primario'} autoFocus={!pedido.campo && !pedido.peligro}>
              {pedido.confirmar}
            </Boton>
          </div>
        </form>
      )}
    </dialog>
  );
}

export function AnfitrionAvisos() {
  const [aviso, setAviso] = useState<{ texto: string; tono?: 'exito' | 'error'; n: number } | null>(null);
  const t = useRef<number>();
  useEffect(() => {
    avisarFn = (texto, tono) => {
      setAviso((a) => ({ texto, tono, n: (a?.n ?? 0) + 1 }));
      clearTimeout(t.current);
      t.current = window.setTimeout(() => setAviso(null), 4000);
    };
  }, []);
  return (
    <div class="avisos" role="status" aria-live="polite">
      {aviso && (
        <p key={aviso.n} class={`toast${aviso.tono ? ` toast-${aviso.tono}` : ''}`}>
          {aviso.texto}
        </p>
      )}
    </div>
  );
}
