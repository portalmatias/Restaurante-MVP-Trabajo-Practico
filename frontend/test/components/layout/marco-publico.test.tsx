import { render, screen } from '@testing-library/react';
import { MarcoPublico } from '../../../src/components/layout/marco-publico';

let ruta = '/';
jest.mock('next/navigation', () => ({ usePathname: () => ruta }));

describe('MarcoPublico', () => {
  it('en una página pública muestra el encabezado, el contenido y el pie', () => {
    ruta = '/reservas';
    render(<MarcoPublico>contenido</MarcoPublico>);

    expect(
      screen.getByRole('navigation', { name: 'Navegación principal' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('contenido');
    expect(screen.getByText(/restaurante ficticio/i)).toBeInTheDocument();
  });

  it.each(['/admin', '/admin/login', '/admin/reservas'])(
    'en %s no muestra el encabezado ni el pie públicos',
    (rutaAdmin) => {
      ruta = rutaAdmin;
      render(<MarcoPublico>panel</MarcoPublico>);

      expect(
        screen.queryByRole('navigation', { name: 'Navegación principal' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/restaurante ficticio/i),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('main')).toHaveTextContent('panel');
    },
  );

  it('una ruta que solo empieza parecido a /admin sigue siendo pública', () => {
    ruta = '/administracion-de-menus';
    render(<MarcoPublico>contenido</MarcoPublico>);

    expect(
      screen.getByRole('navigation', { name: 'Navegación principal' }),
    ).toBeInTheDocument();
  });
});
