import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';

import { Roles } from '../../src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';

/**
 * Rutas de prueba para ejercitar `JwtAuthGuard` y `RolesGuard` de punta a punta
 * (`test/auth.integration-spec.ts`, config.yaml §9: una ruta de admin sin token responde
 * 401 y con un token de rol incorrecto responde 403).
 *
 * Viven acá, en `test/`, y NO en `AuthController`: `AuthModule` se registra en `AppModule`,
 * y cualquier ruta declarada en un controller de `src/` queda expuesta en la API real. Solo
 * los tests las montan, con `controllers: [GuardsProbeController]` en su módulo de prueba;
 * `test/auth.e2e-spec.ts` verifica que la app real NO las expone (responde 404).
 */
@Controller('auth')
export class GuardsProbeController {
  @Get('test-protected')
  @UseGuards(JwtAuthGuard)
  testProtected() {
    return {
      message: 'Ruta protegida accesible',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('test-admin-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  testAdminOnly() {
    return {
      message: 'Ruta solo para admins accesible',
      timestamp: new Date().toISOString(),
    };
  }
}
