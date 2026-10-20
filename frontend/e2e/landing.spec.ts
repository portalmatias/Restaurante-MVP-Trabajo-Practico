import { expect, test } from "@playwright/test";

test("la landing carga y ofrece el camino a la reserva", async ({ page }) => {
  const respuesta = await page.goto("/");
  expect(respuesta?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

  await page.locator('a[href^="/reservas"]').first().click();
  await expect(page).toHaveURL(/\/reservas/);
});

test("la landing no tiene scroll horizontal", async ({ page }) => {
  await page.goto("/");
  const desborda = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(desborda).toBe(false);
});
