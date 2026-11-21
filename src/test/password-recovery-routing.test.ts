import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { redirectPasswordRecovery } from "@/lib/auth/recovery-routing";
import { capturePasswordRecovery, finishPasswordRecovery } from "@/lib/auth/recovery";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth/client", () => ({ auth: { getSession: mocks.getSession } }));
vi.mock("@tanstack/react-router", () => ({ redirect: mocks.redirect }));

beforeEach(() => {
  vi.clearAllMocks();
  finishPasswordRecovery();
  vi.stubEnv("VITE_BACKEND", "supabase");
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-key");
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null });
  mocks.redirect.mockReturnValue(new Error("redirect"));
});
afterEach(() => {
  finishPasswordRecovery();
  window.history.replaceState(null, "", "/");
  vi.unstubAllEnvs();
});

describe("destino de links de recuperação", () => {
  it.each(["/", "/login", "/auth/callback", "/app/painel"])(
    "abre nova senha quando o link chega em %s mesmo com sessão ativa",
    async (path) => {
      window.history.replaceState(null, "", `${path}#access_token=test&type=recovery`);
      await expect(redirectPasswordRecovery()).rejects.toThrow("redirect");
      expect(mocks.getSession).toHaveBeenCalledOnce();
      expect(mocks.redirect).toHaveBeenCalledWith({ to: "/reset-password", replace: true });
    },
  );
  it("preserva o propósito quando o SDK remove o fragmento", async () => {
    window.history.replaceState(null, "", "/auth/callback#type=recovery&access_token=test");
    capturePasswordRecovery();
    window.history.replaceState(null, "", "/auth/callback");
    await expect(redirectPasswordRecovery()).rejects.toThrow("redirect");
  });
  it("aguarda a sessão antes de redirecionar para não perder o token", async () => {
    window.history.replaceState(null, "", "/#type=recovery&access_token=test");
    let resolve!: () => void;
    mocks.getSession.mockReturnValueOnce(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const pending = redirectPasswordRecovery();
    expect(mocks.redirect).not.toHaveBeenCalled();
    resolve();
    await expect(pending).rejects.toThrow("redirect");
  });
  it("não interfere em login comum, nem cria loop na tela de nova senha", async () => {
    window.history.replaceState(null, "", "/auth/callback#type=signup");
    await redirectPasswordRecovery();
    window.history.replaceState(null, "", "/reset-password#type=recovery");
    await redirectPasswordRecovery();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();
  });
  it("libera a navegação depois de salvar a senha", async () => {
    window.history.replaceState(null, "", "/reset-password#type=recovery");
    capturePasswordRecovery();
    window.history.replaceState(null, "", "/app/painel");
    finishPasswordRecovery();
    await redirectPasswordRecovery();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

it("não redireciona novamente enquanto a navegação para nova senha ainda está pendente", async () => {
  window.history.replaceState(null, "", "/#type=recovery&access_token=test");
  await redirectPasswordRecovery("/reset-password");
  expect(mocks.redirect).not.toHaveBeenCalled();
});
