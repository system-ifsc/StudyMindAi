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
  type StudyAction,
  type StudyOutput,
} from "@/lib/core/study-tools";
import type { Material } from "@/lib/core/types";
import { GeneratedQuiz } from "./StudyQuiz";
import { printMaterial } from "@/lib/print-material";

export function StudyTools({
  material,
  initialAction = "summary",
  allowed,
}: {
  material?: Material;
  initialAction?: StudyAction;
  allowed?: StudyAction[];
}) {
  const ai = useStudyAI();
  const materials = useTable("materials");
  const subjects = useTable("subjects");
  const [action, setAction] = useState<StudyAction>(initialAction);
  const [materialId, setMaterialId] = useState("");
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [count, setCount] = useState("10");
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
              subject_id: subject || null,
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
                : "IA não configurada ou indisponível. Configure as variáveis do servidor e os créditos do Lovable. Nenhum conteúdo será simulado."}
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
          {["flashcards", "quiz", "exam"].includes(action) && (
            <div className="space-y-1.5">
              <Label htmlFor={`study-count-${initialAction}`}>Quantidade</Label>
              <NativeSelect
                id={`study-count-${initialAction}`}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                disabled={ai.busy || saving}
              >
                {[5, 10, 20].map((n) => (
                  <option key={n}>{n}</option>
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
        <p className="text-xs text-muted-foreground">
          Análise de materiais de até 60 mil caracteres; textos colados até 15 mil. Revise o
          conteúdo antes de salvar.
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
                <div className="max-h-96 overflow-auto whitespace-pre-wrap text-sm">
                  {result.content}
                </div>
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
                <ul className="max-h-96 divide-y overflow-auto">
                  {result.cards.map((c, i) => (
                    <li key={i} className="space-y-1 py-3 text-sm">
                      <strong>{c.front}</strong>
                      <p>{c.back}</p>
                    </li>
                  ))}
                </ul>
                <Label htmlFor={`generated-subject-${initialAction}`}>Disciplina dos cartões</Label>
                <NativeSelect
                  id={`generated-subject-${initialAction}`}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={saving || saved || savedCards.current.size > 0}
                >
                  <option value="">Sem disciplina</option>
                  {subjects.data?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </>
            )}
            {result.type === "quiz" && source && (
              <GeneratedQuiz key={documentId.current} quiz={result} source={source} />
            )}
            {result.type !== "quiz" && (
              <Button onClick={save} disabled={saved || saving || ai.busy}>
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
