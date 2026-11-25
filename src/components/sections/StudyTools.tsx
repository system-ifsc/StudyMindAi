import { estimatedReadingMinutes } from "@/lib/core/tutoring";
import { CopyText } from "@/components/app/MarkdownContent";
import { useRef, useState } from "react";
import { useSave, useTable } from "@/hooks/use-data";
import { useStudyAI } from "@/hooks/use-study-ai";
import { NativeSelect, Panel, Spin } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { today } from "@/lib/core/dates";
import {
  studyActions,
  studyOutputSchema,
  cardDraftSchema,
  type StudyAction,
  type StudyOutput,
} from "@/lib/core/study-tools";
import type { Material } from "@/lib/core/types";
import { GeneratedQuiz } from "./StudyQuiz";
import { StudyText } from "./StudyText";
import { printMaterial } from "@/lib/print-material";

export function StudyTools({
  material,
  initialAction = "summary",
  allowed,
  initialCount = 10,
}: {
  material?: Material;
  initialAction?: StudyAction;
  allowed?: StudyAction[];
  initialCount?: number;
}) {
  const ai = useStudyAI();
  const materials = useTable("materials");
  const subjects = useTable("subjects");
  const [action, setAction] = useState<StudyAction>(initialAction);
  const [materialId, setMaterialId] = useState("");
  const [text, setText] = useState("");
  const [subject, setSubject] = useState<string | null>(null);
  const [count, setCount] = useState(String(initialCount));
  const [readingMinutes, setReadingMinutes] = useState("3");
  const [result, setResult] = useState<StudyOutput | null>(null);
  const [source, setSource] = useState<
    { material_id: string } | { material: { name: string; content: string } } | null
  >(null);
  const [sourceName, setSourceName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const documentId = useRef(crypto.randomUUID());
  const savedCards = useRef(new Set<string>());
  const cardRows = useRef<{ id: string; front: string; back: string }[]>([]);
  const doc = useSave<{ name: string; kind: "md"; content: string }>(
    async (repo, row) => {
      if (!(await repo.get("materials", documentId.current)))
        await repo.insert("materials", { ...row, id: documentId.current });
    },
    { invalidate: ["materials"], success: "Salvo em Materiais" },
  );
  const saveCards = useSave<void>(
    async (repo) => {
      for (const row of cardRows.current) {
        if (savedCards.current.has(row.id)) continue;
        try {
          // IDs estáveis permitem reconhecer uma gravação cujo retorno se perdeu na rede.
          const exists = await repo.get("flashcards", row.id);
          if (!exists)
            await repo.insert("flashcards", {
              ...row,
              ...cardDraftSchema.parse(row),
              subject_id: (subject ?? selected?.subject_id) || null,
              due_date: today(),
              interval_days: 0,
              ease: 2.5,
              reps: 0,
            });
          savedCards.current.add(row.id);
        } catch (e) {
          throw new Error(
            `${savedCards.current.size}/${cardRows.current.length} cartões salvos. Tente salvar novamente para continuar. ${(e as Error).message}`,
          );
        }
      }
    },
    { invalidate: ["flashcards"], success: "Cartões disponíveis na revisão espaçada" },
  );
  const selected = material ?? materials.data?.find((m) => m.id === materialId);
  const saving = doc.isPending || saveCards.isPending;

  async function generate() {
    const currentSource = selected
      ? { material_id: selected.id }
      : { material: { name: "Texto para estudo", content: text.trim() } };
    try {
      const payload = (await ai.request({
        action: "generate",
        tool: action,
        count: Number(count),
        reading_minutes: Number(readingMinutes),
        ...currentSource,
      })) as { output: unknown };
      const output = studyOutputSchema.parse(payload.output);
      setResult(output);
      setSource(currentSource);
      setSourceName(selected?.name ?? "Texto para estudo");
      documentId.current = crypto.randomUUID();
      setSaved(false);
      setSaveError("");
      savedCards.current.clear();
      cardRows.current =
        output.type === "flashcards"
          ? output.cards.map((c) => ({ ...c, id: crypto.randomUUID() }))
          : [];
      // Persistir assim que a geração termina permite retomar em outro dispositivo.
      try {
        if (output.type === "text") {
          await doc.mutateAsync({
            name: output.title,
            kind: "md",
            content: `Fonte: ${selected?.name ?? "Texto para estudo"}\n\n${output.content}`,
          });
          setSaved(true);
        }
      } catch (error) {
        setSaveError(
          `Conteúdo gerado, mas o salvamento falhou. Use o botão para tentar novamente. ${(error as Error).message}`,
        );
      }
    } catch {
      /* A mensagem de erro fica no painel; resultados anteriores continuam acessíveis. */
    }
  }
  async function save() {
    setSaveError("");
    try {
      if (result?.type === "text")
        await doc.mutateAsync({
          name: result.title,
          kind: "md",
          content: `Fonte: ${sourceName}\n\n${result.content}`,
        });
      else if (result?.type === "flashcards") await saveCards.mutateAsync();
      setSaved(true);
    } catch (e) {
      setSaveError((e as Error).message);
    }
  }
  return (
    <Panel title="Estudar com IA">
      <div className="space-y-4">
        {ai.status !== "ready" && (
          <p role="status" className="text-sm text-muted-foreground">
            {ai.status === "checking"
              ? "Verificando disponibilidade da IA…"
              : ai.demo
                ? "A geração com IA exige uma conta real; está desativada na demonstração."
                : "IA não configurada ou indisponível. Configure as variáveis do servidor e o acesso ao provedor de IA. Nenhum conteúdo será simulado."}
          </p>
        )}
        {!material && (
          <div className="space-y-1.5">
            <Label htmlFor={`study-source-${initialAction}`}>Material de origem</Label>
            <NativeSelect
              id={`study-source-${initialAction}`}
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              disabled={ai.busy || saving}
            >
              <option value="">Usar texto abaixo</option>
              {materials.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
            {materials.error && (
              <p role="alert" className="text-sm text-destructive">
                Não foi possível carregar materiais.{" "}
                <button onClick={() => materials.refetch()} className="underline">
                  Tentar novamente
                </button>
              </p>
            )}
            {!materialId && (
              <Textarea
                aria-label="Texto de origem"
                placeholder="Cole suas anotações ou o conteúdo que deseja estudar…"
                value={text}
                maxLength={15000}
                onChange={(e) => setText(e.target.value)}
                disabled={ai.busy || saving}
              />
            )}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`study-action-${initialAction}`}>Gerar</Label>
            <NativeSelect
              id={`study-action-${initialAction}`}
              value={action}
              onChange={(e) => setAction(e.target.value as StudyAction)}
              disabled={ai.busy || saving}
            >
              {(Object.entries(studyActions) as [StudyAction, string][])
                .filter(([key]) => !allowed || allowed.includes(key))
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </NativeSelect>
          </div>
          {["flashcards", "quiz", "exam", "enem"].includes(action) && (
            <div className="space-y-1.5">
              <Label htmlFor={`study-count-${initialAction}`}>Quantidade</Label>
              <NativeSelect
                id={`study-count-${initialAction}`}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                disabled={ai.busy || saving}
              >
                {[3, 5, 10, 20].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </NativeSelect>
            </div>
          )}
          {action === "flashcards" && (
            <div className="space-y-1.5">
              <Label htmlFor={`generated-subject-${initialAction}`}>Disciplina dos cartões</Label>
              <NativeSelect
                id={`generated-subject-${initialAction}`}
                value={subject ?? selected?.subject_id ?? ""}
                onChange={(e) => setSubject(e.target.value)}
                disabled={ai.busy || saving || savedCards.current.size > 0}
              >
                <option value="">Sem disciplina</option>
                {subjects.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          {["summary", "simplified", "keypoints", "guide"].includes(action) && (
            <div className="space-y-1.5">
              <Label htmlFor={`reading-time-${initialAction}`}>Tempo de leitura desejado</Label>
              <NativeSelect
                id={`reading-time-${initialAction}`}
                value={readingMinutes}
                onChange={(e) => setReadingMinutes(e.target.value)}
                disabled={ai.busy || saving}
              >
                {[1, 3, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} min (estimativa)
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <Button
            onClick={generate}
            disabled={ai.status !== "ready" || ai.busy || saving || (!selected && !text.trim())}
          >
            {ai.busy && <Spin />}Gerar com IA
          </Button>
          {ai.busy && (
            <Button variant="outline" onClick={ai.cancel}>
              Cancelar
            </Button>
          )}
        </div>
        {action === "essay" && (
          <p className="text-sm text-muted-foreground">
            Selecione ou cole sua redação, incluindo o tema. O feedback é formativo e não equivale à
            correção oficial do ENEM.
          </p>
        )}
        {action === "podcast" && (
          <p className="text-sm text-muted-foreground">
            Gera um roteiro salvo na biblioteca. A leitura em voz alta depende das vozes disponíveis
            no navegador; não gera um arquivo de áudio.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Análise de materiais de até 60 mil caracteres; textos colados até 15 mil. Textos são
          salvos automaticamente. Confira e edite os cartões antes de salvá-los na revisão espaçada.
        </p>
        {ai.error && (
          <p role="alert" className="text-sm text-destructive">
            {ai.error}
          </p>
        )}
        {result && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Fonte: {sourceName}. Conteúdo gerado por IA, sujeito a erros.
            </p>
            {result.type === "text" && (
              <>
                <h3 className="font-semibold">{result.title}</h3>
                <p className="text-xs text-muted-foreground">
                  Leitura estimada: {estimatedReadingMinutes(result.content)} min. O ritmo varia por
                  pessoa e pelo conteúdo.
                </p>
                <div className="max-h-96 overflow-auto">
                  <StudyText content={result.content} />
                </div>
                <CopyText text={result.content} />
                <Button
                  variant="outline"
                  onClick={() => {
                    try {
                      printMaterial(result.title, `Fonte: ${sourceName}\n\n${result.content}`);
                    } catch (e) {
                      setSaveError((e as Error).message);
                    }
                  }}
                >
                  Imprimir / salvar como PDF
                </Button>
              </>
            )}
            {result.type === "flashcards" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Revise os cartões gerados. Você pode editar perguntas e respostas antes de
                  incluí-los no SRS.
                </p>
                <ul className="max-h-96 divide-y overflow-auto">
                  {result.cards.map((c, i) => (
                    <li key={cardRows.current[i]?.id ?? i} className="space-y-2 py-3 text-sm">
                      <Label htmlFor={`draft-front-${documentId.current}-${i}`}>
                        Pergunta do cartão {i + 1}
                      </Label>
                      <Textarea
                        id={`draft-front-${documentId.current}-${i}`}
                        value={c.front}
                        maxLength={1000}
                        disabled={saving || saved || savedCards.current.size > 0}
                        onChange={(e) => {
                          const front = e.target.value;
                          cardRows.current[i]!.front = front;
                          setResult({
                            ...result,
                            cards: result.cards.map((row, index) =>
                              index === i ? { ...row, front } : row,
                            ),
                          });
                        }}
                      />
                      <Label htmlFor={`draft-back-${documentId.current}-${i}`}>
                        Resposta do cartão {i + 1}
                      </Label>
                      <Textarea
                        id={`draft-back-${documentId.current}-${i}`}
                        value={c.back}
                        maxLength={3000}
                        disabled={saving || saved || savedCards.current.size > 0}
                        onChange={(e) => {
                          const back = e.target.value;
                          cardRows.current[i]!.back = back;
                          setResult({
                            ...result,
                            cards: result.cards.map((row, index) =>
                              index === i ? { ...row, back } : row,
                            ),
                          });
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
            {result.type === "quiz" && source && (
              <GeneratedQuiz key={documentId.current} quiz={result} source={source} />
            )}
            {result.type !== "quiz" && (
              <Button
                onClick={save}
                disabled={
                  saved ||
                  saving ||
                  ai.busy ||
                  (result.type === "flashcards" &&
                    result.cards.some((c) => !cardDraftSchema.safeParse(c).success))
                }
              >
                {saving && <Spin />}
                {saved
                  ? "Salvo"
                  : result.type === "flashcards"
                    ? "Salvar cartões para revisão"
                    : "Salvar em Materiais"}
              </Button>
            )}
            {saveError && (
              <p role="alert" className="text-sm text-destructive">
                {saveError}
              </p>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
