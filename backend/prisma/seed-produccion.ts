import { PrismaClient } from '@prisma/client';

export function seedProduccion(
  _prisma: PrismaClient,
  _entorno: Record<string, string | undefined>,
  _log: (mensaje: string) => void = console.log,
): Promise<void> {
  return Promise.reject(new Error('sin implementar'));
}
