import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarRed } from './configurar-red';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // D2/D3 de exposicion-red-local: sin `TRUST_PROXY`, el backend no confía en
  // `X-Forwarded-For` para identificar al cliente; con un valor inválido, corta acá, antes de
  // conectarse a la base y de escuchar en el puerto.
  configurarRed(app);
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
  // D1 de exposicion-red-local: y solo en loopback, salvo que `HOST` diga otra cosa. Con `||`
  // y no `??`: un `HOST=` vacío llega como `''`, y Node toma el host vacío como "todas las
  // interfaces", es decir, expondría el backend a la red justo en el caso por defecto.
  await app.listen(process.env.PORT ?? 3001, process.env.HOST || '127.0.0.1');
}
void bootstrap();
