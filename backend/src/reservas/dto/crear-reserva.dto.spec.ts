import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CrearReservaDto } from './crear-reserva.dto';

/**
 * El `ValidationPipe` global (`transform: true`) arma el DTO con `plainToInstance`, así que el
 * `@Transform` de `notaCliente` corre antes de validar. El test lo hace igual.
 */
async function validar(datos: Record<string, unknown>) {
  const dto = plainToInstance(CrearReservaDto, datos);
  const errores = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return {
    dto,
    errores: errores.flatMap((error) => Object.values(error.constraints ?? {})),
  };
}

/**
 * Nota del cliente en `POST /reservas` (spec `reservas-crear`, "Nota del cliente" y
 * "Validación del body"; design.md D2 de `reserva-nota-cliente`).
 */
describe('CrearReservaDto: notaCliente', () => {
  const valido = {
    fecha: '2026-09-19',
    turnoId: '3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73',
    zonaId: 'b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19',
    comensales: 4,
    nombreCliente: 'Ana Pérez',
    emailCliente: 'ana.perez@example.com',
    telefonoCliente: '+54 9 11 5555-1234',
  };
  const MENSAJE_LARGO = 'notaCliente puede tener hasta 500 caracteres';

  it('acepta un pedido sin notaCliente', async () => {
    const { dto, errores } = await validar(valido);

    expect(errores).toEqual([]);
    expect(dto.notaCliente).toBeUndefined();
  });

  it('acepta notaCliente en null', async () => {
    const { errores } = await validar({ ...valido, notaCliente: null });

    expect(errores).toEqual([]);
  });

  it('quita los espacios de los bordes y conserva los saltos de línea', async () => {
    const { dto, errores } = await validar({
      ...valido,
      notaCliente: '  Uno es celíaco.\nLlegamos 20:15.  ',
    });

    expect(errores).toEqual([]);
    expect(dto.notaCliente).toBe('Uno es celíaco.\nLlegamos 20:15.');
  });

  it.each(['', '   ', '\n\t '])(
    'deja una nota vacía o de solo espacios (%p) como sin nota',
    async (notaCliente) => {
      const { dto, errores } = await validar({ ...valido, notaCliente });

      expect(errores).toEqual([]);
      expect(dto.notaCliente).toBeUndefined();
    },
  );

  it('acepta una nota de 500 caracteres', async () => {
    const { errores } = await validar({
      ...valido,
      notaCliente: 'a'.repeat(500),
    });

    expect(errores).toEqual([]);
  });

  it('rechaza una nota de 501 caracteres', async () => {
    const { errores } = await validar({
      ...valido,
      notaCliente: 'a'.repeat(501),
    });

    expect(errores).toEqual([MENSAJE_LARGO]);
  });

  it('no cuenta los espacios de los bordes para el límite', async () => {
    const { dto, errores } = await validar({
      ...valido,
      notaCliente: `  ${'a'.repeat(500)}  `,
    });

    expect(errores).toEqual([]);
    expect(dto.notaCliente).toHaveLength(500);
  });

  it('cuenta un emoji simple como un carácter: 499 letras y "🎂" se aceptan', async () => {
    const { errores } = await validar({
      ...valido,
      notaCliente: `${'a'.repeat(499)}🎂`,
    });

    expect(errores).toEqual([]);
  });

  it('cuenta un emoji con selector de variación como dos: 499 letras y "❤️" se rechazan', async () => {
    const { errores } = await validar({
      ...valido,
      notaCliente: `${'a'.repeat(499)}❤️`,
    });

    expect(errores).toEqual([MENSAJE_LARGO]);
  });

  it('rechaza una nota que no es texto', async () => {
    const { errores } = await validar({ ...valido, notaCliente: 42 });

    expect(errores).toContain('notaCliente debe ser un texto');
  });
});
