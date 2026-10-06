// Buscador global (Ctrl+K): solicitudes, contactos, campañas y lo demás que el rol pueda ver.
// Patrón combobox con aria-activedescendant: el foco se queda en el campo y las flechas mueven
// la opción activa.
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api';
import { navegar } from '../ruteo';

export interface Resultado {
  tipo: string;
  id: string;
  titulo: string;
  detalle?: string | null;
  href: string;
}

const TIPOS: Record<string, string> = {
  lead: 'Solicitudes',
  contacto: 'Contactos',
  campana: 'Campañas',
  conversacion: 'Conversaciones',
  contenido: 'Contenido del sitio',
  proyecto: 'Proyectos',
  organizacion: 'Organizaciones',
  usuario: 'Equipo',
};

export function BuscadorGlobal({ alCerrar }: { alCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [activo, setActivo] = useState(0);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
    campo.current?.focus();
  }, []);

  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 2) {
      setResultados([]);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setBuscando(true);
      api<{ resultados: Resultado[] }>(`/admin/api/buscar?q=${encodeURIComponent(texto)}`, { signal: ctl.signal })
        .then((d) => {
          setResultados(d.resultados);
          setActivo(0);
        })
        .catch(() => null)
        .finally(() => setBuscando(false));
    }, 180);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const ir = (r: Resultado | undefined) => {
    if (!r) return;
    ref.current?.close();
    alCerrar();
    navegar(r.href);
  };

  const tecla = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo((a) => Math.min(resultados.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      ir(resultados[activo]);
    }
  };

  let grupo = '';
  return (
    <dialog ref={ref} class="dialogo buscador-global" aria-label="Buscar en el panel" onClose={alCerrar} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <div class="bg-campo">
        <svg class="buscador-icono" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="9" cy="9" r="6" />
          <path d="M14 14l4 4" />
        </svg>
        <input
          ref={campo}
          type="text"
          role="combobox"
          aria-expanded={resultados.length > 0}
          aria-controls="bg-lista"
          aria-activedescendant={resultados[activo] ? `bg-${activo}` : undefined}
          aria-autocomplete="list"
          aria-label="Buscar"
          placeholder="Nombre, empresa, correo, asunto..."
          value={q}
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
          onKeyDown={tecla}
          autoFocus
        />
        <kbd>Esc</kbd>
      </div>
      <ul id="bg-lista" role="listbox" class="bg-lista" aria-label="Resultados">
        {resultados.map((r, i) => {
          const cabeza = r.tipo !== grupo ? (grupo = r.tipo) : null;
          return (
            <>
              {cabeza && (
                <li role="presentation" class="bg-grupo">
                  {TIPOS[cabeza] ?? cabeza}
                </li>
              )}
              <li id={`bg-${i}`} role="option" aria-selected={i === activo} class="bg-opcion" onPointerMove={() => setActivo(i)} onClick={() => ir(r)}>
                <span class="bg-titulo">{r.titulo}</span>
                {r.detalle && <span class="bg-detalle">{r.detalle}</span>}
              </li>
            </>
          );
        })}
      </ul>
      <p class="bg-estado" role="status">
        {q.trim().length < 2 ? 'Escribe al menos dos letras.' : buscando ? 'Buscando' : resultados.length ? `${resultados.length} resultados` : 'Sin resultados.'}
      </p>
    </dialog>
  );
}
