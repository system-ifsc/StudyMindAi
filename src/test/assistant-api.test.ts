import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  stream: vi.fn(),
  client: vi.fn(),
  provider: vi.fn(),
  reserve: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.client }));
vi.mock("@/lib/repo/cloud", () => ({
  createCloudRepo: () => ({ get: mocks.get, list: mocks.list }),
}));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: mocks.provider }));
vi.mock("ai", () => ({ streamText: mocks.stream }));
vi.mock("@/lib/ai/usage.server", () => ({
  reserveUsage: mocks.reserve,
  usageConfigured: () => true,
}));
import { assistantStatus, handleAssistant } from "@/lib/ai/assistant.server";

const id = "11111111-1111-4111-8111-111111111111";
function request(body: unknown, token = "test-token") {
  return new Request("https://studymind.test/api/assistant", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
describe("API autenticada de estudos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_BACKEND", "supabase");
    vi.stubEnv("AI_API_KEY", "test-server-secret");
    vi.stubEnv("AI_BASE_URL", "https://provider.example/v1");
    vi.stubEnv("AI_MODEL", "test-model");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-key");
    mocks.client.mockReturnValue({ auth: { getUser: mocks.getUser } });
    mocks.getUser.mockResolvedValue({ data: { user: { id: crypto.randomUUID() } } });
    mocks.provider.mockReturnValue({ chat: () => "test-model" });
    mocks.stream.mockReturnValue({
      text: Promise.resolve('{"type":"text","title":"Resumo","content":"O núcleo contém DNA."}'),
    });
    mocks.get.mockResolvedValue({
      id,
      name: "Biologia",
      kind: "txt",
      content: "O núcleo contém DNA.",
    });
    mocks.list.mockResolvedValue([]);
    mocks.reserve.mockResolvedValue(vi.fn().mockResolvedValue(undefined));
  });
  afterEach(() => vi.unstubAllEnvs());
  it("explica saldo esgotado retornado pelo provedor durante a geração", async () => {
    mocks.stream.mockImplementationOnce((options) => {
      options.onError({
        error: {
          statusCode: 429,
          data: { error: { code: "credit_balance_exhausted" } },
        },
      });
      return { text: Promise.resolve("") };
    });
    const response = await handleAssistant(
      request({ action: "generate", tool: "summary", material_id: id }),
    );
    expect(response.status).toBe(429);
    expect((await response.json()).error).toContain("créditos de API");
  });
  it("recusa cota distribuída esgotada antes de chamar o modelo", async () => {
    mocks.reserve.mockRejectedValueOnce(new Error("USAGE_LIMIT"));
    expect(
      (await handleAssistant(request({ messages: [{ role: "user", content: "Oi" }] }))).status,
    ).toBe(429);
    expect(mocks.stream).not.toHaveBeenCalled();
  });
  it("informa falta de configuração e nunca fabrica resposta", async () => {
    vi.stubEnv("AI_API_KEY", "");
    expect(await assistantStatus().json()).toEqual({ configured: false });
    expect(
      (await handleAssistant(request({ action: "generate", tool: "summary", material_id: id })))
        .status,
    ).toBe(503);
    expect(mocks.stream).not.toHaveBeenCalled();
  });
  it("recusa token inválido antes de consultar materiais ou modelo", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect(
      (await handleAssistant(request({ messages: [{ role: "user", content: "Oi" }] }))).status,
    ).toBe(401);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.stream).not.toHaveBeenCalled();
  });
  it("limita bytes do corpo antes de chamar o modelo", async () => {
    const response = await handleAssistant(
      request({ messages: [{ role: "user", content: "x".repeat(300001) }] }),
    );
    expect(response.status).toBe(413);
    expect(mocks.stream).not.toHaveBeenCalled();
  });
  it("aplica modo, nível e fonte verificada pelo repositório", async () => {
    const response = await handleAssistant(
      request({
        messages: [{ role: "user", content: "Explique" }],
        mode: "review",
        level: "simple",
        material_id: id,
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ sources: [{ id, name: "Biologia" }] });
    expect(mocks.stream.mock.calls[0]![0].instructions).toContain("Modo revisão");
    expect(mocks.stream.mock.calls[0]![0].instructions).toContain("Nível introdutório");
    expect(mocks.stream.mock.calls[0]![0].maxOutputTokens).toBe(4000);
  });
  it("usa o bearer do usuário nas consultas com RLS e recusa material inacessível", async () => {
    mocks.get.mockResolvedValue(null);
    const response = await handleAssistant(
      request({ action: "generate", tool: "summary", material_id: id }),
    );
    expect(response.status).toBe(404);
    expect(mocks.client).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "public-key",
      expect.objectContaining({ global: { headers: { Authorization: "Bearer test-token" } } }),
    );
    expect(mocks.get).toHaveBeenCalledWith("materials", id);
    expect(mocks.stream).not.toHaveBeenCalled();
  });
  it("analisa conteúdo integral sem truncar silenciosamente documentos longos", async () => {
    mocks.get.mockResolvedValue({ name: "Longo", content: "x".repeat(60001) });
    expect(
      (await handleAssistant(request({ action: "generate", tool: "summary", material_id: id })))
        .status,
    ).toBe(400);
    expect(mocks.stream).not.toHaveBeenCalled();
  });
  it("retorna apenas saída gerada e validada", async () => {
    const response = await handleAssistant(
      request({ action: "generate", tool: "summary", material_id: id }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      output: { type: "text", title: "Resumo", content: "O núcleo contém DNA." },
    });
    expect(mocks.stream.mock.calls[0]![0].messages[0].content).toContain("O núcleo contém DNA.");
  });
  it("recusa conteúdo inválido sem salvar ou apresentar atividade falsa", async () => {
    mocks.stream.mockReturnValue({ text: Promise.resolve('{"type":"flashcards","cards":[]}') });
    expect(
      (await handleAssistant(request({ action: "generate", tool: "flashcards", material_id: id })))
        .status,
    ).toBe(502);
  });
  it("consulta progresso somente quando solicitado", async () => {
    const response = await handleAssistant(
      request({ messages: [{ role: "user", content: "O que revisar?" }], include_progress: true }),
    );
    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith("flashcards");
    expect(mocks.list).toHaveBeenCalledWith("quiz_answers");
    expect(mocks.list).toHaveBeenCalledWith("study_sessions");
  });
  it("trata falha de autenticação e falha de leitura sem chamar modelo", async () => {
    mocks.getUser.mockRejectedValueOnce(new Error("network"));
    expect(
      (await handleAssistant(request({ messages: [{ role: "user", content: "Oi" }] }))).status,
    ).toBe(502);
    mocks.get.mockRejectedValueOnce(new Error("db"));
    expect(
      (await handleAssistant(request({ action: "generate", tool: "summary", material_id: id })))
        .status,
    ).toBe(502);
    expect(mocks.stream).not.toHaveBeenCalled();
  });
});
