import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Sin esto los decoradores de class-validator (LoginDto, etc.) son inertes: nadie los
  // ejecuta. `whitelist` descarta campos no declarados en el DTO; `forbidNonWhitelisted`
  // los rechaza con 400 en vez de ignorarlos en silencio (config.yaml §7: 400 es input
  // mal formado).
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  // D7: el backend escucha en el puerto de la variable de entorno PORT, con 3001 como default.
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
