// Contenido del sitio desde el panel: borradores, publicación en los dos idiomas, copia publicada
// aparte, historial, imágenes en R2, permisos y el pedido de publicar el sitio.
import { describe, test, expect, beforeAll } from 'vitest';
import { prepararPruebas } from './ayudas';
import { validarContenido } from '../src/contenido/esquemas';
import { leerImagen } from '../src/archivos';

let despachos: { url: string; body: unknown }[] = [];
const p = prepararPruebas((url, init) => {
  if (url.startsWith('https://api.github.com/')) {
    despachos.push({ url, body: JSON.parse(String(init?.body)) });
    return new Response(null, { status: 204 });
  }
  return null;
});

// PNG de 2x3 px: firma y bloque IHDR bastan para leer el tamaño.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 2, 0, 0, 0, 3, 8, 6, 0, 0, 0, 0, 0, 0, 0]);

let contenidoCk = '';
let comercialCk = '';
let adminCk = '';
beforeAll(async () => {
  contenidoCk = await p.entrarComo('laura@antidoto.co', 'contenido');
  comercialCk = await p.entrarComo('camilo@antidoto.co', 'comercial');
  adminCk = await p.entrarComo('maria@antidoto.co', 'admin');
});

const enviar = (ck: string, ruta: string, metodo: string, cuerpo?: unknown) => p.conSesion(ck, ruta, { method: metodo, ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}) });
async function subir(ck: string, bytes: Uint8Array, nombre = 'foto.png', tipo = 'image/png') {
  const form = new FormData();
  form.append('archivo', new File([bytes], nombre, { type: tipo }));
  return p.llamar('/admin/api/medios', { method: 'POST', body: form, headers: { origin: 'https://api.test', cookie: ck } });
}

describe('esquemas', () => {
  test('un borrador puede ir incompleto; publicar exige todo en los dos idiomas', () => {
    expect(validarContenido('faq', { clave: 'horarios', datos: { tema: 'general' }, textos: { es: { pregunta: '¿Horario?' } } }).ok).toBe(true);
    const r = validarContenido('faq', { clave: 'horarios', datos: { tema: 'general' }, textos: { es: { pregunta: '¿Horario?', respuesta: 'De 8 a 5.' } } }, true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores).sort()).toEqual(['en.pregunta', 'en.respuesta']);
  });
  test('formato: clave, slug, fecha y opciones', () => {
    const r = validarContenido('blog', { clave: 'Mal Clave', datos: { fecha: '2026-13-45', categoria: 'otra' }, textos: { es: { slug: 'Con Espacios' } } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores).sort()).toEqual(['clave', 'datos.categoria', 'datos.fecha', 'es.slug']);
  });
  test('los clientes no se traducen', () => {
    expect(validarContenido('cliente', { clave: 'acme', datos: { nombre: 'Acme', sector: 'otros', logo: '00000000-0000-4000-8000-000000000001' } }, true).ok).toBe(true);
  });
});

