import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * UUIDs bien formados que no existen en la base: sirven para los 404 de turno/zona (y para el
 * 400 de `disponibilidad`, que usa `ZONA_UUID_INEXISTENTE` como valor por defecto de su
 * query). Compartidos entre `disponibilidad.e2e-spec.ts` y `reservas-crear.e2e-spec.ts`
 * (cubic, PR #40, hallazgo P3: antes estaban copiados literales en los dos archivos).
 */
export const TURNO_UUID_INEXISTENTE = '3f1c2a9e-5b7d-4e8a-9c21-6d4b0f8e1a73';
export const ZONA_UUID_INEXISTENTE = 'b8e4d7c2-1a6f-4c3b-8e95-2f7a0d6c4b19';

/**
 * Deja las Zonas STANDARD/VIP y la fila única de `ConfiguracionNegocio` con los valores del
 * seed (`backend/prisma/seed.ts`), sin importar qué haya corrido antes: la suite que llama
 * deja la base como la encontró. Se usa `upsert` porque `NombreZona` es un enum de dos
 * valores fijos, así que ningún test puede crear una zona propia.
 *
 * Compartido entre `disponibilidad.e2e-spec.ts` y `reservas-crear.e2e-spec.ts`, que necesitan
 * exactamente los mismos valores en su `beforeAll` (cubic, PR #40, hallazgo P3: antes estaba
 * copiado literal en los dos archivos).
 */
export async function configurarZonasYConfiguracionDeSeed(
  prisma: PrismaService,
): Promise<{ zonaStandardId: string; zonaVipId: string }> {
  const standard = await prisma.zona.upsert({
    where: { nombre: 'STANDARD' },
    update: {
      minComensales: 1,
      maxComensales: 8,
      anticipacionMinHoras: 2,
      anticipacionMaxDias: 30,
      ventanaCancelacionHoras: 2,
      requiereConfirmacionAdmin: false,
      aforoMaximo: 40,
    },
    create: {
      nombre: 'STANDARD',
      minComensales: 1,
      maxComensales: 8,
      anticipacionMinHoras: 2,
      anticipacionMaxDias: 30,
      ventanaCancelacionHoras: 2,
      requiereConfirmacionAdmin: false,
      aforoMaximo: 40,
    },
  });
  const vip = await prisma.zona.upsert({
    where: { nombre: 'VIP' },
    update: {
      minComensales: 2,
      maxComensales: 12,
      anticipacionMinHoras: 24,
      anticipacionMaxDias: 60,
      ventanaCancelacionHoras: 24,
      requiereConfirmacionAdmin: true,
      aforoMaximo: 20,
    },
    create: {
      nombre: 'VIP',
      minComensales: 2,
      maxComensales: 12,
      anticipacionMinHoras: 24,
      anticipacionMaxDias: 60,
      ventanaCancelacionHoras: 24,
      requiereConfirmacionAdmin: true,
      aforoMaximo: 20,
    },
  });

  await prisma.configuracionNegocio.upsert({
    where: { id: 1 },
    update: { aforoGlobal: 60 },
    create: { id: 1, aforoGlobal: 60 },
  });

  return { zonaStandardId: standard.id, zonaVipId: vip.id };
}
