// Se ejecuta antes de que Jest cargue cada archivo de test e2e (ver `setupFiles` en
// jest-e2e.json), así cualquier PrismaClient que el archivo de test importe ya ve
// `DATABASE_URL` apuntando a la base de TEST, nunca a la de desarrollo (config.yaml §9 y
// §10: "la base de test es separada de la de desarrollo").
//
// Las credenciales son las mismas de juguete que ya documentan docker-compose.yml y
// .env.example para desarrollo local — no son secretas.
//
// Carga variables de entorno desde .env (raíz del monorepo) y backend/.env, igual que
// jest-integration.setup.ts. Este archivo corre ANTES de que `AppModule` (y su `ConfigModule`,
// que también lee el .env) se importe, así que sin esta carga un `DATABASE_URL_TEST` definido
// solo en el `.env` se ignoraba y el e2e caía al fallback de abajo, distinto de lo que usan
// los tests de integración. Las variables de la app (`JWT_SECRET`, etc.) en local salen del
// `.env` y en CI del workflow. dotenv no pisa lo que ya está exportado en el entorno.
// `quiet: true` porque dotenv >=17 imprime un mensaje promocional aleatorio por cada
// carga (feature real de la librería, no un error) — no aporta nada en un test run.
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '../.env', quiet: true });
loadEnv({ path: '.env', quiet: true });

process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgresql://postgres:postgres@localhost:5432/reservas_test';
