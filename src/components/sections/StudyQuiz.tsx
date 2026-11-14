import { useRef, useState } from "react";
import { useSave } from "@/hooks/use-data";
import { useStudyAI } from "@/hooks/use-study-ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spin } from "@/components/app/ui";
import { correctObjective, gradingSchema, type StudyOutput } from "@/lib/core/study-tools";

type Evaluation = { correct: boolean; feedback: string };
export function GeneratedQuiz({
  quiz,
  source,
}: {
  quiz: Extract<StudyOutput, { type: "quiz" }>;
  source: { material_id: string } | { material: { name: string; content: string } };
}) {
  const ai = useStudyAI();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [evaluations, setEvaluations] = useState<Record<number, Evaluation>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const ids = useRef(quiz.questions.map(() => crypto.randomUUID()));
  const recorded = useRef(new Set<number>());
  const pendingEvaluations = useRef<Record<number, Evaluation>>({});
  const save = useSave<void>(
    async (repo) => {
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
        const exists = await repo.get("quiz_answers", ids.current[index]!);
        if (!exists)
          await repo.insert("quiz_answers", {
            id: ids.current[index]!,
            question_id: ids.current[index]!,
            topic: question.topic,
            correct: evaluation.correct,
            answered_at: new Date().toISOString(),
          });
        recorded.current.add(index);
        setEvaluations((previous) => ({ ...previous, [index]: evaluation }));
      }
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
        podem conter erros. Os resultados são salvos em Desempenho; este questionário não é salvo
        para outra sessão.
      </p>
      {quiz.questions.map((q, i) => (
        <fieldset key={i} disabled={submitted} className="space-y-3 rounded-xl border p-4">
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
