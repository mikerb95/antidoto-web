// Carga diferida de cada pantalla: el bundle inicial solo trae el armazón y la vista abierta.
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Cargando } from './ui/base';

export type Vista = ComponentType<{ params: string[] }>;

export function perezoso(cargar: () => Promise<{ default: Vista }>): Vista {
  let Componente: Vista | null = null;
  let promesa: Promise<void> | null = null;
  return function Perezoso(props) {
    const [, forzar] = useState(0);
    const [fallo, setFallo] = useState(false);
    useEffect(() => {
      if (Componente) return;
      promesa ??= cargar().then((m) => void (Componente = m.default));
      promesa.then(() => forzar(1)).catch(() => {
        promesa = null;
        setFallo(true);
      });
    }, []);
    if (fallo)
      return (
        <div class="aviso aviso-error" role="alert">
          <p>No se pudo cargar esta pantalla. Puede que haya una versión nueva del panel.</p>
          <button type="button" class="btn btn-secundario btn-chico" onClick={() => location.reload()}>
            Recargar
          </button>
        </div>
      );
    return Componente ? <Componente {...props} /> : <Cargando />;
  };
}
