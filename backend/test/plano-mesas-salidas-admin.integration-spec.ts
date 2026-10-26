import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { MesasModule } from '../src/mesas/mesas.module';
import { MesasService } from '../src/mesas/mesas.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ZonasModule } from '../src/zonas/zonas.module';
import { ZonasService } from '../src/zonas/zonas.service';
import { configurarZonasYConfiguracionDeSeed } from './support/zonas-seed-e2e';

/**
 * Tarea 2.8 de `plano-mesas` (design.md D1, "La salida sí hay que protegerla"): las columnas
 * del plano (`posX`, `posY`, `ancho`, `alto`, `forma`, `planoColumnas`, `planoFilas`) solo
 * salen por `GET /plano-mesas`. Las cinco salidas de admin que devolvían la fila de Prisma tal
 * cual tienen que seguir devolviendo exactamente las claves de `ZonaRespuestaDto` y
 * `MesaRespuestaDto` de `openapi/openapi.yaml`.
 *
 * Se prueba en el service porque los controllers devuelven su resultado sin transformarlo
 * (`ZonasController.listar`/`actualizar`, `MesasController.crear`/`listar`/`actualizar`).
 */
const CLAVES_ZONA = [
  'aforoMaximo',
  'anticipacionMaxDias',
  'anticipacionMinHoras',
  'id',
  'maxComensales',
  'minComensales',
  'nombre',
  'requiereConfirmacionAdmin',
  'ventanaCancelacionHoras',
];
const CLAVES_MESA = ['capacidad', 'etiqueta', 'id', 'zonaId'];

function claves(objeto: object): string[] {
  return Object.keys(objeto).sort();
}

describe('Salidas de admin de zonas y mesas sin las columnas del plano', () => {
  let prisma: PrismaService;
  let zonas: ZonasService;
  let mesas: MesasService;
  let zonaStandardId: string;
  const etiqueta = `TEST-SALIDAS-${process.pid}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['../.env', '.env'],
        }),
        PrismaModule,
        ZonasModule,
        MesasModule,
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    zonas = moduleRef.get(ZonasService);
    mesas = moduleRef.get(MesasService);
    await prisma.$connect();
    ({ zonaStandardId } = await configurarZonasYConfiguracionDeSeed(prisma));
  });

  afterAll(async () => {
    await prisma.mesa.deleteMany({
      where: { etiqueta: { startsWith: etiqueta } },
    });
    await prisma.$disconnect();
  });

  it('GET /admin/zonas: cada zona trae solo las claves de ZonaRespuestaDto', async () => {
    const lista = await zonas.listar();
    expect(lista.length).toBeGreaterThan(0);
    for (const zona of lista) {
      expect(claves(zona)).toEqual(CLAVES_ZONA);
    }
  });

  it('PATCH /admin/zonas/:id: la zona actualizada trae solo las claves de ZonaRespuestaDto', async () => {
    // Reescribe el valor que ya tiene: no cambia el estado que usan otras suites.
    const { aforoMaximo } = await prisma.zona.findUniqueOrThrow({
      where: { id: zonaStandardId },
    });
    const zona = await zonas.actualizar(zonaStandardId, { aforoMaximo });
    expect(claves(zona)).toEqual(CLAVES_ZONA);
  });

  it('POST, GET y PATCH /admin/mesas: cada mesa trae solo las claves de MesaRespuestaDto', async () => {
    const creada = await mesas.crear({
      zonaId: zonaStandardId,
      capacidad: 2,
      etiqueta,
    });
    expect(claves(creada)).toEqual(CLAVES_MESA);

    const lista = await mesas.listar(zonaStandardId);
    expect(lista.length).toBeGreaterThan(0);
    for (const mesa of lista) {
      expect(claves(mesa)).toEqual(CLAVES_MESA);
    }

    const actualizada = await mesas.actualizar(creada.id, { capacidad: 3 });
    expect(claves(actualizada)).toEqual(CLAVES_MESA);
  });
});
