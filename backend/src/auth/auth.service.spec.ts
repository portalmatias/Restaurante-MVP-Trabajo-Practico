import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

const mockPrisma = {
  usuario: {
    findUnique: jest.fn(),
  },
};

// Se guarda la referencia directa al mock (en vez de recuperar `JwtService` tipado desde
// el módulo de testing) para poder aserir sobre `sign` sin pasar el método de una clase
// real como referencia suelta (dispara `@typescript-eslint/unbound-method`).
const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          // AuthService inyecta `PrismaService` (provisto globalmente por `PrismaModule`),
          // no `PrismaClient` directamente.
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const mockUser = {
      id: 'user-uuid',
      email: 'admin@restaurante-mvp.local',
      passwordHash: 'hashed-password',
      rol: 'ADMIN' as const,
    };

    it('debería devolver un JWT cuando las credenciales son correctas', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(
        'admin@restaurante-mvp.local',
        'AdminMVP2026!',
      );

      expect(result).toEqual({ accessToken: 'mock-jwt-token' });
      expect(mockPrisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@restaurante-mvp.local' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'AdminMVP2026!',
        mockUser.passwordHash,
      );
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        rol: mockUser.rol,
      });
    });

    it('debería lanzar UnauthorizedException cuando el email no existe', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue(null);

      await expect(
        service.login('noexiste@test.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.login('noexiste@test.com', 'password123'),
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('debería lanzar UnauthorizedException cuando la contraseña es incorrecta', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login('admin@restaurante-mvp.local', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.login('admin@restaurante-mvp.local', 'wrongpassword'),
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('debería lanzar el mismo error genérico para email inexistente y contraseña incorrecta', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue(null);

      try {
        await service.login('noexiste@test.com', 'password123');
      } catch (error: unknown) {
        expect(error instanceof Error ? error.message : undefined).toBe(
          'Credenciales inválidas',
        );
      }

      mockPrisma.usuario.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      try {
        await service.login('admin@restaurante-mvp.local', 'wrongpassword');
      } catch (error: unknown) {
        expect(error instanceof Error ? error.message : undefined).toBe(
          'Credenciales inválidas',
        );
      }
    });
  });
});
