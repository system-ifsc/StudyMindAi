import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  resend: vi.fn(),
  recover: vi.fn(),
  getSession: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  createFileRoute: () => (options: { component: () => ReactNode }) => options,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/lib/auth/client", () => ({ auth: mocks, recoverLocalPassword: mocks.recover }));
import { finishPasswordRecovery } from "@/lib/auth/recovery";
import { Route as CallbackRoute } from "@/routes/auth.callback";
import { AuthCard } from "@/components/auth/AuthCard";
import { Route as ResetRoute } from "@/routes/reset-password";
const ResetPage = (ResetRoute as unknown as { component: () => ReactNode }).component;

beforeEach(() => {
  vi.clearAllMocks();
  finishPasswordRecovery();
  window.history.replaceState(null, "", "/");
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  vi.stubEnv("VITE_BACKEND", "supabase");
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-key");
  vi.stubEnv("VITE_GOOGLE_AUTH_ENABLED", "true");
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function fill(mode: "login" | "cadastro") {
  render(<AuthCard mode={mode} />);
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "student@example.com" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "test-password-123" } });
  if (mode === "cadastro")
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Estudante" } });
}

describe("autenticação direta no Supabase", () => {
  it("cria conta e aguarda confirmação sem fingir que o usuário está autenticado", async () => {
    mocks.signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
    fill("cadastro");
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    await screen.findByText(/enviamos um link de confirmação/);
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "student@example.com",
      password: "test-password-123",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback",
        data: { name: "Estudante" },
      },
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("abre onboarding quando o backend entrega uma sessão no cadastro", async () => {
    mocks.signUp.mockResolvedValueOnce({
      data: { session: { access_token: "test" } },
      error: null,
    });
    fill("cadastro");
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/onboarding" }));
  });
  it("informa falha real do cadastro e libera nova tentativa", async () => {
    mocks.signUp.mockResolvedValueOnce({ data: {}, error: new Error("Email rate limit exceeded") });
    fill("cadastro");
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "serviço de e-mail atingiu o limite",
    );
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeEnabled();
  });
  it("entra com senha e abre o painel", async () => {
    mocks.signInWithPassword.mockResolvedValueOnce({ error: null });
    fill("login");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: "/app/$section",
        params: { section: "painel" },
      }),
    );
  });
  it("redireciona Google pelo Supabase sem um intermediário", async () => {
    mocks.signInWithOAuth.mockResolvedValueOnce({ error: null });
    render(<AuthCard mode="login" />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar com Google" }));
    await waitFor(() =>
      expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: "http://localhost:3000/auth/callback" },
      }),
    );
  });
  it("envia recuperação para a tela que valida a sessão", async () => {
    mocks.resetPasswordForEmail.mockResolvedValueOnce({ error: null });
    fill("login");
    fireEvent.click(screen.getByRole("button", { name: "Esqueci a senha" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar link" }));
    await screen.findByText(/Se houver conta/);
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("student@example.com", {
      redirectTo: "http://localhost:3000/reset-password",
    });
  });
  it("não envia cadastro se a configuração está ausente", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    fill("cadastro");
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeDisabled();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
});

it("mostra o código da conta local antes de continuar para o onboarding", async () => {
  vi.stubEnv("VITE_BACKEND", "local");
  mocks.signUp.mockResolvedValueOnce({
    data: { session: { access_token: "local-test" }, recovery_code: "codigo-privado-de-teste" },
    error: null,
  });
  fill("cadastro");
  fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
  await screen.findByText("codigo-privado-de-teste");
  expect(mocks.navigate).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Criar conta" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Guardei meu código. Continuar" }));
  expect(mocks.navigate).toHaveBeenCalledWith({ to: "/onboarding" });
});

it("recupera a senha local por código sem prometer envio de e-mail", async () => {
  vi.stubEnv("VITE_BACKEND", "local");
  mocks.recover.mockResolvedValueOnce({ recovery_code: "novo-codigo-privado" });
  render(<AuthCard mode="login" initialForgot />);
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "student@example.com" } });
  fireEvent.change(screen.getByLabelText("Código de recuperação"), {
    target: { value: "codigo-antigo" },
  });
  fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "nova-senha-segura" } });
  fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
    target: { value: "nova-senha-segura" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Redefinir senha" }));
  await screen.findByText("novo-codigo-privado");
  expect(mocks.recover).toHaveBeenCalledWith(
    "student@example.com",
    "codigo-antigo",
    "nova-senha-segura",
  );
  expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
});

describe("redefinição por link", () => {
  it("permite solicitar outro link quando não há sessão", async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    render(<ResetPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("inválido ou expirou");
    fireEvent.click(screen.getByRole("button", { name: "Solicitar novo link" }));
    expect(screen.getByRole("button", { name: "Enviar link" })).toBeEnabled();
  });
  it("valida a confirmação antes de atualizar e confirma o sucesso", async () => {
    mocks.getSession.mockResolvedValueOnce({
      data: { session: { access_token: "test" } },
      error: null,
    });
    mocks.updateUser.mockResolvedValueOnce({ error: null });
    render(<ResetPage />);
    fireEvent.change(await screen.findByLabelText("Nova senha"), {
      target: { value: "nova-senha-segura" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "outra-senha-segura" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar senha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("não coincidem");
    expect(mocks.updateUser).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "nova-senha-segura" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar senha" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Senha alterada e salva com sucesso",
    );
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "nova-senha-segura" });
    mocks.signOut.mockResolvedValueOnce({ error: null });
    fireEvent.click(screen.getByRole("button", { name: "Entrar com nova senha" }));
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ to: "/login", replace: true }),
    );
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
});

it("recusa link com erro mesmo quando existe uma sessão anterior", async () => {
  window.history.replaceState(
    null,
    "",
    "/reset-password#error=access_denied&error_code=otp_expired",
  );
  render(<ResetPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("expirou ou já foi usado");
  expect(mocks.getSession).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
  expect(window.location.hash).toBe("");
});

it("não envia recuperação local se a confirmação divergir", async () => {
  vi.stubEnv("VITE_BACKEND", "local");
  render(<AuthCard mode="login" initialForgot />);
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "student@example.com" } });
  fireEvent.change(screen.getByLabelText("Código de recuperação"), {
    target: { value: "codigo-antigo" },
  });
  fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "nova-senha-segura" } });
  fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
    target: { value: "outra-senha-segura" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Redefinir senha" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("não coincidem");
  expect(mocks.recover).not.toHaveBeenCalled();
});

it("callback de recuperação não abre o painel como um login comum", async () => {
  window.history.replaceState(null, "", "/auth/callback#type=recovery&access_token=test");
  mocks.getSession.mockResolvedValueOnce({
    data: { session: { access_token: "test" } },
    error: null,
  });
  const CallbackPage = (CallbackRoute as unknown as { component: () => ReactNode }).component;
  render(<CallbackPage />);
  await waitFor(() =>
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/reset-password", replace: true }),
  );
  expect(mocks.navigate).not.toHaveBeenCalledWith(expect.objectContaining({ to: "/app/$section" }));
});
