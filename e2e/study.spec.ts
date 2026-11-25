import { test, expect, type Page } from "@playwright/test";

async function register(page: Page) {
  const health = await page.request.get("/api/health");
  expect(
    (await health.json()).storage,
    "Gere o build com VITE_BACKEND=local antes dos E2E; estes testes não devem cadastrar contas em serviços externos.",
  ).toBe("reachable");
  await page.goto("/cadastro");
  await page.getByLabel("Nome", { exact: true }).fill("Estudante E2E");
  await page.getByLabel("E-mail", { exact: true }).fill(`e2e-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Senha", { exact: true }).fill("SenhaE2E-2026!");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  const recovery = page.getByRole("button", { name: "Guardei meu código. Continuar", exact: true });
  await expect(
    recovery.or(page.getByRole("heading", { name: "Vamos montar sua rotina" })),
  ).toBeVisible();
  if (await recovery.isVisible()) await recovery.click();
  await expect(page.getByRole("button", { name: "Ir para o painel", exact: true })).toBeEnabled();
  await page
    .getByLabel("Curso", { exact: true })
    .selectOption({ label: "Informática para Internet" });
  await page.getByLabel("Objetivo principal", { exact: true }).fill("Aprender SQL");
  await page.getByRole("button", { name: "Ir para o painel", exact: true }).click();
  await page.getByRole("button", { name: "Pular tutorial", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("heading", { name: /Olá, Estudante/ })).toBeVisible();
}
async function rows(page: Page, table: string) {
  const response = await page.request.post("/api/local", {
    headers: { origin: new URL(page.url()).origin },
    data: { op: "list", table },
  });
  const result = await response.json();
  expect(response.ok(), result.error ?? `HTTP ${response.status()}`).toBeTruthy();
  return result.data;
}
test.beforeEach(async ({ page }) => {
  await register(page);
});

test("a mesma conta compartilha dados entre site e outro dispositivo", async ({
  page,
  browser,
}) => {
  const session = await page.request.post("/api/local", { data: { op: "auth:session" } });
  expect(session.ok()).toBeTruthy();
  const email = (await session.json()).data.session.user.email;
  const second = await browser.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const mobile = await second.newPage();
    await mobile.goto("/login");
    await mobile.getByLabel("E-mail", { exact: true }).fill(email);
    await mobile.getByLabel("Senha", { exact: true }).fill("SenhaE2E-2026!");
    await mobile.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(mobile.getByRole("heading", { name: /Olá, Estudante/ })).toBeVisible();
    const id = crypto.randomUUID();
    const saved = await page.request.post("/api/local", {
      data: {
        op: "insert",
        table: "subjects",
        row: { id, name: "Compartilhada entre dispositivos", color: "indigo" },
      },
    });
    expect(saved.ok()).toBeTruthy();
    await mobile.goto("/app/disciplinas");
    await expect(
      mobile.getByText("Compartilhada entre dispositivos", { exact: true }),
    ).toBeVisible();
    const storage = await second.storageState();
    await second.clearCookies();
    await mobile.goto("/app/painel");
    await expect(mobile).toHaveURL(/\/login/);
    await second.addCookies(storage.cookies);
    await mobile.goto("/app/disciplinas");
    await expect(
      mobile.getByText("Compartilhada entre dispositivos", { exact: true }),
    ).toBeVisible();
  } finally {
    await second.close();
  }
});

test("organiza estudos, revisa cartão e restaura backup completo", async ({ page }) => {
  await page.goto("/app/disciplinas");
  await page.getByRole("button", { name: "Nova disciplina", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Banco de Dados E2E");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goto("/app/atividades");
  await page.getByRole("button", { name: "Nova atividade", exact: true }).click();
  await page.getByLabel("Título", { exact: true }).fill("Estudar SELECT");
  await page
    .getByLabel("Disciplina", { exact: true })
    .selectOption({ label: "Banco de Dados E2E" });
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.reload();
  await expect(page.getByText("Estudar SELECT", { exact: true })).toBeVisible();
  await page.goto("/app/flashcards");
  await page.getByRole("button", { name: "Novo cartão", exact: true }).click();
  await page.getByLabel("Frente (pergunta)").fill("Como consultar dados?");
  await page.getByLabel("Verso (resposta)").fill("SELECT");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "Mostrar resposta", exact: true }).first().click();
  await page.getByRole("button", { name: "Bom", exact: true }).click();
  await expect(page.getByText("Tudo revisado por hoje")).toBeVisible();
  await page.goto("/app/materiais");
  await page.locator("#mat-file").setInputFiles({
    name: "estudo.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("SELECT consulta dados. WHERE filtra linhas."),
  });
  await expect.poll(async () => (await rows(page, "material_files")).length).toBe(1);
  await page.goto("/app/configuracoes");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Backup/ }).click();
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.locator("#imp").setInputFiles(path!);
  await page.getByRole("button", { name: "Adicionar registros", exact: true }).click();
  await expect.poll(async () => (await rows(page, "material_files")).length).toBe(2);
  expect(await rows(page, "subjects")).toHaveLength(2);
  expect(await rows(page, "tasks")).toHaveLength(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("recupera confirmação perdida do exercício sem duplicar a resposta", async ({ page }) => {
  await page.goto("/app/exercicios");
  await page.getByRole("button", { name: /^Começar \(/ }).click();
  let lost = false;
  await page.route("**/api/local", async (route) => {
    const body = route.request().postDataJSON();
    if (!lost && body.op === "insert" && body.table === "quiz_answers") {
      lost = true;
      await route.fetch(); // O servidor gravou, mas o navegador perde a confirmação.
      await route.fulfill({ status: 500, json: { error: "Falha simulada de confirmação" } });
    } else await route.continue();
  });
  await page.getByRole("radio").first().click();
  await expect(page.getByRole("button", { name: "Próxima", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Tentar salvar resposta", exact: true }).click();
  await expect(page.getByRole("button", { name: "Próxima", exact: true })).toBeEnabled();
  expect(await rows(page, "quiz_answers")).toHaveLength(1);
});

test("todas as seções abrem e a disponibilidade mostra erro específico", async ({ page }) => {
  for (const section of [
    "painel",
    "disciplinas",
    "atividades",
    "calendario",
    "planejador",
    "foco",
    "flashcards",
    "exercicios",
    "materiais",
    "assistente",
    "metas",
    "desempenho",
    "configuracoes",
  ]) {
    await page.goto(`/app/${section}`);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Esta página não carregou" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.getByRole("button", { name: /Perfil e disponibilidade/ }).click();
  for (const input of await page.getByRole("spinbutton").all()) await input.fill("960");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("A disponibilidade deve somar no máximo 100 horas por semana.", { exact: true }),
  ).toBeVisible();
  const response = await page.request.get("/api/monitoring");
  expect(response.status()).toBe(401);
  const health = await page.request.get("/api/health");
  expect(health.ok()).toBeTruthy();
});

test("retoma contexto e apresenta Markdown com cópia sem chamar provedor externo", async ({
  page,
  context,
}) => {
  const material = crypto.randomUUID(),
    conversation = crypto.randomUUID();
  const content =
    "## Consulta SQL\n\n- Consultar dados\n- Filtrar linhas\n\n```sql\nSELECT 1;\n```";
  for (const [table, row] of [
    [
      "materials",
      { id: material, name: "Material E2E", kind: "txt", content: "SELECT consulta dados." },
    ],
    [
      "study_conversations",
      {
        id: conversation,
        subject_id: null,
        material_id: null,
        task_id: null,
        title: "Conversa E2E",
        mode: "tutor",
        level: "intermediate",
      },
    ],
    [
      "study_messages",
      {
        id: crypto.randomUUID(),
        client_id: crypto.randomUUID(),
        conversation_id: conversation,
        role: "assistant",
        content,
        model: null,
      },
    ],
  ] as const) {
    const response = await page.request.post("/api/local", { data: { op: "insert", table, row } });
    expect(response.ok()).toBeTruthy();
  }
  // Somente a disponibilidade é simulada; conteúdo e persistência usam o Repo/SQLite real.
  await page.route("**/api/assistant", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { configured: true } })
      : route.abort(),
  );
  await page.goto("/app/assistente");
  await page.getByRole("button", { name: "Contexto do estudo", exact: true }).click();
  await page.getByLabel("Histórico salvo", { exact: true }).selectOption(conversation);
  await expect(page.getByRole("heading", { name: "Consulta SQL", exact: true })).toBeVisible();
  await expect(page.locator("pre code")).toHaveText("SELECT 1;\n");
  await expect(page.locator("main li")).toHaveCount(2);
  await page.getByLabel("Como estudar", { exact: true }).selectOption("review");
  await expect(page.getByLabel("Como estudar", { exact: true })).toHaveValue("review");
  await page.getByLabel("Nível de explicação", { exact: true }).selectOption("advanced");
  await expect(page.getByLabel("Nível de explicação", { exact: true })).toHaveValue("advanced");
  await page.getByLabel("Material de referência", { exact: true }).selectOption(material);
  await expect(page.getByLabel("Material de referência", { exact: true })).toHaveValue(material);
  await page.reload();
  await page.getByRole("button", { name: "Contexto do estudo", exact: true }).click();
  await page.getByLabel("Histórico salvo", { exact: true }).selectOption(conversation);
  await expect(page.getByLabel("Como estudar", { exact: true })).toHaveValue("review");
  await expect(page.getByLabel("Nível de explicação", { exact: true })).toHaveValue("advanced");
  await expect(page.getByLabel("Material de referência", { exact: true })).toHaveValue(material);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copiar resposta", exact: true }).click();
  await expect(page.getByRole("button", { name: "Texto copiado", exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(content);
});

test("material agenda revisões persistentes e cartões alimentam associação", async ({ page }) => {
  const materialId = crypto.randomUUID();
  const insert = async (table: string, row: unknown) => {
    const response = await page.request.post("/api/local", {
      headers: { origin: new URL(page.url()).origin },
      data: { op: "insert", table, row },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  };
  await insert("materials", {
    id: materialId,
    name: "Aula integrada",
    kind: "md",
    content: "# Biologia\n\n## Núcleo\n- Contém DNA",
  });
  await page.goto("/app/materiais");
  await page.getByRole("button", { name: "Aula integrada md" }).click();
  await expect(page.getByText("Núcleo", { exact: true })).toBeVisible();
  const schedule = page.getByRole("button", { name: "Agendar revisões em 1, 7 e 30 dias" });
  await schedule.click();
  await expect.poll(async () => (await rows(page, "tasks")).length).toBe(3);
  await expect(schedule).toBeEnabled();
  await schedule.click();
  await expect(schedule).toBeEnabled();
  expect(await rows(page, "tasks")).toHaveLength(3);
  await page.reload();
  expect(await rows(page, "tasks")).toHaveLength(3);
  for (const [front, back] of [
    ["DNA?", "Material genético"],
    ["Núcleo?", "Organela celular"],
  ]) {
    await insert("flashcards", {
      id: crypto.randomUUID(),
      front,
      back,
      subject_id: null,
      due_date: "2099-01-01",
      interval_days: 0,
      ease: 2.5,
      reps: 0,
    });
  }
  await page.goto("/app/flashcards");
  await page.getByRole("button", { name: "Começar associação" }).click();
  await page.getByRole("button", { name: "DNA?", exact: true }).click();
  await page.getByRole("button", { name: "Material genético", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Associação correta!" })).toBeVisible();
  await page.getByRole("button", { name: "Núcleo?", exact: true }).click();
  await page.getByRole("button", { name: "Organela celular", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Rodada concluída!" })).toBeVisible();
  expect(
    (await rows(page, "flashcards")).every(
      (c: { due_date: string }) => c.due_date === "2099-01-01",
    ),
  ).toBeTruthy();
});

test("revisão para prova, retomada do Foco e caderno de erros usam os dados reais", async ({
  page,
}) => {
  const insert = async (table: string, row: unknown) => {
    const response = await page.request.post("/api/local", {
      headers: { origin: new URL(page.url()).origin },
      data: { op: "insert", table, row },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  };
  const materialId = crypto.randomUUID();
  await insert("materials", {
    id: materialId,
    name: "Equações para a prova",
    kind: "md",
    content: "Na forma ax² + bx + c = 0, os sinais fazem parte dos coeficientes.",
  });
  await insert("quiz_answers", {
    id: crypto.randomUUID(),
    question_id: "mat-4",
    topic: "Matemática",
    correct: false,
    answered_at: "2020-01-01T12:00:00Z",
  });
  await page.goto("/app/planejador");
  await page.getByLabel("Conteúdo da prova", { exact: true }).selectOption(materialId);
  await page.getByLabel("Tempo disponível (min)", { exact: true }).fill("40");
  await page.getByRole("button", { name: "Montar revisão", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar etapas ao cronograma", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Revisão no cronograma", exact: true }),
  ).toBeDisabled();
  const tasks = await rows(page, "tasks");
  expect(tasks).toHaveLength(3);
  expect(
    tasks.reduce((sum: number, task: { duration_min: number }) => sum + task.duration_min, 0),
  ).toBe(40);
  await page.getByLabel("Minutos disponíveis hoje (opcional)").fill("20");
  await expect(page.getByRole("button", { name: "Voltar à rotina habitual" })).toBeVisible();
  await page.goto("/app/foco");
  await page.getByLabel("Atividade", { exact: true }).selectOption(tasks[0].id);
  await page.getByLabel("Duração do ciclo (min)").fill("5");
  await page.getByRole("button", { name: "Iniciar", exact: true }).click();
  await page.goto("/app/exercicios");
  await page.goto("/app/foco");
  await expect(page.getByLabel("Atividade", { exact: true })).toHaveValue(tasks[0].id);
  await expect(page.getByLabel("Duração do ciclo (min)")).toHaveValue("5");
  await expect(page.getByLabel("Duração do ciclo (min)")).toBeDisabled();
  await page.getByRole("button", { name: "Descartar sessão" }).click();
  await page.goto("/app/exercicios");
  await page.getByRole("button", { name: /Qual é o coeficiente b/ }).click();
  await page.getByRole("radio", { name: "−5", exact: true }).check();
  await page
    .getByRole("button", { name: "Conferir e registrar nova tentativa", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Tentativa registrada", exact: true }),
  ).toBeDisabled();
  expect(await rows(page, "quiz_answers")).toHaveLength(2);
  await page.getByRole("button", { name: "Criar flashcard deste erro", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cartão disponível na revisão", exact: true }),
  ).toBeDisabled();
  expect(await rows(page, "flashcards")).toHaveLength(1);
});

test("fórmulas são legíveis e a fonte abre o trecho verificável do material", async ({ page }) => {
  const material = crypto.randomUUID(),
    conversation = crypto.randomUUID(),
    message = crypto.randomUUID();
  const excerpt = "O discriminante positivo indica duas raízes reais distintas.";
  const insert = async (table: string, row: unknown) => {
    const response = await page.request.post("/api/local", {
      headers: { origin: new URL(page.url()).origin },
      data: { op: "insert", table, row },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  };
  await insert("materials", {
    id: material,
    name: "Equações e discriminante",
    kind: "md",
    content: excerpt,
  });
  await insert("study_conversations", {
    id: conversation,
    subject_id: null,
    material_id: material,
    task_id: null,
    title: "Duas raízes",
    mode: "tutor",
    level: "intermediate",
  });
  await insert("study_messages", {
    id: message,
    client_id: message,
    conversation_id: conversation,
    role: "assistant",
    content: `A equação \\(x^2-5x+6=0\\) tem raízes 2 e 3.\n\n> [1] ${excerpt}`,
    model: null,
  });
  await insert("study_message_sources", {
    id: message,
    message_id: message,
    material_id: material,
    title: "Equações e discriminante",
    excerpt,
    url: null,
    page_number: null,
  });
  await page.route("**/api/assistant", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { configured: true } })
      : route.abort(),
  );
  await page.goto("/app/assistente");
  await page.getByRole("button", { name: "Contexto do estudo", exact: true }).click();
  await page.getByLabel("Histórico salvo", { exact: true }).selectOption(conversation);
  await expect(page.locator("math")).toHaveCount(1);
  await expect(page.locator(".katex-html")).toBeVisible();
  await expect(page.getByLabel("Contexto ativo")).toContainText("Equações e discriminante");
  await page
    .getByRole("button", { name: "Abrir fonte: [1] Equações e discriminante", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("mark")).toHaveText(excerpt);
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
