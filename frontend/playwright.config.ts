import { defineConfig, devices } from "@playwright/test";

// Pruebas de extremo a extremo del frontend, en un navegador real. Viven en frontend/e2e/ y las
// ignora Jest (su `roots` es frontend/test/). Esperan el sitio ya levantado con `npm run dev`
// desde la raíz (frontend en 3000, backend en 3001, con la base migrada y el seed). Otra URL:
// `PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e -w frontend`.
// Se usa `localhost` y no `127.0.0.1`: así lo trata el navegador en este equipo.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
    { name: "movil", use: { ...devices["Pixel 7"] } },
  ],
});
