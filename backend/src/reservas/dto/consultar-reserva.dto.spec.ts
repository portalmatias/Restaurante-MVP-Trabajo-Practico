import { validate } from 'class-validator';

import { ConsultarReservaDto } from './consultar-reserva.dto';

async function erroresDe(datos: Record<string, unknown>): Promise<string[]> {
  const dto = Object.assign(new ConsultarReservaDto(), datos);
  const errores = await validate(dto);
  return errores.flatMap((error) => Object.values(error.constraints ?? {}));
}

/**
 * Escenarios "Formato de la solicitud de consulta validado antes de buscar" de la spec
 * `reserva-consultar`: cada `400` sale de acá, antes de que el service busque nada.
 */
describe('ConsultarReservaDto', () => {
  const valido = { codigo: 'K7PM3QXA', email: 'ana.perez@example.com' };

  it('acepta un código de 8 caracteres y un email válido', async () => {
    expect(await erroresDe(valido)).toEqual([]);
  });

  it('acepta el código en minúsculas: la búsqueda no distingue mayúsculas', async () => {
    expect(await erroresDe({ ...valido, codigo: 'k7pm3qxa' })).toEqual([]);
  });

  it.each(['K7PM3QX', 'K7PM3QXAB', '', 'K7PM 3QX', 'K7PM-3QX', 'K7PM3QXÁ'])(
    'rechaza el código %p',
    async (codigo) => {
      const errores = await erroresDe({ ...valido, codigo });

      expect(errores).toContain('codigo debe ser alfanumérico de 8 caracteres');
    },
  );

  it.each(['no-es-un-email', 'ana@', '@example.com', 'ana perez@example.com'])(
    'rechaza el email %p',
    async (email) => {
      expect(await erroresDe({ ...valido, email })).toContain(
        'email debe ser un email válido',
      );
    },
  );

  it('rechaza un email de más de 254 caracteres', async () => {
    const email = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.com`;

    expect(email.length).toBeGreaterThan(254);
    expect(await erroresDe({ ...valido, email })).not.toEqual([]);
  });

  it('rechaza un body sin código y nombra el campo faltante', async () => {
    const errores = await erroresDe({ email: valido.email });

    expect(errores.length).toBeGreaterThan(0);
    expect(errores.every((mensaje) => mensaje.includes('codigo'))).toBe(true);
  });

  it('rechaza un body sin email y nombra el campo faltante', async () => {
    const errores = await erroresDe({ codigo: valido.codigo });

    expect(errores.length).toBeGreaterThan(0);
    expect(errores.every((mensaje) => mensaje.includes('email'))).toBe(true);
  });

  it('rechaza un código que no es un texto', async () => {
    expect(await erroresDe({ ...valido, codigo: 12345678 })).not.toEqual([]);
  });
});
