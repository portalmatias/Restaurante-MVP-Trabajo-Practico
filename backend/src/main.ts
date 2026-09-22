import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Sin este pipe los decoradores de class-validator quedan inertes: nadie los ejecuta.
  // `whitelist` descarta campos no declarados en el DTO y `forbidNonWhitelisted` los
  // rechaza con 400 en vez de ignorarlos en silencio (config.yaml §7: 400 es input mal
  // formado) — ver auth-admin, LoginDto. `transform` convierte el payload a los tipos del
  // DTO, que es lo que necesita la query de `GET /disponibilidad`, donde todo llega como
  // string (D8 de disponibilidad).
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  // D7: el backend escucha en el puerto de la variable de entorno PORT, con 3001 como default.
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
