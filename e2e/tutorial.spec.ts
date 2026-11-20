import { test, expect } from "@playwright/test";

test("tutorial permanece visível em todos os passos e após redimensionar", async ({ page }) => {
  await page.goto("/demo/configuracoes");
  await page.getByRole("button", { name: /Tutorial de boas-vindas/ }).click();
  await page.getByRole("button", { name: "Refazer tutorial", exact: true }).click();
  const dialog = page.getByRole("dialog").filter({
    has: page.getByRole("button", { name: "Pular tutorial", exact: true }),
  });
  await expect(dialog).toBeVisible();
  for (let step = 1; step <= 15; step++) {
    await expect(dialog).toContainText(`Passo ${step} de 15`);
    await expect(async () => {
      const bounds = await dialog.boundingBox();
      const viewport = page.viewportSize()!;
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    }).toPass();
    if (step < 15)
      await dialog
        .getByRole("button", {
          name: step === 1 ? "Começar" : "Avançar",
          exact: true,
        })
        .click();
  }
  for (const size of [
    { width: 667, height: 375 },
    { width: 390, height: 640 },
  ]) {
    await page.setViewportSize(size);
    await expect(async () => {
      const bounds = (await dialog.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(size.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(size.height);
    }).toPass();
  }
  await dialog.getByRole("button", { name: "Concluir", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});
