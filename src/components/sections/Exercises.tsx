import { StudyTools } from "./StudyTools";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { useInsert, useTable } from "@/hooks/use-data";
import { NativeSelect, PageHeader, Panel } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { QUESTIONS, TOPICS, selectPracticeQuestions, type Question } from "@/lib/core/questions";
import { quizStats } from "@/lib/core/metrics";
import { cn } from "@/lib/utils";

export function Exercises() {
  const answers = useTable("quiz_answers");
  const ins = useInsert("quiz_answers", "");
  const [topic, setTopic] = useState("all");
  const [quiz, setQuiz] = useState<Question[] | null>(null);
  const [idx, setIdx] = useState(0),
    [picked, setPicked] = useState<number | null>(null),
    [score, setScore] = useState(0);
  const overall = quizStats(answers.data ?? []);
  const pool = useMemo(
    () => QUESTIONS.filter((q) => topic === "all" || q.topic === topic),
    [topic],
  );

  function start() {
    setQuiz(selectPracticeQuestions(pool, answers.data ?? [], 10));
    setIdx(0);
    setPicked(null);
    setScore(0);
  }
  function answer(i: number) {
    if (!quiz || picked !== null) return;
    const q = quiz[idx];
    if (!q) return;
    setPicked(i);
    const correct = i === q.correct;
    if (correct) setScore((s) => s + 1);
    ins.mutate({
      question_id: q.id,
      topic: q.topic,
      correct,
      answered_at: new Date().toISOString(),
    });
  }
  const q = quiz?.[idx];
  const finished = quiz && idx >= quiz.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exercícios"
        actions={
          quiz ? (
            <Button variant="outline" onClick={() => setQuiz(null)}>
              <ArrowLeft aria-hidden /> Voltar aos temas
            </Button>
          ) : undefined
        }
        description={`Banco fixo com ${QUESTIONS.length} questões comentadas em ${TOPICS.length} temas. Cada resposta é registrada.`}
      />
      {!quiz && (
        <Panel>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="ex-topic">Tema</Label>
              <NativeSelect id="ex-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="all">Todos os temas</option>
                {TOPICS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </NativeSelect>
            </div>
            <Button
              onClick={start}
              size="lg"
              disabled={answers.isLoading || !!answers.error || ins.isPending || !pool.length}
            >
              Começar ({Math.min(10, pool.length)} questões)
            </Button>
          </div>
          {answers.error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              Não foi possível carregar seu histórico.{" "}
              <button className="underline" onClick={() => answers.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            A rodada prioriza questões menos praticadas e, em empate, as respondidas há mais tempo.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Resultado acumulado:{" "}
            {overall.total
              ? `${overall.correct} acertos em ${overall.total} respostas (${overall.pct}%)`
              : "nenhuma resposta ainda"}
            .
          </p>
        </Panel>
      )}
      {q && !finished && (
        <Panel
          title={`Questão ${idx + 1} de ${quiz!.length}`}
          action={<span className="text-sm text-muted-foreground">{q.topic}</span>}
        >
          <p className="mb-4 text-lg">{q.q}</p>
          <div className="grid gap-2" role="radiogroup" aria-label="Alternativas">
            {q.opts.map((o, i) => (
              <button
                key={i}
                role="radio"
                aria-checked={picked === i}
                disabled={picked !== null}
                onClick={() => answer(i)}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors hover:bg-accent disabled:cursor-default",
                  picked !== null && i === q.correct && "border-success bg-success/10",
                  picked === i && i !== q.correct && "border-destructive bg-destructive/10",
                )}
              >
                <span>
                  <span className="mr-2 font-semibold text-muted-foreground">
                    {String.fromCharCode(65 + i)})
                  </span>
                  {o}
                </span>
                {picked !== null && i === q.correct && (
                  <CheckCircle2 className="size-4 text-success" aria-label="Correta" />
                )}
                {picked === i && i !== q.correct && (
                  <XCircle className="size-4 text-destructive" aria-label="Sua resposta" />
                )}
              </button>
            ))}
          </div>
          {picked !== null && (
            <div role="status" className="mt-4 rounded-xl bg-surface p-4 text-sm">
              <strong>{picked === q.correct ? "Correto!" : "Não foi dessa vez."}</strong> {q.why}
            </div>
          )}
          {picked !== null && (
            <Button
              className="mt-4"
              onClick={() => {
                setIdx(idx + 1);
                setPicked(null);
              }}
            >
              {idx + 1 < quiz!.length ? "Próxima" : "Ver resultado"}
            </Button>
          )}
        </Panel>
      )}
      {finished && (
        <Panel title="Resultado da rodada">
          <p className="font-display text-5xl font-semibold">
            {score}/{quiz!.length}
          </p>
          <p className="mt-2 text-muted-foreground">
            {Math.round((score / quiz!.length) * 100)}% de acertos nesta rodada.
          </p>
          <div className="mt-4 flex gap-2">
            <Button onClick={start}>Nova rodada</Button>
            <Button variant="outline" onClick={() => setQuiz(null)}>
              Trocar tema
            </Button>
          </div>
        </Panel>
      )}
      <StudyTools initialAction="quiz" allowed={["quiz", "exam"]} />
    </div>
  );
}
