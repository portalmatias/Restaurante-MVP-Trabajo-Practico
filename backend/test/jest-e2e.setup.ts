// Se ejecuta antes de que Jest cargue cada archivo de test e2e (ver `setupFiles` en
// jest-e2e.json), así cualquier PrismaClient que el archivo de test importe ya ve
// `DATABASE_URL` apuntando a la base de TEST, nunca a la de desarrollo (config.yaml §9 y
// §10: "la base de test es separada de la de desarrollo").
//
// Las credenciales son las mismas de juguete que ya documentan docker-compose.yml y
// .env.example para desarrollo local — no son secretas.
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgresql://postgres:postgres@localhost:5432/reservas_test';
