import { describe, expect, test } from 'vitest';
import sharp from 'sharp';
import { imagenOg, tamanoTitulo, OG_ANCHO, OG_ALTO } from '../src/lib/og';
import { ogRuta } from '../src/lib/og-rutas';

describe('imagen para compartir', () => {
  test('la ruta depende del tipo, la clave y el idioma', () => {
    expect(ogRuta('oferta', 'emergencias', 'en')).toBe('/og/en/oferta-emergencias.jpg');
  });
  test('los títulos largos bajan de tamaño', () => {
    expect(tamanoTitulo('Desayunos')).toBeGreaterThan(tamanoTitulo('Diseño de productos y experiencias'));
    expect(tamanoTitulo('Claude y ChatGPT para redactar y analizar')).toBeGreaterThanOrEqual(48);
  });
  test('sale un JPEG de 1200 x 630 y liviano', async () => {
    const jpeg = await imagenOg({ kicker: 'Producción audiovisual', titulo: 'Planes de emergencia', foto: 'src/assets/fotos/grabacion.jpg', dominio: 'antidotocolombia.com' });
    const meta = await sharp(jpeg).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', OG_ANCHO, OG_ALTO]);
    expect(jpeg.length).toBeLessThan(200 * 1024);
  });
});
