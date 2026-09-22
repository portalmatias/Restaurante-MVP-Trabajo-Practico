import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Email del usuario administrador.',
    example: 'admin@restaurante-mvp.local',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario administrador.',
    example: 'AdminMVP2026!',
  })
  @IsString()
  @MinLength(1)
  password: string;
}
