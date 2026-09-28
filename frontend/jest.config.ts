import type { Config } from "jest";
import nextJest from "next/jest.js";

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
