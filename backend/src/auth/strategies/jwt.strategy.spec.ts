import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe('validate', () => {
    it('debería devolver el payload cuando el token es válido', () => {
      const payload = { sub: 'user-uuid', rol: 'ADMIN' };
      const result = strategy.validate(payload);
      expect(result).toEqual({ id: 'user-uuid', rol: 'ADMIN' });
    });

    // `validate()` es síncrono y tira la excepción directamente (no devuelve una
    // Promise rechazada), así que se comprueba con `toThrow` sincrónico y no con
    // `rejects.toThrow`, que nunca hubiera llegado a atrapar nada.
    it('debería lanzar UnauthorizedException cuando falta sub', () => {
      const payload = { rol: 'ADMIN' };
      expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
      expect(() => strategy.validate(payload)).toThrow('Token inválido');
    });

    it('debería lanzar UnauthorizedException cuando falta rol', () => {
      const payload = { sub: 'user-uuid' };
      expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
      expect(() => strategy.validate(payload)).toThrow('Token inválido');
    });

    it('debería lanzar UnauthorizedException cuando payload está vacío', () => {
      const payload = {};
      expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
      expect(() => strategy.validate(payload)).toThrow('Token inválido');
    });
  });
});
