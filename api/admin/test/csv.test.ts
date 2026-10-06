import { describe, test, expect } from 'vitest';
import { leerCsv, contactosDeCsv } from '../src/csv';

describe('CSV de contactos', () => {
  test('lee comillas, comillas escapadas y punto y coma', () => {
    expect(leerCsv('a;b\n"x;1";"dijo ""hola"""\n')).toEqual([['a', 'b'], ['x;1', 'dijo "hola"']]);
  });

  test('reconoce encabezados en español y servicios por nombre', () => {
    const filas = contactosDeCsv('﻿Correo,Nombre,Organización,Idioma,Intereses\nana@x.co,Ana,Acme,English,catering|Capacitación en IA\n');
    expect(filas).toEqual([{ email: 'ana@x.co', nombre: 'Ana', empresa: 'Acme', locale: 'en', intereses: ['catering', 'ia'] }]);
  });

  test('sin encabezado, la primera columna es el correo', () => {
    expect(contactosDeCsv('pedro@x.co,Pedro\r\n')).toEqual([{ email: 'pedro@x.co', nombre: 'Pedro', locale: 'es', intereses: [] }]);
  });

  test('ignora filas vacías', () => {
    expect(contactosDeCsv('email\n\n a@b.co \n,\n')).toEqual([{ email: 'a@b.co', locale: 'es', intereses: [] }]);
  });
});
