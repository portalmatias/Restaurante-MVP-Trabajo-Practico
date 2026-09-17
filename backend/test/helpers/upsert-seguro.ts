import { Prisma } from '@prisma/client';

/**
 * `upsert` no es atómico contra OTRO proceso haciendo lo mismo: Jest corre cada
 * `*.integration-spec.ts` en su propio worker, y varios archivos hacen su propio `upsert`
 * de las mismas Zonas STANDARD/VIP en su `beforeAll` (son efectivamente singleton: el
 * enum `NombreZona` solo tiene esos dos valores). Si dos procesos ven la fila como
 * inexistente al mismo tiempo, ambos intentan `create` y uno choca contra el `@unique` de
 * `nombre` con `P2002` — no es una condición hipotética, se reprodujo corriendo
 * `npm run test:integration -w backend` en la práctica.
 *
 * En vez de fallar, ante un `P2002` se aplican los valores deseados con un `update` (no
 * un simple re-fetch): así el archivo que pierde la carrera de creación igual termina con
 * la configuración que sus propios tests esperan, sin importar cuál de los dos procesos
 * ganó el `create`.
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
