import { isAuthConfigured, backendMode } from "@/lib/auth-config";
import { AuthCard } from "@/components/auth/AuthCard";
import { BackLink } from "@/components/navigation/BackLink";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { auth } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/reset-password")({
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
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!isAuthConfigured()) return;
    let active = true;
    void auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMsg("Não foi possível validar o link. Solicite uma nova recuperação.");
        else setReady(Boolean(data.session));
      })
      .catch(() => {
        if (active) setMsg("Não foi possível validar sua sessão. Tente novamente.");
      });
    const { data } = auth.onAuthStateChange((e) => {
      if (e === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    if (password.length < 8) return setMsg("Use pelo menos 8 caracteres.");
    setMsg("");
    setBusy(true);
    try {
      const { error } = await auth.updateUser({ password });
      if (error) throw error;
      await navigate({ to: "/app/$section", params: { section: "painel" } });
    } catch (error) {
      setMsg((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
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
        {!ready ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Abra esta página pelo link enviado ao seu e-mail.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full rounded-full" disabled={busy}>
              Salvar senha
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
