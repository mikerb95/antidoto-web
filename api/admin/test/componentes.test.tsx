import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { Chips, Datos, Insignia, Pestanas, Paginacion } from '../src/ui/base';
import { Barras, Columnas } from '../src/ui/graficas';

afterEach(cleanup);

describe('componentes', () => {
  test('los chips marcan el elegido con aria-pressed y avisan el cambio', () => {
    const alCambiar = vi.fn();
    const { getByRole } = render(<Chips etiqueta="Estado" valor="" alCambiar={alCambiar} opciones={[{ valor: '', texto: 'Todas' }, { valor: 'nuevo', texto: 'Nuevo', n: 3 }]} />);
    expect(getByRole('button', { name: 'Todas' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(getByRole('button', { name: /Nuevo/ }));
    expect(alCambiar).toHaveBeenCalledWith('nuevo');
  });

  test('las pestañas se mueven con las flechas', () => {
    const alCambiar = vi.fn();
    const { getAllByRole } = render(<Pestanas etiqueta="Idioma" valor="es" alCambiar={alCambiar} opciones={[{ valor: 'es', texto: 'Español' }, { valor: 'en', texto: 'Inglés' }]} />);
    const [es] = getAllByRole('tab');
    expect(es!.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(es!, { key: 'ArrowRight' });
    expect(alCambiar).toHaveBeenCalledWith('en');
  });

  test('Datos omite los vacíos', () => {
    const { container } = render(<Datos filas={[['Correo', 'a@b.co'], ['Ciudad', null], ['Notas', '']]} />);
    expect(container.querySelectorAll('dt')).toHaveLength(1);
  });

  test('la insignia lleva texto, no solo color', () => {
    const { container } = render(<Insignia tono="exito">Ganado</Insignia>);
    expect(container.textContent).toBe('Ganado');
  });

  test('la paginación desactiva lo que no aplica', () => {
    const { getByRole } = render(<Paginacion total={120} pagina={0} porPagina={50} alCambiar={() => {}} />);
    expect((getByRole('button', { name: 'Anteriores' }) as HTMLButtonElement).disabled).toBe(true);
    expect((getByRole('button', { name: 'Siguientes' }) as HTMLButtonElement).disabled).toBe(false);
  });

  test('las gráficas tienen sus valores sin depender del color ni del tooltip', () => {
    const { container } = render(<Barras filas={[{ etiqueta: 'Nuevo', n: 3 }]} />);
    expect(container.textContent).toContain('Nuevo');
    expect(container.textContent).toContain('3');
    const c = render(<Columnas titulo="Altas" puntos={[{ etiqueta: 'sem 1', n: 2 }, { etiqueta: 'sem 2', n: 5 }]} />);
    expect(c.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['sem 1: 2', 'sem 2: 5']);
    expect(c.container.querySelector('table')?.textContent).toContain('7');
  });
});
