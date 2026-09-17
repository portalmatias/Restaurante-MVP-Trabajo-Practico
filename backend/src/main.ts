import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // D8 de disponibilidad: la validación de formato de la query vive en los DTOs con
  // class-validator; sin este pipe los decoradores quedan inertes y no hay 400.
  // `transform: true` es lo que convierte la query (siempre strings) a los tipos del DTO.
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  // D7: el backend escucha en el puerto de la variable de entorno PORT, con 3001 como default.
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
