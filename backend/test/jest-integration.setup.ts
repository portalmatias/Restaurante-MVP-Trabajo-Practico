// Se ejecuta antes de que Jest cargue cada archivo de test de integración (ver
// `setupFiles` en jest-integration.json). Comparte con `jest-e2e.setup.ts` la preparación del
// entorno de la base de TEST y la carga del `.env`; el detalle está en
// `support/entorno-de-test.ts`.
import { configurarEntornoDeTest } from './support/entorno-de-test';

configurarEntornoDeTest();
