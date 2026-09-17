// Se ejecuta antes de que Jest cargue cada archivo de test de integración (ver
// `setupFiles` en jest-integration.json), así cualquier PrismaClient que el
// archivo de test importe ya ve `DATABASE_URL` apuntando a la base de TEST,
// nunca a la de desarrollo (config.yaml §9 y §10).
//
// Las credenciales son las mismas de juguete que ya documentan docker-compose.yml y
// .env.example para desarrollo local — no son secretas.
// Carga variables de entorno desde .env (raíz del monorepo) y backend/.env
// `quiet: true` porque dotenv >=17 imprime un mensaje promocional aleatorio por cada
// carga (feature real de la librería, no un error) — no aporta nada en un test run.
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '../.env', quiet: true });
loadEnv({ path: '.env', quiet: true });

process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgresql://postgres:postgres@localhost:5432/reservas_test';
