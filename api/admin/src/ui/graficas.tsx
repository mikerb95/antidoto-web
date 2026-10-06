// Gráficas del panel, en SVG y HTML propios. Todas son de una sola serie (el título la nombra, sin
// leyenda), en el azul medio de la marca, con barras de punta redondeada sobre una línea base,
// tooltip al pasar o enfocar cada marca y la tabla con los mismos datos en un <details>.
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { numero } from '../formato';

export interface Fila {
  etiqueta: string;
  n: number;
  /** Texto que acompaña al valor (por ejemplo, "3 ganadas"). */
  extra?: string;
  href?: string;
}

/** Barras horizontales con el valor en la punta: categorías con nombre largo. */
export function Barras({ filas, vacio = 'Sin datos todavía.', formato = numero }: { filas: Fila[]; vacio?: string; formato?: (n: number) => string }) {
  if (!filas.length) return <p class="suave">{vacio}</p>;
  const max = Math.max(1, ...filas.map((f) => f.n));
  return (
    <ul class="barras">
      {filas.map((f) => (
        <li class="barra">
          <span class="barra-etq">{f.href ? <a href={f.href}>{f.etiqueta}</a> : f.etiqueta}</span>
          <span class="barra-pista" aria-hidden="true">
            <span class="barra-nivel" style={{ width: `${Math.max(f.n ? 2 : 0, (f.n / max) * 100)}%` }} />
          </span>
          <span class="barra-n">
            {formato(f.n)}
            {f.extra && <span class="suave"> · {f.extra}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface Punto {
  etiqueta: string;
  /** Etiqueta larga para el tooltip y la tabla. */
  detalle?: string;
  n: number;
}

/**
 * Columnas en el tiempo (días, semanas, meses). Si viene `referencia`, dibuja una línea
 * horizontal rotulada (por ejemplo, el tope diario de gasto).
 */
export function Columnas({
  puntos,
  titulo,
  formato = numero,
  referencia,
  alto = 160,
}: {
  puntos: Punto[];
  titulo: string;
  formato?: (n: number) => string;
  referencia?: { valor: number; texto: string };
  alto?: number;
}) {
  const [activo, setActivo] = useState<number | null>(null);
  if (!puntos.length) return <p class="suave">Sin datos todavía.</p>;
  const max = Math.max(1e-9, ...puntos.map((p) => p.n), referencia?.valor ?? 0);
  const ancho = 100 / puntos.length;
  const columna = Math.min(24, Math.max(4, 560 / puntos.length - 2));
  const y = (v: number) => alto - (v / max) * (alto - 8);
  const total = puntos.reduce((a, p) => a + p.n, 0);
  return (
    <figure class="columnas">
      <div class="columnas-lienzo" style={{ height: `${alto}px` }} onPointerLeave={() => setActivo(null)}>
        <svg viewBox={`0 0 100 ${alto}`} preserveAspectRatio="none" aria-hidden="true">
          <line class="eje" x1="0" x2="100" y1={alto - 0.5} y2={alto - 0.5} vector-effect="non-scaling-stroke" />
          {referencia && <line class="referencia" x1="0" x2="100" y1={y(referencia.valor)} y2={y(referencia.valor)} vector-effect="non-scaling-stroke" />}
        </svg>
        {referencia && (
          <span class="referencia-etq" style={{ bottom: `${alto - y(referencia.valor) + 2}px` }}>
            {referencia.texto}
          </span>
        )}
        <div class="columnas-marcas">
          {puntos.map((p, i) => (
            <button
              type="button"
              class={`columna${activo === i ? ' activa' : ''}`}
              style={{ width: `${ancho}%` }}
              aria-label={`${p.detalle ?? p.etiqueta}: ${formato(p.n)}`}
              onPointerEnter={() => setActivo(i)}
              onFocus={() => setActivo(i)}
              onBlur={() => setActivo(null)}
            >
              <span class={`columna-nivel${p.n ? '' : ' cero'}`} style={{ height: `${p.n ? Math.max(3, (p.n / max) * (alto - 8)) : 0}px`, width: `${columna}px` }} />
            </button>
          ))}
        </div>
        {activo !== null && puntos[activo] && (
          <div class="tooltip" style={{ left: `${(activo + 0.5) * ancho}%` }} role="presentation">
            <strong>{formato(puntos[activo].n)}</strong>
            <span>{puntos[activo].detalle ?? puntos[activo].etiqueta}</span>
          </div>
        )}
      </div>
      <div class="columnas-eje" aria-hidden="true">
        <span>{puntos[0]!.etiqueta}</span>
        <span>{puntos.at(-1)!.etiqueta}</span>
      </div>
      <details class="ver-tabla">
        <summary>Ver tabla</summary>
        <TablaDatos cabeza={['Periodo', titulo]} filas={puntos.map((p) => [p.detalle ?? p.etiqueta, formato(p.n)])} pie={['Total', formato(total)]} />
      </details>
    </figure>
  );
}

export function TablaDatos({ cabeza, filas, pie }: { cabeza: string[]; filas: ComponentChildren[][]; pie?: ComponentChildren[] }) {
  return (
    <table class="tabla tabla-datos">
      <thead>
        <tr>
          {cabeza.map((c, i) => (
            <th scope="col" class={i ? 'num' : ''}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr>
            {f.map((c, i) => (i ? <td class="num">{c}</td> : <th scope="row">{c}</th>))}
          </tr>
        ))}
      </tbody>
      {pie && (
        <tfoot>
          <tr>
            {pie.map((c, i) => (i ? <td class="num">{c}</td> : <th scope="row">{c}</th>))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}

/** Medidor (por ejemplo, gasto del día contra el tope): el relleno sube de tono al acercarse. */
export function Medidor({ valor, max, etiqueta }: { valor: number; max: number; etiqueta: string }) {
  const r = max > 0 ? Math.min(1, valor / max) : 1;
  const tono = r >= 1 ? 'lleno' : r >= 0.8 ? 'alto' : 'normal';
  return (
    <div class={`medidor m-${tono}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={valor} aria-label={etiqueta}>
      <span class="medidor-nivel" style={{ width: `${r * 100}%` }} />
    </div>
  );
}
