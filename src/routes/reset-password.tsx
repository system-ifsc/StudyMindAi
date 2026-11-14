import { BackLink } from "@/components/navigation/BackLink";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setReady(true);
    const { data } = supabase.auth.onAuthStateChange((e) => {
      if (e === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    if (password.length < 8) return setMsg("Use pelo menos 8 caracteres.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setMsg(error.message);
    navigate({ to: "/app/$section", params: { section: "painel" } });
  }
  return (
    <main className="grid min-h-screen place-items-center plasma-page px-4">
      <div className="glass-panel w-full max-w-md rounded-3xl border bg-card p-8 shadow-elevated">
        <Logo />
        <BackLink to="/login" label="Voltar ao login" className="mt-4" />
        <h1 className="mt-8 text-3xl font-semibold">Definir nova senha</h1>
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
            {msg && (
              <p role="alert" className="text-sm text-destructive">
                {msg}
              </p>
            )}
            <Button type="submit" className="w-full rounded-full">
              Salvar senha
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
