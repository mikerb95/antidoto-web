// Lectura de CSV para importar contactos. Funciones puras, con pruebas.
import { SERVICIOS as LISTA, type ServicioId } from '@api/dominio';
import { SERVICIOS } from './textos';

/** CSV con comillas y separador coma o punto y coma (Excel en español usa punto y coma). */
export function leerCsv(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, '');
  const primera = limpio.split(/\r?\n/, 1)[0] ?? '';
  const sep = (primera.match(/;/g) ?? []).length > (primera.match(/,/g) ?? []).length ? ';' : ',';
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const ch = limpio[i]!;
    if (comillas) {
      if (ch === '"' && limpio[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') comillas = false;
      else campo += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) {
      fila.push(campo);
      campo = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else campo += ch;
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((x) => x.trim()));
}

const COLUMNAS: Record<string, string> = {
  email: 'email', correo: 'email', 'correo electrónico': 'email', 'e-mail': 'email',
  nombre: 'nombre', name: 'nombre',
  empresa: 'empresa', organización: 'empresa', organizacion: 'empresa', company: 'empresa',
  idioma: 'locale', locale: 'locale', language: 'locale',
  intereses: 'intereses', interests: 'intereses',
};
const SERVICIO_POR_NOMBRE: Record<string, ServicioId> = Object.fromEntries(LISTA.flatMap((k) => [[k, k], [SERVICIOS[k].toLowerCase(), k]]));

export interface FilaImportar {
  email: string;
  nombre?: string;
  empresa?: string;
  locale: 'es' | 'en';
  intereses: ServicioId[];
}

export function contactosDeCsv(texto: string): FilaImportar[] {
  const filas = leerCsv(texto);
  if (!filas.length) return [];
  const cabeza = filas[0]!.map((x) => COLUMNAS[x.trim().toLowerCase()]);
  // Sin encabezado reconocible: la primera columna es el correo.
  const conCabeza = cabeza.includes('email');
  const mapa = conCabeza ? cabeza : ['email', 'nombre', 'empresa', 'locale', 'intereses'];
  return (conCabeza ? filas.slice(1) : filas).map((f) => {
    const o: Record<string, string> = {};
    mapa.forEach((k, i) => k && (o[k] = (f[i] ?? '').trim()));
    return {
      email: o.email ?? '',
      ...(o.nombre ? { nombre: o.nombre } : {}),
      ...(o.empresa ? { empresa: o.empresa } : {}),
      locale: /^en/i.test(o.locale ?? '') ? 'en' : 'es',
      intereses: (o.intereses ?? '')
        .split(/[|,]/)
        .map((x) => SERVICIO_POR_NOMBRE[x.trim().toLowerCase()])
        .filter((x): x is ServicioId => !!x),
    };
  });
}
