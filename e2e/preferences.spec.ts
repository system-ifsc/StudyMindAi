import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/demo/configuracoes");
  await expect(page.getByRole("heading", { name: "Do seu jeito" })).toBeVisible();
});

test("prévia, revisão, persistência e descarte das configurações", async ({ page }) => {
  const preferences = page.getByRole("region", { name: "Preferências do aplicativo" });
  await preferences.getByRole("switch", { name: "Modo escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await preferences.getByRole("button", { name: /Aparência/ }).click();
  await preferences.getByRole("button", { name: "Rosa", exact: true }).click();
  await preferences.getByRole("button", { name: "Georgia", exact: true }).click();
  await preferences.getByRole("button", { name: "Nítido", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-color", "rose");
  await expect(page.locator("body")).toHaveCSS("font-family", /Georgia/);
  expect(await page.evaluate(() => localStorage.getItem("studymind-preferences"))).toBeNull();
  await preferences.getByRole("button", { name: "Revisar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("4 alterações para aplicar");
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Do seu jeito" })).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("html")).toHaveAttribute("data-color", "rose");
  await expect(page.locator("html")).toHaveAttribute("data-shape", "crisp");
  await expect(page.locator("body")).toHaveCSS("font-family", /Georgia/);
  await preferences.getByRole("button", { name: /Aparência/ }).click();
  await preferences.getByRole("button", { name: "Azul", exact: true }).click();
  await preferences.getByRole("button", { name: "Descartar" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-color", "rose");
  await preferences.getByRole("button", { name: "Azul", exact: true }).click();
  await page.getByRole("link", { name: "Voltar ao painel", exact: true }).click();
  await expect(page).toHaveURL(/\/demo\/painel/);
  await expect(page.locator("html")).toHaveAttribute("data-color", "rose");
});

test("o atalho de tema continua funcionando durante a prévia", async ({ page }) => {
  await page.getByRole("switch", { name: "Modo escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Ativar tema claro", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.getByRole("switch", { name: "Modo escuro" })).not.toBeChecked();
});

test("som flutuante e preferências permanecem sincronizados", async ({ page }) => {
  await page.getByRole("button", { name: /Notificações/ }).click();
  await page.getByRole("button", { name: "Silenciar sons de clique" }).click();
  await expect(page.getByRole("switch", { name: "Som", exact: true })).not.toBeChecked();
  await page.getByRole("switch", { name: "Som", exact: true }).click();
  await page.getByRole("button", { name: "Revisar", exact: true }).click();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("button", { name: "Silenciar sons de clique" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Notificações/ }).click();
  await expect(page.getByRole("switch", { name: "Som", exact: true })).toBeChecked();
});

test("controles cabem na tela estreita com a fonte selecionada", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole("button", { name: /Aparência/ }).click();
  await page.getByRole("button", { name: "Georgia", exact: true }).click();
  const colors = page.getByRole("button", { name: "Âmbar", exact: true });
  const bounds = await colors.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole("button", { name: "Revisar", exact: true }).click();
  const dialog = await page.getByRole("dialog").boundingBox();
  expect(dialog!.x).toBeGreaterThanOrEqual(0);
  expect(dialog!.x + dialog!.width).toBeLessThanOrEqual(320);
});

test("as cinco paletas mudam toda a interface nos modos claro e escuro", async ({ page }) => {
  const palettes = [
    ["Violeta", "violet", 293],
    ["Rosa", "rose", 355],
    ["Azul", "blue", 260],
    ["Verde", "green", 145],
    ["Âmbar", "amber", 65],
  ] as const;
  for (const dark of [false, true]) {
    const toggle = page.getByRole("switch", { name: "Modo escuro" });
    await toggle.setChecked(dark);
    await page.getByRole("button", { name: /Aparência/ }).click();
    let previous: Record<string, string> | undefined;
    for (const [label, key, hue] of palettes) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("data-color", key);
      const colors = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const app = getComputedStyle(document.querySelector(".study-app")!);
        const tokens = [
          "--background",
          "--foreground",
          "--surface",
          "--primary",
          "--accent",
          "--muted",
          "--input",
          "--sidebar-accent",
          "--gradient-brand",
          "--chart-1",
          "--chart-2",
          "--chart-3",
          "--chart-4",
          "--chart-5",
        ];
        return Object.fromEntries([
          ...tokens.map((key) => [key, root.getPropertyValue(key)]),
          ...["--card", "--border", "--sidebar"].map((key) => [key, app.getPropertyValue(key)]),
          ["app-background", app.backgroundColor],
        ]);
      });
      for (const [token, value] of Object.entries(colors)) {
        expect(value, `${key}: ${token}`).toMatch(new RegExp(`\\b${hue}\\b`));
        if (previous) expect(value, `${key}: ${token} deve mudar`).not.toBe(previous[token]);
      }
      previous = colors;
    }
    await page.getByRole("button", { name: "Voltar às preferências" }).click();
  }
  await page.getByRole("button", { name: "Revisar", exact: true }).click();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.getByRole("link", { name: "Voltar ao painel", exact: true }).click();
  await expect(page.locator(".focus-hero")).toBeVisible();
  const hero = await page
    .locator(".focus-hero")
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(hero).toMatch(/\b65\b/);
  const shortcuts = await page
    .locator(".study-shortcut > span:first-child")
    .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).backgroundColor));
  expect(shortcuts.length).toBeGreaterThan(0);
  for (const color of shortcuts) {
    // color-mix is serialized in OKLab; recover its hue from the a/b coordinates.
    const lab = color.match(/^oklab\(\S+\s+([-\d.e]+)\s+([-\d.e]+)/);
    if (lab) {
      const hue = ((Math.atan2(Number(lab[2]), Number(lab[1])) * 180) / Math.PI + 360) % 360;
      expect(hue).toBeCloseTo(65, 1);
    } else expect(color).toMatch(/\b65\b/);
  }
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-color", "amber");
  const illustration = await page
    .locator(".auth-brand-banner")
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(illustration).toMatch(/\b65\b/);
});

test("as quatro fontes alteram textos, títulos e controles e podem ser descartadas", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Aparência/ }).click();
  await expect(page.getByText("Fonte do texto", { exact: true })).toBeVisible();
  await expect(page.getByText("Tamanho do texto", { exact: true })).toHaveCount(0);
  for (const [label, font] of [
    ["Arial", "Arial"],
    ["Georgia", "Georgia"],
    ["Courier New", "Courier New"],
    ["Manrope", "Manrope"],
  ] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator("body")).toHaveCSS("font-family", new RegExp(font));
    await expect(page.getByRole("heading", { name: "Aparência", exact: true })).toHaveCSS(
      "font-family",
      new RegExp(font),
    );
    await expect(page.getByRole("button", { name: "Continuar estudando" })).toHaveCSS(
      "font-family",
      new RegExp(font),
    );
  }
  await page.getByRole("button", { name: "Georgia", exact: true }).click();
  await page.getByRole("button", { name: "Descartar" }).click();
  await expect(page.locator("body")).toHaveCSS("font-family", /Manrope/);
});