describe('imágenes', () => {
  test('lee el tamaño de PNG y rechaza lo que no es imagen', () => {
    expect(leerImagen(PNG)).toEqual({ mime: 'image/png', ancho: 2, alto: 3 });
    expect(leerImagen(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe(null);
  });

  test('sube a R2, rechaza SVG y no deja borrar una imagen en uso', async () => {
    const r = await subir(contenidoCk, PNG);
    expect(r.status).toBe(201);
    const { medio } = (await r.json()) as { medio: { id: string; ancho: number; url: string } };
    expect(medio.ancho).toBe(2);
    const servida = await p.llamar(medio.url);
    expect(servida.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await servida.arrayBuffer())).toEqual(PNG);

    expect((await subir(contenidoCk, new TextEncoder().encode('<svg onload="alert(1)"/>'), 'x.svg', 'image/svg+xml')).status).toBe(422);
    expect((await subir(comercialCk, PNG)).status).toBe(403);

    await enviar(contenidoCk, '/admin/api/contenido', 'POST', { tipo: 'cliente', clave: 'acme', datos: { nombre: 'Acme', sector: 'otros', logo: medio.id } });
    expect((await enviar(contenidoCk, `/admin/api/medios/${medio.id}`, 'DELETE')).status).toBe(409);
  });
});

describe('ciclo de una entrada', () => {
  let id = '';
  const faq = (respuesta: string) => ({
    tipo: 'faq',
    clave: 'horarios',
    datos: { tema: 'general', destacada: false },
    textos: { es: { pregunta: '¿En qué horario atienden?', respuesta }, en: { pregunta: 'What are your hours?', respuesta: 'Monday to Friday.' } },
  });

  test('comercial no edita contenido; contenido sí', async () => {
    expect((await enviar(comercialCk, '/admin/api/contenido', 'POST', faq('x'))).status).toBe(403);
    const r = await enviar(contenidoCk, '/admin/api/contenido', 'POST', { ...faq('De lunes a viernes.'), textos: { es: { pregunta: '¿En qué horario atienden?' } } });
    expect(r.status).toBe(200);
    id = ((await r.json()) as { entrada: { id: string; estado: string } }).entrada.id;
    expect((await enviar(contenidoCk, '/admin/api/contenido', 'POST', faq('Otra'))).status).toBe(409);
  });

  test('publicar exige los dos idiomas; el borrador no sale en /v1/contenido', async () => {
    const r = await enviar(contenidoCk, `/admin/api/contenido/${id}/publicar`, 'POST');
    expect(r.status).toBe(422);
    const pub = (await (await p.llamar('/v1/contenido?tipo=faq')).json()) as { entradas: unknown[] };
    expect(pub.entradas).toHaveLength(0);
  });

  test('publicada, cambios sin publicar y versión que choca', async () => {
    await enviar(contenidoCk, `/admin/api/contenido/${id}`, 'PUT', { ...faq('De lunes a viernes.'), version: 1 });
    const r = await enviar(contenidoCk, `/admin/api/contenido/${id}/publicar`, 'POST');
    expect(((await r.json()) as { entrada: { estado: string } }).entrada.estado).toBe('publicado');

    await enviar(contenidoCk, `/admin/api/contenido/${id}`, 'PUT', { ...faq('Todos los días.'), version: 2 });
    const det = (await (await p.llamar(`/admin/api/contenido/${id}`, { headers: { cookie: contenidoCk } })).json()) as { entrada: { estado: string }; versiones: { version: number }[] };
    expect(det.entrada.estado).toBe('cambios');
    expect(det.versiones.map((v) => v.version)).toEqual([2, 1]);

    // El sitio sigue viendo lo publicado, no la copia de trabajo.
    const pub = (await (await p.llamar('/v1/contenido?tipo=faq')).json()) as { entradas: { textos: { es: { respuesta: string } } }[] };
    expect(pub.entradas[0]!.textos.es.respuesta).toBe('De lunes a viernes.');

    expect((await enviar(contenidoCk, `/admin/api/contenido/${id}`, 'PUT', { ...faq('Choca'), version: 1 })).status).toBe(409);
  });

  test('restaurar una versión y archivar la saca del sitio', async () => {
    const r = await enviar(contenidoCk, `/admin/api/contenido/${id}/restaurar/2`, 'POST');
    const d = (await r.json()) as { entrada: { textos: { es: { respuesta: string } }; version: number } };
    expect(d.entrada.textos.es.respuesta).toBe('De lunes a viernes.');
    await enviar(contenidoCk, `/admin/api/contenido/${id}/archivar`, 'POST');
    expect(((await (await p.llamar('/v1/contenido?tipo=faq')).json()) as { entradas: unknown[] }).entradas).toHaveLength(0);
    expect((await enviar(contenidoCk, `/admin/api/contenido/${id}`, 'DELETE')).status).toBe(409);
    expect(await p.env.DB.prepare("select count(*) as n from auditoria where accion like 'contenido.%' and entidad_id = ?").bind(id).first<number>('n')).toBeGreaterThanOrEqual(5);
  });

  test('dos entradas publicadas no pueden usar la misma dirección', async () => {
    const r = await subir(contenidoCk, PNG);
    const img = ((await r.json()) as { medio: { id: string } }).medio.id;
    const art = (clave: string) => ({
      tipo: 'blog',
      clave,
      datos: { fecha: '2026-10-01', categoria: 'formacion', lineas: ['formaciones'], autor: 'Equipo', imagen: img },
      textos: {
        es: { title: 'Jugar para aprender', slug: 'jugar-para-aprender', lead: 'Por qué funciona.', alt: 'Un equipo jugando', cuerpo: '## Hola\n\nTexto.' },
        en: { title: 'Play to learn', slug: 'play-to-learn', lead: 'Why it works.', alt: 'A team playing', cuerpo: '## Hi\n\nText.' },
      },
    });
    const a = ((await (await enviar(contenidoCk, '/admin/api/contenido', 'POST', art('jugar'))).json()) as { entrada: { id: string } }).entrada.id;
    expect((await enviar(contenidoCk, `/admin/api/contenido/${a}/publicar`, 'POST')).status).toBe(200);
    const b = ((await (await enviar(contenidoCk, '/admin/api/contenido', 'POST', art('jugar-2'))).json()) as { entrada: { id: string } }).entrada.id;
    const r2 = await enviar(contenidoCk, `/admin/api/contenido/${b}/publicar`, 'POST');
    expect(r2.status).toBe(422);
    expect(((await r2.json()) as { errores: Record<string, string> }).errores).toHaveProperty('es.slug');

    const pub = (await (await p.llamar('/v1/contenido?tipo=blog')).json()) as { entradas: { clave: string }[]; medios: Record<string, { url: string; ancho: number }> };
    expect(pub.entradas.map((e) => e.clave)).toEqual(['jugar']);
    expect(pub.medios[img]).toMatchObject({ url: `https://api.test/v1/medios/${img}`, ancho: 2 });
  });
});

describe('publicar el sitio', () => {
  test('sin token queda sin configurar', async () => {
    const r = await enviar(contenidoCk, '/admin/api/publicar', 'POST', { destino: 'vista_previa' });
    expect(r.status).toBe(503);
    expect(despachos).toHaveLength(0);
  });

  test('con token dispara el workflow una sola vez por tanda; producción solo admin', async () => {
    await p.env.DB.exec('DELETE FROM publicaciones;');
    p.env.GITHUB_DISPATCH_TOKEN = 'ghp_prueba';
    p.env.GITHUB_REPO = 'dueno/antidoto-web';
    const r = await enviar(contenidoCk, '/admin/api/publicar', 'POST', { destino: 'vista_previa' });
    expect(((await r.json()) as { publicacion: { estado: string } }).publicacion.estado).toBe('disparada');
    const otra = await enviar(contenidoCk, '/admin/api/publicar', 'POST', { destino: 'vista_previa' });
    expect(((await otra.json()) as { agrupada: boolean }).agrupada).toBe(true);
    expect(despachos).toHaveLength(1);
    expect(despachos[0]).toMatchObject({ url: 'https://api.github.com/repos/dueno/antidoto-web/actions/workflows/preview.yml/dispatches', body: { ref: 'main' } });

    expect((await enviar(contenidoCk, '/admin/api/publicar', 'POST', { destino: 'produccion' })).status).toBe(403);
    expect((await enviar(adminCk, '/admin/api/publicar', 'POST', { destino: 'produccion' })).status).toBe(200);
    expect(despachos.at(-1)!.url).toContain('/deploy.yml/');
  });

  test('ajustes del sitio para el build', async () => {
    await enviar(adminCk, '/admin/api/configuracion', 'PUT', { 'sitio.video_hero': { mp4: '/video/hero.mp4' } });
    expect((await enviar(adminCk, '/admin/api/configuracion', 'PUT', { 'sitio.video_hero': { mp4: 'javascript:alert(1)' } })).status).toBe(422);
    const a = (await (await p.llamar('/v1/ajustes')).json()) as { videoHero: unknown; regaloNovedades: unknown };
    expect(a).toEqual({ videoHero: { mp4: '/video/hero.mp4' }, regaloNovedades: null });
  });
});

describe('el asesor ve lo publicado en el panel', () => {
  test('suma preguntas y clientes, y una pregunta del panel pisa a la del sitio con la misma clave', async () => {
    const { conocimiento } = await import('../src/asesor/conocimiento');
    const { FAQ_PUBLICA } = await import('../src/asesor/publico.gen');
    const clave = FAQ_PUBLICA[0]!.clave;
    const texto = conocimiento('es', {
      faq: [
        { clave: 'horario-panel', es: ['¿Atienden sábados?', 'Sí, con cita.'], en: ['Saturdays?', 'Yes, by appointment.'] },
        { clave, es: ['Pregunta reemplazada', 'Respuesta nueva del panel.'], en: ['Replaced', 'New answer.'] },
      ],
      clientes: ['Acme Andina'],
    });
    expect(texto).toContain('¿Atienden sábados? Sí, con cita.');
    expect(texto).toContain('Acme Andina');
    expect(texto).toContain('Respuesta nueva del panel.');
    expect(texto).not.toContain(FAQ_PUBLICA[0]!.es[0]);
  });
});
