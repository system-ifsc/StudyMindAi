import { useEffect, useRef, useState, type FormEvent } from "react";
import { PageHeader, Panel } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth } from "@/lib/auth/client";
import { useRepo } from "@/hooks/use-data";
import { FEEDBACK_EMAIL, feedbackCategories, feedbackSchema } from "@/lib/core/feedback";

export function Feedback() {
  const repo = useRepo();
  const demo = repo.mode === "demo";
  const [category, setCategory] = useState<string>("Opinião");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const submitting = useRef(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => {
    setConfigured(null);
    if (demo) return;
    const controller = new AbortController();
    fetch("/api/feedback", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Status indisponível");
        return r.json();
      })
      .then((data) => setConfigured(data.configured === true))
      .catch(() => {
        if (!controller.signal.aborted) setConfigured(false);
      });
    return () => controller.abort();
  }, [demo]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSent(false);
    const parsed = feedbackSchema.safeParse({ name, email, category, message });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira os dados do formulário.");
      return;
    }
    if (demo || !configured || submitting.current) return;
    submitting.current = true;
    setSending(true);
    try {
      const { data } = await auth.getSession();
      if (!data.session) throw new Error("Entre na sua conta para enviar feedback.");
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(35000),
      });
      const result = await response.json();
      if (!response.ok || result.saved !== true || result.sent !== true)
        throw new Error(result.error || "Não foi possível enviar seu feedback.");
      setMessage("");
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar. Tente novamente.");
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Feedback"
        description="Conte o que achou do app e o que podemos melhorar."
      />
      <Panel title="Sua opinião ajuda a melhorar o StudyMind" className="max-w-2xl">
        <p className="mb-5 text-sm text-muted-foreground">
          Seu feedback será registrado no app. Quando o envio por e-mail estiver disponível, uma
          cópia também será encaminhada para {FEEDBACK_EMAIL}. Ao enviar, você compartilha seu nome,
          e-mail e mensagem com a equipe.
        </p>
        {demo ? (
          <p role="note" className="mb-4 text-sm">
            No modo demonstração, nenhum feedback é enviado. Entre na sua conta para participar.
          </p>
        ) : configured === null ? (
          <p role="status" className="mb-4 text-sm">
            Verificando disponibilidade do envio…
          </p>
        ) : (
          !configured && (
            <p role="status" className="mb-4 text-sm">
              O contato pelo app está temporariamente indisponível. Tente novamente mais tarde.
            </p>
          )
        )}
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="feedback-name">Seu nome</Label>
            <Input
              id="feedback-name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSent(false);
              }}
              required
              minLength={2}
              maxLength={120}
              disabled={sending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-email">Seu e-mail</Label>
            <Input
              id="feedback-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setSent(false);
              }}
              required
              maxLength={254}
              placeholder="seunome@gmail.com"
              disabled={sending}
              aria-describedby="feedback-email-help"
            />
            <p id="feedback-email-help" className="text-xs text-muted-foreground">
              Usaremos este endereço para responder ao seu contato.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-category">Tipo de feedback</Label>
            <select
              id="feedback-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSent(false);
              }}
              disabled={sending}
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
            >
              {feedbackCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-message">Sua mensagem</Label>
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setSent(false);
              }}
              disabled={sending}
              required
              minLength={10}
              maxLength={5000}
              rows={7}
              className="h-44 min-h-44 max-h-44 resize-none overflow-y-auto"
              placeholder="O que você gostou? O que faria diferença nos seus estudos? Encontrou algum problema?"
              aria-describedby="feedback-count"
            />
            <p id="feedback-count" className="text-xs text-muted-foreground">
              {message.length}/5000 caracteres · mínimo de 10
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {sent && (
            <p role="status" className="text-sm font-medium text-primary">
              Feedback recebido!
            </p>
          )}
          <Button type="submit" disabled={demo || !configured || sending}>
            {sending ? "Enviando…" : "Enviar feedback"}
          </Button>
        </form>
      </Panel>
    </>
  );
}
