import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // D7: el backend escucha en el puerto de la variable de entorno PORT, con 3001 como default.
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
