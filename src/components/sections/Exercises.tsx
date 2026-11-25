import { MarkdownContent } from "@/components/app/MarkdownContent";
import { ErrorNotebook } from "./ErrorNotebook";
import { StudyTools } from "./StudyTools";
import { SavedQuizzes } from "./SavedQuizzes";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { useSave, useTable, useProfile } from "@/hooks/use-data";
import { questionsForCourse, findCourse, COURSES } from "@/lib/core/courses";
import { NativeSelect, PageHeader, Panel } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  QUESTIONS,
  selectPracticeQuestions,
  selectAdaptiveQuestions,
  type Question,
} from "@/lib/core/questions";
import { quizStats } from "@/lib/core/metrics";
import { cn } from "@/lib/utils";

export function Exercises() {
  const profile = useProfile();
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const course = selectedCourse ?? findCourse(profile.data?.course ?? "")?.name ?? COURSES[0].name;
  const courseQuestions = questionsForCourse(QUESTIONS, course);
  const topics = [...new Set(courseQuestions.map((question) => question.topic))];
  const answers = useTable("quiz_answers");
  const [pendingAnswer, setPendingAnswer] = useState<import("@/lib/core/types").QuizAnswer | null>(
    null,
  );
  const ins = useSave<import("@/lib/core/types").QuizAnswer>(
    async (repo, row) => {
      if (!(await repo.get("quiz_answers", row.id))) await repo.insert("quiz_answers", row);
    },
    { invalidate: ["quiz_answers"] },
  );
  function persistAnswer(row: import("@/lib/core/types").QuizAnswer) {
    ins.mutate(row, {
      onSuccess: () => {
        if (row.correct) setScore((s) => s + 1);
        setPendingAnswer(null);
      },
    });
  }
  const [adaptive, setAdaptive] = useState(false);
  const [topic, setTopic] = useState("all");
  const [quiz, setQuiz] = useState<Question[] | null>(null);
  const [idx, setIdx] = useState(0),
    [picked, setPicked] = useState<number | null>(null),
    [score, setScore] = useState(0);
  const overall = quizStats(answers.data ?? []);
  const pool = useMemo(
    () => questionsForCourse(QUESTIONS, course).filter((q) => topic === "all" || q.topic === topic),
    [topic, course],
  );

  function start() {
    setQuiz(
      (adaptive ? selectAdaptiveQuestions : selectPracticeQuestions)(pool, answers.data ?? [], 10),
    );
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
    const row = {
      id: crypto.randomUUID(),
      question_id: q.id,
      topic: q.topic,
      correct,
      answered_at: new Date().toISOString(),
    };
    setPendingAnswer(row);
    persistAnswer(row);
  }
  const q = quiz?.[idx];
  const finished = quiz && idx >= quiz.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exercícios"
        actions={
          quiz ? (
            <Button variant="outline" disabled={!!pendingAnswer} onClick={() => setQuiz(null)}>
              <ArrowLeft aria-hidden /> Voltar aos temas
            </Button>
          ) : undefined
        }
        description={`${course}: banco fixo com ${courseQuestions.length} questões comentadas em ${topics.length} temas. Cada resposta é registrada.`}
      />
      {!quiz && (
        <Panel>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="ex-course">Curso</Label>
              <NativeSelect
                id="ex-course"
                value={course}
                onChange={(event) => {
                  setSelectedCourse(event.target.value);
                  setTopic("all");
                }}
              >
                {COURSES.map((item) => (
                  <option key={item.name}>{item.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="ex-topic">Tema</Label>
              <NativeSelect id="ex-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="all">Todos os temas</option>
                {topics.map((t) => (
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
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={adaptive}
              onChange={(e) => setAdaptive(e.target.checked)}
            />
            Priorizar temas com dificuldades (adaptação determinística)
          </label>
          <p className="mt-3 text-xs text-muted-foreground">
            {adaptive &&
              "Prioriza menor acerto por tema com pelo menos três respostas registradas. "}
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
          <MarkdownContent content={q.q} />
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
                  <MarkdownContent content={o} inline />
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
          {pendingAnswer && (
            <div role="status" className="mt-4 space-y-2 text-sm">
              <p>
                {ins.isPending
                  ? "Salvando resposta…"
                  : "A resposta ainda não foi salva. Tente novamente para continuar."}
              </p>
              {ins.isError && (
                <Button variant="outline" onClick={() => persistAnswer(pendingAnswer)}>
                  Tentar salvar resposta
                </Button>
              )}
            </div>
          )}
          {picked !== null && (
            <Button
              disabled={!!pendingAnswer}
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
      <ErrorNotebook />
      <SavedQuizzes />
      <StudyTools initialAction="quiz" allowed={["quiz", "exam", "enem", "essay"]} />
    </div>
  );
}
