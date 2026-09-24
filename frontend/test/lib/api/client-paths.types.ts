/**
 * Chequeo de tipos, no test de runtime (Jest no lo ejecuta: el nombre no matchea
 * `*.test.ts`/`*.spec.ts`). Confirma que el cliente HTTP rechaza en tiempo de compilación un
 * path ausente del contrato de `openapi/openapi.yaml` (D5, D7 de `design.md`): mientras
 * `POST /reservas` no esté mergeado (PR #40), llamarlo debe fallar el chequeo de tipos, no
 * fallar recién en runtime. Se verifica con `npm run typecheck -w frontend`.
 */
import { apiClient } from "../../../src/lib/api/client";

// @ts-expect-error - "/reservas" todavía no está en openapi/openapi.yaml (PR #40 sin mergear).
void apiClient.GET("/reservas");
