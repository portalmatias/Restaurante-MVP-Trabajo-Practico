-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "NombreZona" AS ENUM ('STANDARD', 'VIP');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zona" (
    "id" TEXT NOT NULL,
    "nombre" "NombreZona" NOT NULL,
    "minComensales" INTEGER NOT NULL,
    "maxComensales" INTEGER NOT NULL,
    "anticipacionMinHoras" INTEGER NOT NULL,
    "anticipacionMaxDias" INTEGER NOT NULL,
    "ventanaCancelacionHoras" INTEGER NOT NULL,
    "requiereConfirmacionAdmin" BOOLEAN NOT NULL DEFAULT false,
    "aforoMaximo" INTEGER NOT NULL,

    CONSTRAINT "Zona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mesa" (
    "id" TEXT NOT NULL,
    "zonaId" TEXT NOT NULL,
    "capacidad" INTEGER NOT NULL,
    "etiqueta" TEXT NOT NULL,

    CONSTRAINT "Mesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turno" (
    "id" TEXT NOT NULL,
    "diaSemana" "DiaSemana" NOT NULL,
    "horaInicio" TIME NOT NULL,
    "horaFin" TIME NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" TEXT NOT NULL,
    "mesaId" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "comensales" INTEGER NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'PENDIENTE',
    "nombreCliente" TEXT NOT NULL,
    "emailCliente" TEXT NOT NULL,
    "telefonoCliente" TEXT NOT NULL,
    "codigoReserva" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionNegocio" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "aforoGlobal" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionNegocio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Zona_nombre_key" ON "Zona"("nombre");

-- CreateIndex
CREATE INDEX "Mesa_zonaId_idx" ON "Mesa"("zonaId");

-- CreateIndex
CREATE UNIQUE INDEX "Turno_diaSemana_horaInicio_key" ON "Turno"("diaSemana", "horaInicio");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_codigoReserva_key" ON "Reserva"("codigoReserva");

-- CreateIndex
-- ============================================================================
-- EDICIÓN MANUAL (change `modelo-dominio`, ver design.md → Invariante 1).
-- Prisma generó acá un índice único SIN condición a partir del `@@unique` de
-- `schema.prisma` (el DSL no soporta `WHERE` en índices únicos). Se reemplaza por un
-- índice único PARCIAL: solo bloquea duplicados de (mesaId, turnoId, fecha) entre
-- reservas activas (PENDIENTE o CONFIRMADA). Una Reserva CANCELADA o NO_SHOW no debe
-- impedir que otra Reserva ocupe esa misma combinación.
--
-- NO reemplazar esto por la versión "de fábrica" si en el futuro se corre
-- `prisma migrate dev` de nuevo y Prisma marca esto como drift para "reparar" — el
-- schema y esta migración quedan intencionalmente desincronizados en este punto
-- (ver Risks/Trade-offs en design.md). Cualquier cambio acá debe seguir siendo una
-- edición manual revisada, nunca una regeneración automática.
-- ============================================================================
CREATE UNIQUE INDEX "Reserva_mesaId_turnoId_fecha_key"
  ON "Reserva" ("mesaId", "turnoId", "fecha")
  WHERE "estado" IN ('PENDIENTE', 'CONFIRMADA');

-- AddForeignKey
ALTER TABLE "Mesa" ADD CONSTRAINT "Mesa_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "Zona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