test("perfil, tutorial e backup só mostram o conteúdo após clicar", async ({ page }) => {
  await expect(page.getByRole("textbox", { name: "Nome", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Refazer tutorial", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Exportar", exact: true })).toHaveCount(0);
  await expect(page.locator("#imp")).toHaveCount(0);

  await page.getByRole("button", { name: /Perfil e disponibilidade/ }).click();
  await expect(
    page.getByRole("heading", { name: "Perfil e disponibilidade", exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Nome", exact: true }).fill("Perfil nas configurações");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Perfil salvo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Voltar às preferências" }).click();
  await expect(page.getByRole("textbox", { name: "Nome", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Perfil e disponibilidade/ }).click();
  await expect(page.getByRole("textbox", { name: "Nome", exact: true })).toHaveValue(
    "Perfil nas configurações",
  );
  await page.getByRole("button", { name: "Voltar às preferências" }).click();

  await page.getByRole("button", { name: /Tutorial de boas-vindas/ }).click();
  await expect(page.getByRole("button", { name: "Refazer tutorial", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Exportar", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Voltar às preferências" }).click();
  await expect(page.getByRole("button", { name: "Refazer tutorial", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: /^Backup/ }).click();
  await expect(page.getByRole("button", { name: "Importar", exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^studymind-backup-.*\.json$/);
  await page.getByRole("button", { name: "Voltar às preferências" }).click();
  await expect(page.getByRole("button", { name: "Exportar", exact: true })).toHaveCount(0);
  await expect(page.locator("#imp")).toHaveCount(0);
});
