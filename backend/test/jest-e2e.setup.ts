// Se ejecuta antes de que Jest cargue cada archivo de test e2e (ver `setupFiles` en
// jest-e2e.json). Comparte con `jest-integration.setup.ts` la preparación del entorno de la
// base de TEST y la carga del `.env`; el detalle está en `support/entorno-de-test.ts`.
import { configurarEntornoDeTest } from './support/entorno-de-test';

configurarEntornoDeTest();
