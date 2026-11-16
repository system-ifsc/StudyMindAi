import { useRef, useState } from "react";
import { useSave, useRepo } from "@/hooks/use-data";
import { useQueryClient } from "@tanstack/react-query";
import { saveQuizDefinition } from "@/lib/repo/study-history";
import { useStudyAI } from "@/hooks/use-study-ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spin } from "@/components/app/ui";
import { correctObjective, gradingSchema, type StudyOutput } from "@/lib/core/study-tools";

type Evaluation = { correct: boolean; feedback: string };
export function GeneratedQuiz({
  quiz,
  source,
  saved,
}: {
  quiz: Extract<StudyOutput, { type: "quiz" }>;
  source: { material_id: string } | { material: { name: string; content: string } };
  saved?: {
    setId: string;
    questionIds: string[];
    attemptId: string;
    answers: Record<number, string>;
    evaluations: Record<number, Evaluation>;
    complete: boolean;
  };
}) {
  const ai = useStudyAI();
  const repo = useRepo();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<number, string>>(saved?.answers ?? {});
  const [evaluations, setEvaluations] = useState<Record<number, Evaluation>>(
    saved?.evaluations ?? {},
  );
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(saved?.complete ?? false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const setId = useRef(saved?.setId ?? crypto.randomUUID());
  const attemptId = useRef(saved?.attemptId ?? crypto.randomUUID());
  const ids = useRef(saved?.questionIds ?? quiz.questions.map(() => crypto.randomUUID()));
  const optionIds = useRef(quiz.questions.map((q) => q.options.map(() => crypto.randomUUID())));
  const recorded = useRef(new Set<number>());
  const pendingEvaluations = useRef<Record<number, Evaluation>>(saved?.evaluations ?? {});
  async function persistDraft() {
    await saveQuizDefinition(
      repo,
      quiz,
      { set: setId.current, questions: ids.current, options: optionIds.current },
      source,
    );
    if (!(await repo.get("question_attempts", attemptId.current)))
      await repo.insert("question_attempts", {
        id: attemptId.current,
        set_id: setId.current,
        client_id: attemptId.current,
        status: "in_progress",
        started_at: new Date().toISOString(),
        submitted_at: null,
        score: null,
        evaluation: "",
      });
    const previous = (await repo.list("question_attempt_answers")).filter(
      (a) => a.attempt_id === attemptId.current,
    );
    for (const [index, value] of Object.entries(answers)) {
      const questionId = ids.current[Number(index)]!;
      const found = previous.find((a) => a.question_id === questionId);
      if (found) await repo.update("question_attempt_answers", found.id, { answer: value });
      else
        await repo.insert("question_attempt_answers", {
          id: crypto.randomUUID(),
          set_id: setId.current,
          attempt_id: attemptId.current,
          question_id: questionId,
          answer: value,
          correct: null,
          score: null,
          evaluation: "",
          answered_at: new Date().toISOString(),
          evaluated_at: null,
        });
    }
    await qc.invalidateQueries({ queryKey: [repo.mode] });
  }
  const save = useSave<void>(
    async (repo) => {
      await persistDraft();
      const stored = (await repo.list("question_attempt_answers")).filter(
        (a) => a.attempt_id === attemptId.current,
      );
      for (const [index, question] of quiz.questions.entries()) {
        if (recorded.current.has(index)) continue;
        let evaluation = pendingEvaluations.current[index];
        if (!evaluation) {
          const correct =
            question.type === "open" ? null : correctObjective(question, Number(answers[index]));
          if (correct === null) {
            const payload = (await ai.request({
              action: "grade",
              question,
              answer: answers[index],
              ...source,
            })) as { evaluation: unknown };
            evaluation = gradingSchema.parse(payload.evaluation);
          } else evaluation = { correct, feedback: question.explanation };
          pendingEvaluations.current[index] = evaluation;
        }
        // Repetir após uma falha de rede não duplica uma resposta já gravada.
        const answerRow = stored.find((a) => a.question_id === ids.current[index]);
        if (!answerRow) throw new Error("Resposta salva não encontrada.");
        const exists = await repo.get("quiz_answers", answerRow.id);
        if (!exists)
          await repo.insert("quiz_answers", {
            id: answerRow.id,
            question_id: ids.current[index]!,
            topic: question.topic,
            correct: evaluation.correct,
            answered_at: new Date().toISOString(),
          });
        await repo.update("question_attempt_answers", answerRow.id, {
          correct: evaluation.correct,
          score: evaluation.correct ? 100 : 0,
          evaluation: evaluation.feedback,
          evaluated_at: new Date().toISOString(),
        });
        recorded.current.add(index);
        setEvaluations((previous) => ({ ...previous, [index]: evaluation }));
      }
      const correct = Object.values(pendingEvaluations.current).filter((e) => e.correct).length;
      await repo.update("question_attempts", attemptId.current, {
        status: "evaluated",
        submitted_at: new Date().toISOString(),
        score: Math.round((correct / quiz.questions.length) * 100),
      });
    },
    { invalidate: ["quiz_answers"], success: "Resultados registrados no desempenho" },
  );
  async function submit() {
    setSubmitted(true);
    setError("");
    try {
      await save.mutateAsync();
      setComplete(true);
    } catch (e) {
      setError(
        `${recorded.current.size}/${quiz.questions.length} resultados registrados. ${(e as Error).message} Tente novamente para continuar.`,
      );
    }
  }
  const canSubmit = quiz.questions.every((_, i) => answers[i]?.trim());
  const scored = Object.values(evaluations);
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{quiz.title}</h3>
      <p className="text-xs text-muted-foreground">
        Responda todas as questões antes de corrigir. Questões discursivas são avaliadas pela IA e
        podem conter erros. Salve o progresso para continuar em Exercícios em outro dispositivo.
      </p>
      {quiz.questions.map((q, i) => (
        <fieldset
          key={i}
          disabled={submitted || complete || savingDraft}
          className="space-y-3 rounded-xl border p-4"
        >
          <legend className="px-1 text-sm font-medium">
            Questão {i + 1} · {q.topic}
          </legend>
          <p className="whitespace-pre-wrap text-sm">{q.question}</p>
          {q.type === "open" ? (
            <Textarea
              aria-label={`Resposta da questão ${i + 1}`}
              value={answers[i] ?? ""}
              maxLength={4000}
              onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
            />
          ) : (
            q.options.map((option, n) => (
              <label
                key={n}
                className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
              >
                <input
                  type="radio"
                  name={`generated-question-${ids.current[i]}`}
                  checked={answers[i] === String(n)}
                  onChange={() => setAnswers({ ...answers, [i]: String(n) })}
                />
                {option}
              </label>
            ))
          )}
          {evaluations[i] && (
            <div role="status" className="space-y-2 rounded-xl bg-surface p-3 text-sm">
              <strong>
                {evaluations[i].correct ? "Correto" : "Revisar"}
                {q.type === "open" ? " · avaliação por IA" : ""}
              </strong>
              <p className="whitespace-pre-wrap">{evaluations[i].feedback}</p>
              <p>Resposta de referência: {q.answer}</p>
            </div>
          )}
        </fieldset>
      ))}
      {scored.length > 0 && (
        <p role="status" className="text-sm">
          {scored.filter((e) => e.correct).length} acertos em {scored.length} questões corrigidas de{" "}
          {quiz.questions.length}.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        variant="outline"
        disabled={savingDraft || save.isPending || complete}
        onClick={async () => {
          setSavingDraft(true);
          setError("");
          try {
            await persistDraft();
            setDraftSaved(true);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setSavingDraft(false);
          }
        }}
      >
        {savingDraft && <Spin />}
        {draftSaved ? "Salvar progresso novamente" : "Salvar para continuar depois"}
      </Button>
      <Button onClick={submit} disabled={!canSubmit || save.isPending || complete}>
        {save.isPending && <Spin />}
        {complete
          ? "Resultados registrados"
          : submitted
            ? "Tentar registrar as questões restantes"
            : "Corrigir e registrar resultados"}
      </Button>
    </div>
  );
}
