import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';

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
}
