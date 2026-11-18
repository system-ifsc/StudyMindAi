import { isAuthConfigured, authUnavailableMessage, backendMode } from "@/lib/auth-config";
import { BackLink } from "@/components/navigation/BackLink";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { auth, recoverLocalPassword } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";

const GoogleG = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
    />
  </svg>
);

function translate(msg: string) {
  if (/invalid login/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg))
    return "Confirme seu e-mail antes de entrar (verifique a caixa de entrada e o spam).";
  if (/already registered/i.test(msg)) return "Este e-mail já tem conta. Faça login.";
  if (/password/i.test(msg) && /least|short|weak/i.test(msg))
    return "Senha fraca: use pelo menos 8 caracteres.";
  if (/rate limit/i.test(msg)) return "Muitas tentativas. Aguarde alguns minutos.";
  if (/fetch|network|connection/i.test(msg))
    return "Não foi possível conectar. Confira sua conexão e tente novamente.";
  return msg;
}

export function AuthCard({
  mode,
  initialForgot = false,
}: {
  mode: "login" | "cadastro";
  initialForgot?: boolean;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [forgot, setForgot] = useState(initialForgot);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const local = backendMode() === "local";
  const googleEnabled = !local && import.meta.env["VITE_GOOGLE_AUTH_ENABLED"] === "true";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mode === "cadastro" && recoveryCode) return;
    if (!isAuthConfigured()) return setError(authUnavailableMessage);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") || "").trim();
    const password = String(f.get("password") || "");
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (forgot) {
        if (local) {
          const result = await recoverLocalPassword(
            email,
            String(f.get("recovery") || "").trim(),
            password,
          );
          setRecoveryCode(result.recovery_code);
          setForgot(false);
          setInfo(
            "Senha alterada. Guarde seu novo código de recuperação e entre com a nova senha.",
          );
          return;
        }
        const { error } = await auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setInfo("Se houver conta com este e-mail, enviamos um link para redefinir a senha.");
      } else if (mode === "cadastro") {
        if (password.length < 8) throw new Error("Senha fraca: use pelo menos 8 caracteres.");
        const name = String(f.get("name") || "").trim();
        if (!name) throw new Error("Informe seu nome.");
        const { data, error } = await auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { name } },
        });
        if (error) throw error;
        if (local && "recovery_code" in data && data.recovery_code) {
          setRecoveryCode(String(data.recovery_code));
          setInfo(
            "Conta criada! Guarde seu código de recuperação em um lugar seguro. Você precisará dele se esquecer sua senha.",
          );
        } else if (data.session) navigate({ to: "/onboarding" });
        else {
          setConfirmationEmail(email);
          setInfo(
            "Confira seu e-mail: enviamos um link de confirmação se o cadastro estiver disponível para esse endereço. Se já tiver conta, faça login.",
          );
        }
      } else {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app/$section", params: { section: "painel" } });
      }
    } catch (err) {
      setError(translate((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!confirmationEmail || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await auth.resend({
        type: "signup",
        email: confirmationEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setInfo("Solicitação enviada. Confira sua caixa de entrada e o spam.");
    } catch (err) {
      setError(translate((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    if (!isAuthConfigured()) return setError(authUnavailableMessage);
    setError("");
    setBusy(true);
    try {
      const { error } = await auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (err) {
      setError(translate((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const title = forgot
    ? "Recuperar senha"
    : mode === "login"
      ? "Bem-vindo de volta"
      : "Crie sua conta";
  return (
    <div className="plasma-page relative flex min-h-screen items-center px-4 py-10 sm:px-6">
      <div className="bg-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="hidden rounded-[2rem] border bg-brand p-10 text-primary-foreground shadow-elevated lg:block">
          <Logo />
          <p className="mt-16 text-eyebrow text-primary-foreground/70">Sua rotina, com clareza</p>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight">
            Menos improviso. Mais progresso.
          </h2>
          <p className="mt-4 text-sm leading-6 text-primary-foreground/80">
            Organize seu tempo, transforme prazos em próximos passos e acompanhe o que realmente
            está funcionando.
          </p>
          <div className="mt-10 space-y-3 text-sm text-primary-foreground/90">
            {[
              "Planejamento por prazo",
              "Foco e revisão no mesmo lugar",
              "Dados privados por conta",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span className="grid size-6 place-items-center rounded-full bg-white/15 text-xs">
                  ✓
                </span>
                {item}
              </div>
            ))}
          </div>
        </aside>
        <main className="glass-panel relative w-full rounded-[2rem] border bg-card p-6 shadow-elevated sm:p-8">
          <Logo />
          <div className="mt-4">
            {forgot ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setForgot(false);
                  setError("");
                  setInfo("");
                }}
              >
                <ArrowLeft aria-hidden /> Voltar ao login
              </Button>
            ) : (
              <BackLink />
            )}
          </div>
          <h1 className="mt-8 text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {forgot
              ? local
                ? "Informe seu e-mail, o código recebido no cadastro e uma nova senha."
                : "Informe seu e-mail para receber o link."
              : mode === "login"
                ? "Entre para continuar seus estudos."
                : "Seus dados ficam protegidos e visíveis só para você."}
          </p>

          {!isAuthConfigured() && (
            <p role="status" className="mt-6 rounded-lg bg-muted p-3 text-sm">
              {authUnavailableMessage}
            </p>
          )}

          {!forgot && googleEnabled && (
            <>
              <Button
                type="button"
                variant="outline"
                className="mt-6 h-11 w-full gap-2.5 rounded-full"
                onClick={google}
                disabled={busy || !isAuthConfigured()}
              >
                <GoogleG /> Continuar com Google
              </Button>
              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                ou com e-mail
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form onSubmit={submit} className="space-y-4" noValidate={false}>
            {mode === "cadastro" && !forgot && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" autoComplete="name" required maxLength={80} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            {forgot && local && (
              <div className="space-y-1.5">
                <Label htmlFor="recovery">Código de recuperação</Label>
                <Input id="recovery" name="recovery" autoComplete="off" required maxLength={128} />
              </div>
            )}
            {(!forgot || local) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{forgot ? "Nova senha" : "Senha"}</Label>
                  {mode === "login" && !forgot && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => {
                        setForgot(true);
                        setError("");
                      }}
                    >
                      Esqueci a senha
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === "login" && !forgot ? "current-password" : "new-password"}
                  required
                  minLength={mode === "cadastro" || forgot ? 8 : undefined}
                  aria-describedby={mode === "cadastro" ? "pwd-hint" : undefined}
                />
                {mode === "cadastro" && (
                  <p id="pwd-hint" className="text-xs text-muted-foreground">
                    Mínimo de 8 caracteres.
                  </p>
                )}
              </div>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            {info && (
              <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                {info}
              </p>
            )}
            {recoveryCode && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-semibold">Código de recuperação — guarde agora</p>
                <code className="block break-all select-all text-sm">{recoveryCode}</code>
                {mode === "cadastro" && (
                  <Button type="button" onClick={() => navigate({ to: "/onboarding" })}>
                    Guardei meu código. Continuar
                  </Button>
                )}
              </div>
            )}
            {confirmationEmail && !forgot && (
              <Button type="button" variant="outline" disabled={busy} onClick={resendConfirmation}>
                Reenviar confirmação
              </Button>
            )}
            <Button
              type="submit"
              className="h-11 w-full rounded-full"
              disabled={busy || !isAuthConfigured() || (mode === "cadastro" && !!recoveryCode)}
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {forgot
                ? local
                  ? "Redefinir senha"
                  : "Enviar link"
                : mode === "login"
                  ? "Entrar"
                  : "Criar conta"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {forgot ? (
              <button className="text-primary hover:underline" onClick={() => setForgot(false)}>
                Voltar ao login
              </button>
            ) : mode === "login" ? (
              <>
                Ainda não tem conta?{" "}
                <Link to="/cadastro" className="text-primary hover:underline">
                  Cadastre-se
                </Link>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Entrar
                </Link>
              </>
            )}
          </p>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Só quer conhecer?{" "}
            <Link to="/demo/$section" params={{ section: "painel" }} className="underline">
              Abrir demonstração
            </Link>{" "}
            (dados fictícios).
          </p>
        </main>
      </div>
    </div>
  );
}
