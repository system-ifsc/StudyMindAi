import { finishPasswordRecovery } from "@/lib/auth/recovery";
import { isAuthConfigured, backendMode, authUnavailableMessage } from "@/lib/auth-config";
import { AuthCard } from "@/components/auth/AuthCard";
import { BackLink } from "@/components/navigation/BackLink";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { auth } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage, passwordResetError } from "@/lib/core/auth-errors";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nova senha — StudyMind AI" },
      { name: "description", content: "Defina uma nova senha." },
      { property: "og:title", content: "Nova senha — StudyMind AI" },
      { property: "og:description", content: "Defina uma nova senha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

function Reset() {
  return backendMode() === "local" ? <AuthCard mode="login" initialForgot /> : <CloudReset />;
}
function CloudReset() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [requestNew, setRequestNew] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!isAuthConfigured()) {
      setMsg(authUnavailableMessage);
      setChecking(false);
      return;
    }
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    if (query.has("error") || fragment.has("error")) {
      setMsg("O link de recuperação expirou ou já foi usado. Solicite um novo link.");
      setChecking(false);
      window.history.replaceState(null, "", "/reset-password");
      return;
    }
    let active = true;
    void auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMsg("Não foi possível validar o link. Solicite uma nova recuperação.");
        else if (data.session) {
          setReady(true);
          window.history.replaceState(null, "", "/reset-password");
        } else setMsg("O link de recuperação é inválido ou expirou. Solicite um novo link.");
        setChecking(false);
      })
      .catch(() => {
        if (active) {
          setMsg(
            "Não foi possível validar sua sessão. Confira sua conexão e abra o link novamente.",
          );
          setChecking(false);
        }
      });
    const { data } = auth.onAuthStateChange((e) => {
      if (active && e === "PASSWORD_RECOVERY") {
        setReady(true);
        setChecking(false);
        setMsg("");
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !ready || saved) return;
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") || "");
    const validation = passwordResetError(password, String(form.get("confirmation") || ""));
    if (validation) return setMsg(validation);
    setMsg("");
    setBusy(true);
    try {
      const { error } = await auth.updateUser({ password });
      if (error) throw error;
      finishPasswordRecovery();
      setSaved(true);
    } catch (error) {
      setMsg(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function loginWithNewPassword() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const { error } = await auth.signOut();
      if (error) throw error;
      await navigate({ to: "/login", replace: true });
    } catch {
      setMsg(
        "Sua nova senha já foi salva. Não foi possível encerrar a sessão; tente novamente para entrar com ela.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (requestNew) return <AuthCard mode="login" initialForgot />;
  return (
    <main className="grid min-h-screen place-items-center plasma-page px-4">
      <div className="glass-panel w-full max-w-md rounded-3xl border bg-card p-8 shadow-elevated">
        <Logo />
        <BackLink to="/login" label="Voltar ao login" className="mt-4" />
        <h1 className="mt-8 text-3xl font-semibold">Definir nova senha</h1>
        {msg && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {msg}
          </p>
        )}
        {saved ? (
          <div className="mt-6 space-y-4">
            <p role="status">Senha alterada e salva com sucesso. Entre com sua nova senha.</p>
            <Button className="w-full" disabled={busy} onClick={loginWithNewPassword}>
              Entrar com nova senha
            </Button>
          </div>
        ) : checking ? (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            Validando seu link…
          </p>
        ) : !ready ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Abra o link completo do e-mail mais recente para definir uma nova senha.
            </p>
            <Button disabled={!isAuthConfigured()} onClick={() => setRequestNew(true)}>
              Solicitar novo link
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <p className="text-xs text-muted-foreground">Use pelo menos 8 caracteres.</p>
            <div className="space-y-1.5">
              <Label htmlFor="confirmation">Confirmar nova senha</Label>
              <Input
                id="confirmation"
                name="confirmation"
                type={showPassword ? "text" : "password"}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Ocultar senhas" : "Mostrar senhas"}
            </Button>
            <Button type="submit" className="w-full rounded-full" disabled={busy}>
              {busy ? "Salvando…" : "Salvar senha"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
