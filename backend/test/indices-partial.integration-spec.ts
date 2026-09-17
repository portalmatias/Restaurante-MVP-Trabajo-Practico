import { Test } from '@nestjs/testing';

import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Hallazgo de review del PR #12 (todavía sin resolver al momento de escribir este test):
 * la garantía real del invariante 1 (no dos Reservas activas para la misma
 * mesa+turno+fecha) es el índice único PARCIAL `Reserva_mesaId_turnoId_fecha_key`, editado
 * a mano en `backend/prisma/migrations/20260914234727_init_modelo_dominio/migration.sql`
 * (con una cláusula `WHERE "estado" IN ('PENDIENTE', 'CONFIRMADA')`) — NO el
 * `@@unique([mesaId, turnoId, fecha])` sin condición que ve Prisma (el DSL no soporta
 * `WHERE` en índices únicos, ver comentario al inicio de `schema.prisma`).
 *
 * El riesgo: si alguien corre `prisma migrate dev` de nuevo sin revisar el diff, Prisma
 * puede detectar esto como "drift" e intentar "reparar" el índice reemplazándolo por uno
 * NO parcial (a partir del `@@unique` del schema), rompiendo en silencio la garantía a
 * nivel de base de datos (una Reserva CANCELADA volvería a bloquear la combinación).
 *
 * Este test consulta directamente el catálogo de Postgres (no un mock de Prisma) para
 * confirmar que el índice sigue existiendo y sigue siendo parcial. Si alguna vez el índice
 * es reemplazado por uno sin `WHERE`, este test debe fallar.
 */
describe('Índice único parcial de Reserva — guard contra drift de Prisma', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('existe y sigue siendo un índice único PARCIAL (con predicado WHERE)', async () => {
    // Consulta directa contra pg_index/pg_class/pg_namespace: indpred IS NOT NULL es la
    // señal real (a nivel de catálogo) de que el índice tiene una condición WHERE, en vez
    // de parsear el texto de `indexdef` con una regex.
    const filas = await prisma.$queryRaw<
      Array<{
        indexrelid: bigint;
        indpred: string | null;
        indisunique: boolean;
      }>
    >`
      SELECT
        i.indexrelid,
        pg_get_expr(i.indpred, i.indrelid) AS "indpred",
        i.indisunique
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'Reserva_mesaId_turnoId_fecha_key'
        AND n.nspname = 'public';
    `;

    expect(filas).toHaveLength(1);

    const [indice] = filas;
    expect(indice.indisunique).toBe(true);
    expect(indice.indpred).not.toBeNull();

    // Verificación adicional legible (evidencia textual) sobre el mismo índice: el DDL
    // reconstruido por Postgres debe seguir mostrando la cláusula WHERE por estado activo.
    const porIndexdef = await prisma.$queryRaw<Array<{ indexdef: string }>>`
      SELECT indexdef FROM pg_indexes WHERE indexname = 'Reserva_mesaId_turnoId_fecha_key';
    `;

    expect(porIndexdef).toHaveLength(1);
    expect(porIndexdef[0].indexdef).toContain('WHERE');
    expect(porIndexdef[0].indexdef).toContain('PENDIENTE');
    expect(porIndexdef[0].indexdef).toContain('CONFIRMADA');
  });
});
