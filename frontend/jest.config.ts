import type { Config } from "jest";
import nextJest from "next/jest.js";

// Los tests de fecha y hora deben correr en un huso con offset NEGATIVO por defecto: solo ahí
// falla una implementación a la que le falta `timeZone: "UTC"` (en UTC no hay diferencia). Se
// fija acá, en el proceso principal, antes de que Jest arme sus workers (heredan el entorno).
// Una `TZ` explícita del entorno se respeta para poder correr la suite en otros husos.
process.env.TZ ??= "America/Argentina/Buenos_Aires";

const createJestConfig = nextJest({
  // Ruta a la app de Next.js para cargar next.config.ts y los .env en los tests.
  dir: "./",
});

// config.yaml §9: los tests de frontend viven en frontend/test/, no en __tests__/.
const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  roots: ["<rootDir>/test"],
};

// createJestConfig se exporta así para que next/jest pueda cargar la config async de Next.js.
export default createJestConfig(config);
