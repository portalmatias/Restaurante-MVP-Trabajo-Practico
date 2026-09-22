import { config as loadEnv } from 'dotenv';

/**
 * Prepara el entorno de los tests que usan la base (e2e e integración). Lo llaman los
 * `setupFiles` de Jest de los dos (`jest-e2e.setup.ts` y `jest-integration.setup.ts`), así la
 * configuración de la base de TEST vive en un solo lugar y las dos suites no pueden derivar.
 *
 * Corre antes de que Jest cargue cada archivo de test, así cualquier PrismaClient que el
 * archivo importe ya ve `DATABASE_URL` apuntando a la base de TEST, nunca a la de desarrollo
 * (config.yaml §9 y §10: "la base de test es separada de la de desarrollo").
 *
 * Carga el `.env` de la raíz del monorepo y el de `backend/`. Hace falta hacerlo acá porque
 * este código corre ANTES de que `AppModule` (y su `ConfigModule`, que también lee el
 * `.env`) se importe: sin esta carga, un `DATABASE_URL_TEST` definido solo en el `.env` se
 * ignoraba y los tests caían al fallback. dotenv no pisa lo que ya está exportado en el
 * entorno. Las variables de la app (`JWT_SECRET`, etc.) salen del `.env` en local y del
 * workflow en CI.
 *
 * Las credenciales del fallback son las mismas de juguete que ya documentan
 * docker-compose.yml y .env.example para desarrollo local — no son secretas.
 */
export function configurarEntornoDeTest(): void {
  // `quiet: true` porque dotenv >=17 imprime un mensaje promocional aleatorio por cada
  // carga (feature real de la librería, no un error) — no aporta nada en un test run.
  loadEnv({ path: '../.env', quiet: true });
  loadEnv({ path: '.env', quiet: true });

  process.env.DATABASE_URL =
    process.env.DATABASE_URL_TEST ??
    'postgresql://postgres:postgres@localhost:5432/reservas_test';
}
