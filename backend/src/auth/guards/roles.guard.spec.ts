import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../guards/roles.guard';
import { RolUsuario } from '@prisma/client';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const createMockContext = (
    // `rol` es opcional para poder simular un `user` sin esa propiedad (caso de test
    // más abajo) sin recurrir a `as any`.
    user: { id: string; rol?: string } | null,
    roles?: RolUsuario[],
  ) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    if (roles) {
      (context.getHandler as jest.Mock).mockReturnValue({});
      (context.getClass as jest.Mock).mockReturnValue({});
      reflector.getAllAndOverride = jest.fn().mockReturnValue(roles);
    } else {
      reflector.getAllAndOverride = jest.fn().mockReturnValue(undefined);
    }

    return context;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('debería permitir acceso cuando no hay roles requeridos', () => {
    const context = createMockContext({ id: 'user-uuid', rol: 'ADMIN' });
    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('debería permitir acceso cuando el usuario tiene el rol requerido', () => {
    const context = createMockContext({ id: 'user-uuid', rol: 'ADMIN' }, [
      RolUsuario.ADMIN,
    ]);
    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('debería lanzar ForbiddenException cuando el usuario no tiene el rol requerido', () => {
    const context = createMockContext({ id: 'user-uuid', rol: 'CLIENTE' }, [
      RolUsuario.ADMIN,
    ]);
    try {
      guard.canActivate(context);
      fail('Debería haber lanzado ForbiddenException');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error instanceof Error ? error.message : undefined).toBe(
        'Acceso denegado: rol insuficiente',
      );
    }
  });

  it('debería lanzar ForbiddenException cuando no hay usuario en el request', () => {
    const context = createMockContext(null, [RolUsuario.ADMIN]);
    try {
      guard.canActivate(context);
      fail('Debería haber lanzado ForbiddenException');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error instanceof Error ? error.message : undefined).toBe(
        'Acceso denegado: rol no encontrado',
      );
    }
  });

  it('debería lanzar ForbiddenException cuando el usuario no tiene propiedad rol', () => {
    const context = createMockContext({ id: 'user-uuid' }, [RolUsuario.ADMIN]);
    try {
      guard.canActivate(context);
      fail('Debería haber lanzado ForbiddenException');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error instanceof Error ? error.message : undefined).toBe(
        'Acceso denegado: rol no encontrado',
      );
    }
  });
});
