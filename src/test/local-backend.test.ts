// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import { handleFeedback } from "@/lib/feedback.server";
import { handleLocalApi } from "@/lib/local/api.server";
import { closeLocalDatabase, localDatabase } from "@/lib/local/database.server";
import { createLocalRepo } from "@/lib/repo/local.server";
import { verifyLocalBearer } from "@/lib/local/auth.server";
import { reserveUsage } from "@/lib/ai/usage.server";
const aiMocks = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: () => ({ chat: () => "local-test-model" }) }));
vi.mock("ai", () => ({ streamText: aiMocks.stream }));
import { assistantStatus, handleAssistant } from "@/lib/ai/assistant.server";
let directory: string;
let cookieA: string;
let cookieB: string;
let ownerA: string;
let ownerB: string;
let recovery: string;
let token: string;
const password = "Local-test-password-123";
async function call(body: unknown, cookie?: string, origin = "http://localhost:8080") {
  return handleLocalApi(
    new Request("http://localhost:8080/api/local", {
      method: "POST",
      headers: { "content-type": "application/json", origin, ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );
}
beforeAll(async () => {
  mkdirSync("data", { recursive: true });
  directory = mkdtempSync(resolve("data/local-test-"));
  vi.stubEnv("LOCAL_DATA_DIR", directory);
  vi.stubEnv("VITE_BACKEND", "local");
  const register = async (email: string) => {
    const r = await call({ op: "auth:signup", email, password, name: "Teste" });
    expect(r.status).toBe(200);
    return { cookie: r.headers.get("set-cookie")!.split(";")[0]!, data: (await r.json()).data };
  };
  const a = await register("a@test.example");
  cookieA = a.cookie;
  ownerA = a.data.user.id;
  recovery = a.data.recovery_code;
  token = a.data.session.access_token;
  const b = await register("b@test.example");
  cookieB = b.cookie;
  ownerB = b.data.user.id;
});
afterAll(() => {
  closeLocalDatabase();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

describe("backend local real sem Supabase", () => {
  it("cria conta, perfil e sessão privada sem registrar senha em texto", async () => {
    const stored = localDatabase()
      .prepare("SELECT password,recovery FROM users WHERE id=?")
      .get(ownerA) as { password: string; recovery: string };
    expect(stored.password).not.toContain(password);
    expect(stored.recovery).not.toBe(recovery);
    expect(cookieA).toContain("studymind_session=");
    const r = await call({ op: "profile" }, cookieA);
    expect(r.status).toBe(200);
    expect((await r.json()).data.display_name).toBe("Teste");
    expect(verifyLocalBearer(token)?.user.id).toBe(ownerA);
    expect(verifyLocalBearer(token + "invalid")).toBeNull();
    const r2 = await call({
      op: "auth:login",
      email: "a@test.example",
      password: "wrong-password",
    });
    expect(r2.status).toBe(401);
  });
  it("recusa chamadas anônimas e requisições de outros sites", async () => {
    expect((await call({ op: "profile" })).status).toBe(401);
    expect((await call({ op: "profile" }, cookieA, "https://attacker.example")).status).toBe(403);
  });
  it("persiste dados depois de fechar a conexão e isola as contas", async () => {
    const id = crypto.randomUUID();
    expect(
      (
        await call(
          { op: "insert", table: "subjects", row: { id, name: "Matemática", color: "indigo" } },
          cookieA,
        )
      ).status,
    ).toBe(200);
    closeLocalDatabase();
    const a = await call({ op: "get", table: "subjects", id }, cookieA);
    expect((await a.json()).data.name).toBe("Matemática");
    const b = await call({ op: "get", table: "subjects", id }, cookieB);
    expect((await b.json()).data).toBeNull();
    const update = await call(
      { op: "update", table: "subjects", id, patch: { name: "Invadida" } },
      cookieB,
    );
    expect(update.status).toBe(404);
    const attack = await call(
      {
        op: "insert",
        table: "flashcards",
        row: {
          subject_id: id,
          front: "Q",
          back: "A",
          due_date: "2026-11-17",
          interval_days: 0,
          ease: 2.5,
          reps: 0,
        },
      },
      cookieB,
    );
    expect(attack.status).toBe(404);
  });
  it("registra uma sessão só uma vez e mantém métricas após excluir vínculos", async () => {
    const repo = createLocalRepo(ownerA);
    const id = crypto.randomUUID();
    await repo.insert("subjects", { id, name: "Foco", color: "indigo" });
    const row = {
      client_id: crypto.randomUUID(),
      subject_id: id,
      task_id: null,
      title: "Estudo",
      started_at: "2026-11-17T12:00:00Z",
      ended_at: "2026-11-17T12:25:00Z",
      minutes: 25,
    };
    await Promise.all([repo.recordSession(row), repo.recordSession(row)]);
    expect(await repo.list("study_sessions")).toHaveLength(1);
    await repo.remove("subjects", id);
    expect((await repo.list("study_sessions"))[0]?.subject_id).toBeNull();
  });
  it("guarda arquivos privados e permite download apenas ao proprietário", async () => {
    const repo = createLocalRepo(ownerA);
    const id = crypto.randomUUID();
    await repo.insert("materials", { id, name: "Notas", kind: "txt", content: "Texto" });
    const form = new FormData();
    form.set("materialId", id);
    form.set("file", new File(["Original"], "notas.txt", { type: "text/plain" }));
    const uploaded = await handleLocalApi(
      new Request("http://localhost:8080/api/local", {
        method: "POST",
        headers: { cookie: cookieA, origin: "http://localhost:8080" },
        body: form,
      }),
    );
    expect(uploaded.status).toBe(200);
    const file = (await repo.list("material_files"))[0]!;
    expect(await (await repo.downloadMaterialFile(file.id)).text()).toBe("Original");
    await expect(createLocalRepo(ownerB).downloadMaterialFile(file.id)).rejects.toThrow(
      "Arquivo não encontrado",
    );
    await repo.remove("materials", id);
    expect(await repo.list("material_files")).toHaveLength(0);
  });
  it("importa backup validado em transação com IDs novos", async () => {
    const id = crypto.randomUUID();
    const backup = {
      app: "studymind",
      version: 1,
      exported_at: new Date().toISOString(),
      profile: {
        display_name: "Importado",
        course: "Curso",
        objective: "Meta",
        weekly_hours: 5,
        availability: [60, 60, 60, 60, 60, 0, 0],
      },
      subjects: [{ id, name: "Importada", color: "indigo" }],
      tasks: [],
      sessions: [],
      flashcards: [],
      goals: [],
      materials: [],
      quiz_answers: [],
    };
    const r = await call({ op: "import", backup }, cookieA);
    expect(r.status).toBe(200);
    const repo = createLocalRepo(ownerA);
    expect((await repo.getProfile()).display_name).toBe("Importado");
    expect((await repo.list("subjects")).find((x) => x.name === "Importada")?.id).not.toBe(id);
    const bad = await call(
      { op: "import", backup: { ...backup, profile: { ...backup.profile, weekly_hours: 0 } } },
      cookieA,
    );
    expect(bad.status).toBe(400);
    expect((await repo.list("subjects")).filter((x) => x.name === "Importada")).toHaveLength(1);
  });
  it("autentica a API de IA com Bearer local sem consultar Supabase", async () => {
    vi.stubEnv("AI_API_KEY", "provider-test-key");
    vi.stubEnv("AI_BASE_URL", "http://localhost:11434/v1");
    vi.stubEnv("AI_MODEL", "test-model");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    expect(await assistantStatus().json()).toEqual({ configured: true });
    aiMocks.stream.mockReturnValue({ text: Promise.resolve("Explicação do modelo de teste.") });
    const make = (bearer: string) =>
      new Request("http://localhost:8080/api/assistant", {
        method: "POST",
        headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "Explique frações" }] }),
      });
    expect((await handleAssistant(make("invalid"))).status).toBe(401);
    expect(aiMocks.stream).not.toHaveBeenCalled();
    const response = await handleAssistant(make(token));
    expect(response.status).toBe(200);
    expect((await response.json()).text).toBe("Explicação do modelo de teste.");
  });
  it("aplica cotas locais de IA sem chave administrativa de Supabase", async () => {
    vi.stubEnv("AI_DAILY_REQUEST_LIMIT", "1");
    vi.stubEnv("AI_MONTHLY_REQUEST_LIMIT", "2");
    await reserveUsage(ownerB);
    await expect(reserveUsage(ownerB)).rejects.toThrow("USAGE_LIMIT");
  });
  it("recupera a senha com código, revoga sessões e impede reutilização", async () => {
    const invalid = await call({
      op: "auth:recover",
      email: "a@test.example",
      password: "new-password-123",
      code: "invalid",
    });
    expect(invalid.status).toBe(401);
    const r = await call({
      op: "auth:recover",
      email: "a@test.example",
      password: "new-password-123",
      code: recovery,
    });
    expect(r.status).toBe(200);
    expect((await r.json()).data.recovery_code).not.toBe(recovery);
    expect(verifyLocalBearer(token)).toBeNull();
    expect((await call({ op: "profile" }, cookieA)).status).toBe(401);
    expect(
      (
        await call({
          op: "auth:recover",
          email: "a@test.example",
          password: "another-password",
          code: recovery,
        })
      ).status,
    ).toBe(401);
    expect(
      (await call({ op: "auth:login", email: "a@test.example", password: "new-password-123" }))
        .status,
    ).toBe(200);
  });
  it("sair revoga a sessão no servidor", async () => {
    expect((await call({ op: "auth:logout" }, cookieB)).status).toBe(200);
    expect((await call({ op: "profile" }, cookieB)).status).toBe(401);
  });
});

it("persiste feedback sem Gmail e mantém o protocolo após reabrir SQLite", async () => {
  vi.stubEnv("GMAIL_APP_PASSWORD", "");
  vi.stubEnv("GMAIL_REFRESH_TOKEN", "");
  const login = await call({
    op: "auth:login",
    email: "a@test.example",
    password: "new-password-123",
  });
  const activeToken = (await login.json()).data.session.access_token;
  const response = await handleFeedback(
    new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: { authorization: `Bearer ${activeToken}` },
      body: JSON.stringify({
        name: "Teste Local",
        email: "teste@gmail.com",
        category: "Problema",
        message: "Não consigo usar o calendário",
      }),
    }),
  );
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result).toMatchObject({ saved: true, sent: false });
  closeLocalDatabase();
  const row = localDatabase().prepare("SELECT * FROM app_feedback WHERE id=?").get(result.id);
  expect(row).toMatchObject({
    user_id: ownerA,
    name: "Teste Local",
    message: "Não consigo usar o calendário",
  });
});
