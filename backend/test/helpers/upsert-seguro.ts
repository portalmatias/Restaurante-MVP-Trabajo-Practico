import { Prisma } from '@prisma/client';

/**
 * `upsert` no es atómico contra OTRO proceso haciendo lo mismo: varios archivos hacen su
 * propio `upsert` de las mismas Zonas STANDARD/VIP en su `beforeAll` (son efectivamente
 * singleton: el enum `NombreZona` solo tiene esos dos valores). Si dos procesos ven la fila
 * como inexistente al mismo tiempo, ambos intentan `create` y uno choca contra el `@unique`
 * de `nombre` con `P2002` — se reprodujo corriendo `npm run test:integration -w backend` en
 * la práctica, cuando Jest corría cada `*.integration-spec.ts` en su propio worker.
 *
 * **`jest-integration.json` fija `maxWorkers: 1`** (ver su comentario): dentro de una
 * corrida normal de `npm run test:integration`, los archivos ya no corren en paralelo, así
 * que esta carrera puntual no puede dispararse — cada `beforeAll` termina antes de que
 * empiece el siguiente. El helper queda como defensa para los casos que `maxWorkers: 1` no
 * cubre: dos invocaciones de `test:integration` corriendo a la vez contra la misma base
 * (ya documentado como no soportado en `gestion-salon/tasks.md` — usar bases separadas), o
 * correr un archivo suelto con otra configuración de Jest que sí paralelice. Costo cero,
 * así que se mantiene en vez de retirarlo.
 *
 * Ante un `P2002` se aplican los valores deseados con un `update` (no un simple re-fetch):
 * así el archivo que pierde la carrera de creación igual termina con la configuración que
 * sus propios tests esperan, sin importar cuál de los dos procesos ganó el `create`.
 */
export async function upsertSeguro<T>(
  intentoDeUpsert: () => Promise<T>,
  aplicarValoresSiYaExiste: () => Promise<T>,
): Promise<T> {
  try {
    return await intentoDeUpsert();
  } catch (error) {
    const esColisionDeUnico =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002';
    if (!esColisionDeUnico) {
      throw error;
    }
    return aplicarValoresSiYaExiste();
  }
}
