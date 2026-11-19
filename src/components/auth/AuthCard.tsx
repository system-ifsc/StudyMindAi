import { isAuthConfigured, authUnavailableMessage, backendMode } from "@/lib/auth-config";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Brain,
  BookOpen,
  Check,
  Sparkles,
  Eye,
  EyeOff,
  LockKeyhole,
} from "lucide-react";
import { auth, recoverLocalPassword } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import "./auth.css";

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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="auth-app auth-refresh relative min-h-svh">
      <div className="auth-layout">
        <header className="auth-brand-banner">
          <Link to="/" aria-label="StudyMind AI — início" className="auth-brand-link">
            <Brain aria-hidden />
            <span>StudyMind AI</span>
          </Link>
          <div className="auth-story">
            <span className="auth-story-kicker">UM ESPAÇO PARA EVOLUIR</span>
            <h2>
              Seu próximo passo.
              <br />
              <em>Um novo começo.</em>
            </h2>
            <p>
              Organize suas ideias, encontre seu ritmo e transforme cada estudo em uma conquista.
            </p>
          </div>
          <div className="auth-illustration" aria-hidden="true">
            <span className="auth-orbit auth-orbit-one" />
            <span className="auth-orbit auth-orbit-two" />
            <div className="auth-study-sheet">
              <div className="auth-sheet-heading">
                <BookOpen />
                <span>Meu espaço de estudo</span>
                <Sparkles />
              </div>
              <strong>
                Pequenos passos,
                <br />
                grandes descobertas.
              </strong>
              <div className="auth-sheet-task">
                <span>
                  <Check />
                </span>
                Organizar minhas ideias
              </div>
              <div className="auth-sheet-task">
                <span>
                  <Check />
                </span>
                Aprender algo novo
              </div>
              <div className="auth-sheet-task auth-sheet-pending">
                <span />
                Continuar evoluindo
              </div>
              <div className="auth-sheet-rule" />
              <span className="auth-sheet-caption">NO SEU TEMPO. DO SEU JEITO.</span>
            </div>
            <div className="auth-floating-note">
              <Sparkles />
              <span>
                Mais clareza.
                <br />
                <strong>Mais possibilidades.</strong>
              </span>
            </div>
          </div>
          <p className="auth-story-footer">
            <span />
            Seu aprendizado começa com você.
          </p>
        </header>
        <main className="auth-card relative w-full">
          <div>
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
            ) : null}
          </div>
          <span className="auth-eyebrow">
            {forgot
              ? "VAMOS TE AJUDAR"
              : mode === "login"
                ? "BOM TER VOCÊ POR AQUI"
                : "SEU PRÓXIMO CAPÍTULO"}
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {forgot
              ? local
                ? "Informe seu e-mail, o código recebido no cadastro e uma nova senha."
                : "Informe seu e-mail para receber o link."
              : mode === "login"
                ? "Entre para continuar seus estudos."
                : "Crie seu espaço e comece a construir sua rotina de estudos."}
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

          <form onSubmit={submit} className="mt-7 space-y-5" noValidate={false}>
            {mode === "cadastro" && !forgot && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  placeholder="Como podemos te chamar?"
                  required
                  maxLength={80}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                required
              />
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
                <div className="auth-password-field">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={
                      mode === "cadastro" || forgot ? "Crie uma senha segura" : "Sua senha"
                    }
                    autoComplete={mode === "login" && !forgot ? "current-password" : "new-password"}
                    required
                    minLength={mode === "cadastro" || forgot ? 8 : undefined}
                    aria-describedby={mode === "cadastro" ? "pwd-hint" : undefined}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                  </button>
                </div>
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
              {!busy && <ArrowRight className="auth-submit-arrow size-4" aria-hidden />}
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
          <div className="auth-security-note">
            <LockKeyhole aria-hidden />
            <span>Seu espaço de estudo, só seu.</span>
          </div>
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
