import { MarkdownContent, CopyText } from "@/components/app/MarkdownContent";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Send,
  Sparkles,
  Info,
  Plus,
  SlidersHorizontal,
  MessageSquare,
  Square,
  ChevronDown,
} from "lucide-react";
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
  const [contextOpen, setContextOpen] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [input, setInput] = useState(""),
    [mat, setMat] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [includeProgress, setIncludeProgress] = useState(false);
  const [mode, setMode] = useState<TutorMode>("teacher");
  const [level, setLevel] = useState<ExplanationLevel>("standard");
  const context = useSave<Partial<import("@/lib/core/types").Tables["study_conversations"]>>(
    async (r, patch) => {
      if (conversationId) await r.update("study_conversations", conversationId, patch);
    },
    { invalidate: ["study_conversations"] },
  );
  async function changeContext(values: {
    material?: string;
    mode?: TutorMode;
    level?: ExplanationLevel;
  }) {
    try {
      await context.mutateAsync({
        ...(values.material !== undefined ? { material_id: values.material || null } : {}),
        ...(values.mode
          ? {
              mode:
                values.mode === "review"
                  ? "review"
                  : values.mode === "evaluator"
                    ? "questions"
                    : "tutor",
            }
          : {}),
        ...(values.level
          ? {
              level:
                values.level === "simple"
                  ? "beginner"
                  : values.level === "advanced"
                    ? "advanced"
                    : "intermediate",
            }
          : {}),
      });
      if (values.material !== undefined) setMat(values.material);
      if (values.mode) setMode(values.mode);
      if (values.level) setLevel(values.level);
    } catch {
      setError("Não foi possível salvar o contexto. Tente novamente.");
    }
  }
  const transcript = useRef<HTMLDivElement>(null);
  const followMessages = useRef(true);
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
  useEffect(() => {
    followMessages.current = true;
  }, [conversationId]);
  useEffect(() => {
    if (transcript.current && followMessages.current)
      transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [msgs.length, busy, conversationId]);
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
        description="Um espaço para entender conceitos, tirar dúvidas e aprofundar seus estudos."
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
        <Panel className="overflow-hidden p-0 sm:p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Seu tutor de estudos</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {status === "checking" ? "Verificando disponibilidade…" : "Pronto para ajudar"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-expanded={contextOpen}
                aria-controls="assistant-study-context"
                onClick={() => setContextOpen((open) => !open)}
                className="gap-2 text-muted-foreground"
              >
                <SlidersHorizontal className="size-4" aria-hidden />
                Contexto do estudo
                <ChevronDown
                  className={`size-3.5 transition-transform ${contextOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setConversationId("");
                  setError("");
                }}
                disabled={busy || !!unsaved || context.isPending}
              >
                <Plus className="size-4" aria-hidden />
                Nova conversa
              </Button>
            </div>
          </div>
          <div
            className={`grid ${contextOpen ? "lg:grid-cols-[280px_minmax(0,1fr)]" : "grid-cols-1"}`}
          >
            <aside
              id="assistant-study-context"
              hidden={!contextOpen}
              aria-label="Configurações do contexto do estudo"
              className="border-b bg-muted/20 p-5 lg:border-r lg:border-b-0"
            >
              <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Personalize a conversa
              </div>
              <p className="mb-5 -mt-3 text-xs leading-relaxed text-muted-foreground">
                Escolha o assunto e como prefere aprender. Suas opções continuam ativas ao recolher
                este painel.
              </p>
              <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="space-y-1.5">
                  <Label htmlFor="ai-subject">Disciplina</Label>
                  <NativeSelect
                    id="ai-subject"
                    value={subjectId}
                    disabled={busy || !!unsaved || context.isPending}
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
                    disabled={busy || !!unsaved || context.isPending}
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
              <div className="mb-4 space-y-1.5">
                <Label htmlFor="ai-mat">Material de referência</Label>
                <NativeSelect
                  id="ai-mat"
                  value={mat}
                  disabled={busy || !!unsaved || context.isPending}
                  onChange={(e) => void changeContext({ material: e.target.value })}
                >
                  <option value="">Sem material selecionado</option>
                  {mats.data?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="space-y-1.5">
                  <Label htmlFor="tutor-mode">Como estudar</Label>
                  <NativeSelect
                    id="tutor-mode"
                    value={mode}
                    disabled={busy || context.isPending}
                    onChange={(e) => void changeContext({ mode: e.target.value as TutorMode })}
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
                    disabled={busy || context.isPending}
                    onChange={(e) =>
                      void changeContext({ level: e.target.value as ExplanationLevel })
                    }
                  >
                    <option value="simple">Introdutório</option>
                    <option value="standard">Intermediário</option>
                    <option value="advanced">Avançado</option>
                  </NativeSelect>
                </div>
              </div>
              <label className="mt-5 flex items-start gap-2.5 border-t pt-4 text-sm leading-relaxed">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-primary"
                  checked={includeProgress}
                  onChange={(e) => setIncludeProgress(e.target.checked)}
                  disabled={busy || context.isPending}
                />
                <span>
                  Incluir meu progresso
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Considere minhas dificuldades e revisões pendentes nas respostas.
                  </span>
                </span>
              </label>
            </aside>
            <div className="flex min-w-0 flex-col p-4 sm:p-6">
              <div
                className="max-h-[60vh] min-h-80 flex-1 space-y-5 overflow-y-auto overscroll-contain pr-1"
                ref={transcript}
                onScroll={(event) => {
                  const el = event.currentTarget;
                  followMessages.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                }}
                aria-live="polite"
                aria-busy={busy}
              >
                {msgs.length === 0 && (
                  <div className="flex min-h-80 flex-col items-center justify-center px-2 py-8 text-center">
                    <span className="mb-5 flex size-14 items-center justify-center rounded-2xl border bg-primary/5 text-primary">
                      <MessageSquare className="size-6" aria-hidden />
                    </span>
                    <h3 className="text-xl font-semibold tracking-tight">
                      O que vamos aprender hoje?
                    </h3>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                      Traga uma dúvida ou escolha um material de referência para estudar com mais
                      contexto.
                    </p>
                    <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                      {["Explique um conceito com exemplos", "Faça perguntas para eu revisar"].map(
                        (prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            disabled={status !== "ready" || busy}
                            onClick={() => {
                              setInput(prompt);
                              document.getElementById("assistant-question")?.focus();
                            }}
                            className="rounded-xl border bg-background/50 px-4 py-3 text-left text-xs leading-relaxed text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                          >
                            {prompt}
                            <span className="mt-1 block text-[11px] text-muted-foreground">
                              Complete com o assunto que deseja estudar
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}
                {msgs.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.role === "user"
                        ? "ml-auto max-w-[92%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground sm:max-w-[85%]"
                        : "max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border bg-muted/20 px-4 py-4 text-sm leading-relaxed sm:max-w-[92%]"
                    }
                  >
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                      {m.role === "user" ? "Você" : "Assistente"}
                    </p>
                    {m.role === "assistant" ? <MarkdownContent content={m.content} /> : m.content}
                    {m.role === "assistant" && (
                      <div className="mt-3 flex flex-wrap gap-1 border-t pt-2">
                        <CopyText text={m.content} />
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
                  <MarkdownContent content={unsaved.content} />
                  <p className="text-sm">
                    Resposta recebida. O salvamento ainda não foi confirmado.
                  </p>
                  <Button
                    disabled={busy || context.isPending}
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
                <p
                  role="alert"
                  className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <form
                onSubmit={send}
                className="mt-5 flex items-end gap-2 rounded-2xl border bg-background/70 p-2 shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"
              >
                <Textarea
                  id="assistant-question"
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Escreva sua pergunta…"
                  aria-label="Pergunta"
                  maxLength={4000}
                  className="min-h-16 max-h-40 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-transparent"
                  disabled={status === "checking"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(e);
                    }
                  }}
                />
                {busy ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mb-1 shrink-0"
                    onClick={() => abort.current?.abort()}
                  >
                    <Square className="size-3" aria-hidden /> Parar
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    aria-label="Enviar"
                    className="mb-1 size-10 shrink-0 rounded-xl p-0"
                    disabled={
                      context.isPending ||
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
              <div className="mt-3 flex justify-end text-[11px] text-muted-foreground">
                <span>{input.length.toLocaleString("pt-BR")} / 4.000</span>
              </div>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
