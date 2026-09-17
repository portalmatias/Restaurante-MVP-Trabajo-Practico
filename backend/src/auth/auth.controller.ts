import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Login de administrador',
    description:
      'Autentica a un usuario administrador con email y contraseña, y devuelve un JWT de acceso (openspec/config.yaml §5).',
  })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso: devuelve el JWT de acceso.',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description:
      'Credenciales inválidas: email inexistente o contraseña incorrecta. El mensaje es genérico y no distingue cuál dato falló.',
  })
  @ApiResponse({
    status: 429,
    description:
      'Se superó el límite de intentos de login permitidos en la ventana configurada (rate limiting).',
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  // Rutas de prueba usadas solo por los tests e2e de los guards (JwtAuthGuard/RolesGuard).
  // No son parte del contrato público de la API, así que se excluyen del spec de OpenAPI.
  @Get('test-protected')
  @ApiExcludeEndpoint()
  @UseGuards(JwtAuthGuard)
  testProtected() {
    return {
      message: 'Ruta protegida accesible',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('test-admin-only')
  @ApiExcludeEndpoint()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  testAdminOnly() {
    return {
      message: 'Ruta solo para admins accesible',
      timestamp: new Date().toISOString(),
    };
  }
}
