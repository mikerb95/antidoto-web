import { describe, test, expect } from 'vitest';
import { rutaDeHashViejo } from '../src/ruteo';
import { hace, dispositivo } from '../src/formato';

describe('enlaces viejos de la bandeja', () => {
  test('llevan a las rutas nuevas', () => {
    expect(rutaDeHashViejo('#00000000-0000-4000-8000-000000000001')).toBe('/admin/solicitudes/00000000-0000-4000-8000-000000000001');
    expect(rutaDeHashViejo('#campana-nueva')).toBe('/admin/campanas/nueva');
    expect(rutaDeHashViejo('#contacto-abc')).toBe('/admin/contactos/abc');
    expect(rutaDeHashViejo('#automatico-bienvenida:es')).toBe('/admin/automaticos/bienvenida:es');
    expect(rutaDeHashViejo('#leads')).toBe('/admin/solicitudes');
    expect(rutaDeHashViejo('')).toBe(null);
    expect(rutaDeHashViejo('#t=abc')).toBe(null);
  });
});

describe('formato', () => {
  test('hace', () => {
    const t = Date.UTC(2026, 9, 6, 12);
    expect(hace(t - 30_000, t)).toBe('ahora');
    expect(hace(t - 5 * 60_000, t)).toBe('hace 5 min');
    expect(hace(t - 3 * 3_600_000, t)).toBe('hace 3 h');
    expect(hace(t - 2 * 86_400_000, t)).toBe('hace 2 d');
  });
  test('dispositivo', () => {
    expect(dispositivo('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604')).toBe('Safari en iOS');
    expect(dispositivo('Mozilla/5.0 (Windows NT 10.0) Chrome/140 Edg/140')).toBe('Edge en Windows');
    expect(dispositivo(null)).toBe('Navegador desconocido');
  });
});
