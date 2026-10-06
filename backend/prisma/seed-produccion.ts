/**
 * Seed de producción (D8 de `despliegue-continuo-ec2`, requisito "Datos iniciales y admin
 * propios de producción").
 *
 * - Carga el catálogo necesario para operar (configuración global, zonas, mesas y turnos),
 *   idempotente, igual que el seed de desarrollo.
 * - Crea el admin con `ADMIN_EMAIL` y `ADMIN_PASSWORD`, que en producción salen de los
 *   secretos de SSM Parameter Store (D6). Nunca con las credenciales del README.
 * - No crea reservas de ejemplo.
 *
 * Si el admin ya existe, no toca su contraseña: un despliegue nunca cambia credenciales sin
 * aviso. Rotarla es un procedimiento manual (ver docs/despliegue.md).
 *
 * En la imagen del backend se compila a `dist-seed/seed-produccion.js` (en runtime no hay
 * `ts-node`) y lo ejecuta `deploy/desplegar.sh` antes de levantar la versión nueva.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import {
  ADMIN_EMAIL_DESARROLLO,
  ADMIN_PASSWORD_DESARROLLO,
} from './admin-desarrollo';
import { seedCatalogo } from './catalogo';

const BCRYPT_SALT_ROUNDS = 10;

/** Largo mínimo de la contraseña de admin de producción (spec, "Contraseña de admin débil"). */
export const LARGO_MINIMO_PASSWORD_ADMIN = 16;

interface CredencialesAdmin {
  email: string;
  password: string;
}

/**
 * Valida las credenciales del admin antes de escribir nada en la base. Los mensajes nunca
 * incluyen la contraseña recibida: el error termina en los logs del despliegue.
 */
function validarCredenciales(
  entorno: Record<string, string | undefined>,
): CredencialesAdmin {
  const email = entorno.ADMIN_EMAIL?.trim();
  const password = entorno.ADMIN_PASSWORD;

  if (!email) {
    throw new Error(
      'Falta ADMIN_EMAIL: el seed de producción necesita el email del admin (secreto /reservas/prod/ADMIN_EMAIL).',
    );
  }
  if (!password) {
    throw new Error(
      'Falta ADMIN_PASSWORD: el seed de producción necesita la contraseña del admin (secreto /reservas/prod/ADMIN_PASSWORD).',
    );
  }
  // El email se compara sin distinguir mayúsculas: una variante de la dirección del README
  // sigue siendo la cuenta documentada públicamente.
  if (email.toLowerCase() === ADMIN_EMAIL_DESARROLLO.toLowerCase()) {
    throw new Error(
      'ADMIN_EMAIL coincide con el email del admin de desarrollo documentado en el README: usá una dirección propia de producción.',
    );
  }
  if (password === ADMIN_PASSWORD_DESARROLLO) {
    throw new Error(
      'ADMIN_PASSWORD coincide con la contraseña del admin de desarrollo documentada en el README: generá una contraseña propia de producción.',
    );
  }

  if (password.length < LARGO_MINIMO_PASSWORD_ADMIN) {
    throw new Error(
      `ADMIN_PASSWORD es demasiado corta: tiene que tener al menos ${LARGO_MINIMO_PASSWORD_ADMIN} caracteres.`,
    );
  }
  return { email, password };
}

/**
 * Carga los datos iniciales de producción. Exportada para los tests de integración
 * (`test/seed-produccion.integration-spec.ts`); en producción la llama `main()` con
 * `process.env`.
 */
export async function seedProduccion(
  prisma: PrismaClient,
  entorno: Record<string, string | undefined>,
  log: (mensaje: string) => void = console.log,
): Promise<void> {
  // Primero se valida: con credenciales inválidas no se escribe nada, ni el catálogo.
  const { email, password } = validarCredenciales(entorno);

  await seedCatalogo(prisma, log);

  log('Seed: usuario admin de producción...');
  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    log('El admin ya existe: no se modifica su contraseña.');
  } else {
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    await prisma.usuario.create({
      data: { email, passwordHash, rol: 'ADMIN' },
    });
    log('Admin creado.');
  }

  log('Seed de producción completado (sin reservas de ejemplo).');
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seedProduccion(prisma, process.env);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    // Solo el mensaje: los errores de validación no incluyen secretos, y así no se vuelca
    // ningún objeto con la configuración de conexión.
    const mensaje = error instanceof Error ? error.message : String(error);
    console.error(`Error en el seed de producción: ${mensaje}`);
    process.exitCode = 1;
  });
}
