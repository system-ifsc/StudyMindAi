import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send, Sparkles, Info, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRepo, useTable } from "@/hooks/use-data";
import { NativeSelect, PageHeader, Panel, Spin } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Msg = { role: "user" | "assistant"; content: string };

export function Assistant() {
  const repo = useRepo();
  const mats = useTable("materials");
  const [status, setStatus] = useState<"checking" | "ready" | "off">("checking");
  const [msgs, setMsgs] = useState<Msg[]>([]),
    [input, setInput] = useState(""),
    [mat, setMat] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [includeProgress, setIncludeProgress] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const [loadedHistory, setLoadedHistory] = useState<string | null>(null);
  const [ownerKey, setOwnerKey] = useState(repo.mode === "demo" ? "demo" : "checking");
  const historyKey = ownerKey === "checking" ? null : `studymind-assistant-${ownerKey}`;

  useEffect(() => {
    setLoadedHistory(null);
    if (repo.mode === "demo") {
      setOwnerKey("demo");
      return;
    }
    supabase.auth.getUser().then(({ data }) => setOwnerKey(data.user?.id ?? "anonymous"));
  }, [repo.mode]);

  useEffect(() => {
    if (!historyKey) return;
    try {
      const saved = sessionStorage.getItem(historyKey);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      setMsgs(
        Array.isArray(parsed)
          ? parsed
              .filter(
                (m): m is Msg =>
                  m !== null &&
                  typeof m === "object" &&
                  (m.role === "user" || m.role === "assistant") &&
                  typeof m.content === "string",
              )
              .slice(-24)
          : [],
      );
    } catch {
      setMsgs([]);
    } finally {
      setLoadedHistory(historyKey);
    }
  }, [historyKey]);

  useEffect(() => {
    if (!historyKey || loadedHistory !== historyKey) return;
    try {
      sessionStorage.setItem(historyKey, JSON.stringify(msgs.slice(-24)));
    } catch {
      // Histórico é um recurso local opcional; falhas de storage não interrompem o assistente.
    }
  }, [historyKey, loadedHistory, msgs]);

  useEffect(() => {
    if (repo.mode === "demo") return setStatus("off");
    fetch("/api/assistant")
      .then((r) => r.json())
      .then((j: { configured: boolean }) => setStatus(j.configured ? "ready" : "off"))
      .catch(() => setStatus("off"));
  }, [repo.mode]);

  useEffect(() => () => abort.current?.abort(), []);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setInput("");
    setError("");
    setBusy(true);
    abort.current = new AbortController();
    try {
      const { data } = await supabase.auth.getSession();
      const material = mats.data?.find((m) => m.id === mat);
      const r = await fetch("/api/assistant", {
        method: "POST",
        signal: abort.current.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          messages: next.slice(-12).map((m) => ({ ...m, content: m.content.slice(0, 4000) })),
          material_id: material?.id ?? null,
          include_progress: includeProgress,
        }),
      });
      const j = (await r.json()) as { text?: string; error?: string };
      if (!r.ok || !j.text) throw new Error(j.error || "O assistente não respondeu.");
      setMsgs([...next, { role: "assistant", content: j.text }]);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assistente IA"
        description="Tire dúvidas e peça explicações. As respostas vêm de um modelo de IA real, processado no servidor."
      />
      {status === "off" ? (
        <div role="status" className="flex gap-3 rounded-2xl border bg-surface p-5 text-sm">
          <Info className="mt-0.5 size-4 text-primary" aria-hidden />
          <p>
            {repo.mode === "demo"
              ? "O assistente não funciona no modo demonstração. Crie uma conta para usá-lo."
              : "O assistente não está configurado neste ambiente (falta a chave de IA no servidor). Nenhuma resposta será simulada."}
          </p>
        </div>
      ) : (
        <Panel>
          <div className="mb-4 flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMsgs([])}
              disabled={busy || msgs.length === 0}
            >
              <Trash2 className="size-4" aria-hidden />
              Limpar conversa
            </Button>
          </div>
          <div className="mb-4 max-w-sm space-y-1.5">
            <Label htmlFor="ai-mat">Usar material como contexto (opcional)</Label>
            <NativeSelect id="ai-mat" value={mat} onChange={(e) => setMat(e.target.value)}>
              <option value="">Nenhum</option>
              {mats.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <label className="mb-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeProgress}
              onChange={(e) => setIncludeProgress(e.target.checked)}
              disabled={busy}
            />
            Considerar meu progresso, dificuldades e revisões pendentes
          </label>
          <div className="min-h-64 space-y-3 rounded-xl bg-surface p-4" aria-live="polite">
            {msgs.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="size-4 text-ifsc-red" aria-hidden />
                Pergunte algo como “Explique normalização com um exemplo”.
              </p>
            )}
            {msgs.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-full break-words sm:max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground"
                    : "glass-control max-w-full break-words sm:max-w-[85%] whitespace-pre-wrap rounded-2xl border bg-card px-4 py-2 text-sm"
                }
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spin />
                Pensando…
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <form onSubmit={send} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escreva sua pergunta…"
              aria-label="Pergunta"
              maxLength={4000}
              className="min-h-12"
              disabled={status === "checking"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(e);
                }
              }}
            />
            {busy ? (
              <Button type="button" variant="outline" onClick={() => abort.current?.abort()}>
                Parar
              </Button>
            ) : (
              <Button type="submit" aria-label="Enviar" disabled={!input.trim()}>
                <Send className="size-4" />
              </Button>
            )}
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            A IA pode errar. Confira informações importantes.
          </p>
        </Panel>
      )}
    </div>
  );
}
