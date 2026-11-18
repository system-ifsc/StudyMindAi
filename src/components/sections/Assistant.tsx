import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send, Sparkles, Info, Trash2 } from "lucide-react";
import { auth } from "@/lib/auth/client";
import { useRepo, useTable, useSave } from "@/hooks/use-data";
import { NativeSelect, PageHeader, Panel, Spin } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import type { TutorMode, ExplanationLevel } from "@/lib/core/assistant";

type Msg = {
  role: "user" | "assistant";
  content: string;
  sources?: { name: string; id: string | null }[];
};

export function Assistant() {
  const repo = useRepo();
  const mats = useTable("materials");
  const [status, setStatus] = useState<"checking" | "ready" | "off">("checking");
  const subjects = useTable("subjects");
  const conversations = useTable("study_conversations");
  const messages = useTable("study_messages");
  const sources = useTable("study_message_sources");
  const feedback = useTable("study_message_feedback");
  const qc = useQueryClient();
  const [conversationId, setConversationId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [input, setInput] = useState(""),
    [mat, setMat] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [includeProgress, setIncludeProgress] = useState(false);
  const [mode, setMode] = useState<TutorMode>("teacher");
  const [level, setLevel] = useState<ExplanationLevel>("standard");
  const abort = useRef<AbortController | null>(null);
  const [unsaved, setUnsaved] = useState<{
    id: string;
    conversationId: string;
    content: string;
    sources: { name: string; id: string | null }[];
  } | null>(null);
  const msgs: (Msg & { id: string })[] = (messages.data ?? [])
    .filter((m) => m.conversation_id === conversationId)
    .map((m) => ({
      ...m,
      sources: (sources.data ?? [])
        .filter((s) => s.message_id === m.id)
        .map((s) => ({ name: s.title, id: s.material_id })),
    }));
  const rate = useSave<{ messageId: string; rating: -1 | 1 }>(
    async (r, value) => {
      const existing = feedback.data?.find((f) => f.message_id === value.messageId);
      if (existing) await r.update("study_message_feedback", existing.id, { rating: value.rating });
      else
        await r.insert("study_message_feedback", {
          id: value.messageId,
          message_id: value.messageId,
          rating: value.rating,
          comment: "",
        });
    },
    { invalidate: ["study_message_feedback"], success: "Feedback registrado" },
  );
  async function persistAnswer(answer: NonNullable<typeof unsaved>) {
    if (!(await repo.get("study_messages", answer.id)))
      await repo.insert("study_messages", {
        id: answer.id,
        client_id: answer.id,
        conversation_id: answer.conversationId,
        role: "assistant",
        content: answer.content,
        model: null,
      });
    for (const source of answer.sources) {
      if (!(await repo.get("study_message_sources", answer.id)))
        await repo.insert("study_message_sources", {
          id: answer.id,
          message_id: answer.id,
          material_id: source.id,
          title: source.name,
          url: null,
          excerpt: "",
          page_number: null,
        });
    }
    await qc.invalidateQueries({ queryKey: [repo.mode] });
    setUnsaved(null);
  }

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
    setError("");
    setBusy(true);
    abort.current = new AbortController();
    try {
      let activeId = conversationId;
      if (!activeId) {
        activeId = crypto.randomUUID();
        await repo.insert("study_conversations", {
          id: activeId,
          subject_id: subjectId || null,
          material_id: mat || null,
          task_id: null,
          title: text.slice(0, 200),
          mode: mode === "review" ? "review" : mode === "evaluator" ? "questions" : "tutor",
          level:
            level === "simple" ? "beginner" : level === "advanced" ? "advanced" : "intermediate",
        });
        setConversationId(activeId);
      }
      const userMessageId = crypto.randomUUID();
      await repo.insert("study_messages", {
        id: userMessageId,
        client_id: userMessageId,
        conversation_id: activeId,
        role: "user",
        content: text,
        model: null,
      });
      setInput("");
      await qc.invalidateQueries({ queryKey: [repo.mode] });
      const { data } = await auth.getSession();
      const material = mats.data?.find((m) => m.id === mat);
      const r = await fetch("/api/assistant", {
        method: "POST",
        signal: abort.current.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          messages: next
            .slice(-12)
            .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
          material_id: material?.id ?? null,
          include_progress: includeProgress,
          mode,
          level,
        }),
      });
      const j = (await r.json()) as { text?: string; error?: string; sources?: Msg["sources"] };
      if (!r.ok || !j.text) throw new Error(j.error || "O assistente não respondeu.");
      const answer = {
        id: crypto.randomUUID(),
        conversationId: activeId,
        content: j.text,
        sources: j.sources ?? [],
      };
      setUnsaved(answer);
      await persistAnswer(answer);
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
              onClick={() => {
                setConversationId("");
                setError("");
              }}
              disabled={busy || !!unsaved}
            >
              <Trash2 className="size-4" aria-hidden />
              Nova conversa
            </Button>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ai-subject">Disciplina / memória</Label>
              <NativeSelect
                id="ai-subject"
                value={subjectId}
                disabled={busy || !!unsaved}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setConversationId("");
                }}
              >
                <option value="">Geral</option>
                {subjects.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-history">Histórico salvo</Label>
              <NativeSelect
                id="ai-history"
                value={conversationId}
                disabled={busy || !!unsaved}
                onChange={(e) => {
                  setConversationId(e.target.value);
                  const c = conversations.data?.find((c) => c.id === e.target.value);
                  if (c) {
                    setMat(c.material_id ?? "");
                    setMode(
                      c.mode === "review"
                        ? "review"
                        : c.mode === "questions"
                          ? "evaluator"
                          : "teacher",
                    );
                    setLevel(
                      c.level === "beginner"
                        ? "simple"
                        : c.level === "advanced"
                          ? "advanced"
                          : "standard",
                    );
                  }
                }}
              >
                <option value="">Nova conversa</option>
                {conversations.data
                  ?.filter((c) => c.subject_id === (subjectId || null))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
              </NativeSelect>
            </div>
          </div>
          {[conversations, messages, sources, subjects].some((q) => q.error) && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              Não foi possível carregar o histórico.{" "}
              <button onClick={() => qc.invalidateQueries({ queryKey: [repo.mode] })}>
                Tentar novamente
              </button>
            </p>
          )}
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
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tutor-mode">Como estudar</Label>
              <NativeSelect
                id="tutor-mode"
                value={mode}
                disabled={busy}
                onChange={(e) => setMode(e.target.value as TutorMode)}
              >
                <option value="teacher">Professor</option>
                <option value="evaluator">Avaliador</option>
                <option value="review">Revisão ativa</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tutor-level">Nível de explicação</Label>
              <NativeSelect
                id="tutor-level"
                value={level}
                disabled={busy}
                onChange={(e) => setLevel(e.target.value as ExplanationLevel)}
              >
                <option value="simple">Introdutório</option>
                <option value="standard">Intermediário</option>
                <option value="advanced">Avançado</option>
              </NativeSelect>
            </div>
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
                {m.role === "assistant" && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={rate.isPending}
                      aria-pressed={feedback.data?.some(
                        (f) => f.message_id === m.id && f.rating === 1,
                      )}
                      onClick={() => rate.mutate({ messageId: m.id, rating: 1 })}
                    >
                      Útil
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={rate.isPending}
                      aria-pressed={feedback.data?.some(
                        (f) => f.message_id === m.id && f.rating === -1,
                      )}
                      onClick={() => rate.mutate({ messageId: m.id, rating: -1 })}
                    >
                      Precisa melhorar
                    </Button>
                  </div>
                )}
                {m.role === "assistant" && Array.isArray(m.sources) && m.sources.length > 0 && (
                  <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">
                    Material fornecido como contexto: {m.sources.map((s) => s.name).join(", ")}.
                    Confira a resposta no original.
                  </p>
                )}
              </div>
            ))}
            {busy && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spin />
                Pensando…
              </p>
            )}
          </div>
          {unsaved && (
            <div role="status" className="mt-3 space-y-2 rounded-xl border p-4">
              <p className="whitespace-pre-wrap text-sm">{unsaved.content}</p>
              <p className="text-sm">Resposta recebida. O salvamento ainda não foi confirmado.</p>
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await persistAnswer(unsaved);
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Tentar salvar resposta
              </Button>
            </div>
          )}
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
              <Button
                type="submit"
                aria-label="Enviar"
                disabled={
                  !input.trim() ||
                  !!unsaved ||
                  messages.isLoading ||
                  !!messages.error ||
                  !!conversations.error
                }
              >
                <Send className="size-4" />
              </Button>
            )}
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Conversas salvas na sua conta. A IA recebe as últimas 12 mensagens da conversa
            selecionada; confira informações importantes.
          </p>
        </Panel>
      )}
    </div>
  );
}
