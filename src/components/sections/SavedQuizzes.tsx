import { useState } from "react";
import { useTable } from "@/hooks/use-data";
import { Panel, Loading, ErrorState } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { GeneratedQuiz } from "./StudyQuiz";
import { restoreQuiz } from "@/lib/core/learning";

export function SavedQuizzes() {
  const sets = useTable("generated_question_sets"),
    questions = useTable("generated_questions"),
    options = useTable("generated_question_options"),
    attempts = useTable("question_attempts"),
    answers = useTable("question_attempt_answers");
  const [selected, setSelected] = useState("");
  const queries = [sets, questions, options, attempts, answers];
  if (queries.some((q) => q.isLoading)) return <Loading />;
  const error = queries.find((q) => q.error)?.error;
  if (error)
    return <ErrorState error={error} retry={() => queries.forEach((q) => void q.refetch())} />;
  const attempt = attempts.data?.find((a) => a.id === selected);
  const set = sets.data?.find((s) => s.id === attempt?.set_id);
  const restored = set
    ? restoreQuiz(
        set,
        questions.data ?? [],
        options.data ?? [],
        answers.data?.filter((a) => a.attempt_id === selected) ?? [],
      )
    : null;
  return (
    <Panel title="Simulados e questionários salvos">
      <div className="space-y-3">
        {!attempts.data?.length && (
          <p className="text-sm text-muted-foreground">
            Gere uma atividade e escolha Salvar para continuar depois.
          </p>
        )}
        {attempts.data?.map((a) => (
          <Button
            key={a.id}
            variant={selected === a.id ? "default" : "outline"}
            className="mr-2 max-w-full whitespace-normal text-left"
            onClick={() => setSelected(a.id)}
          >
            {sets.data?.find((s) => s.id === a.set_id)?.title ?? "Atividade"} ·{" "}
            {a.status === "evaluated" ? `${a.score ?? 0}%` : "Continuar"}
          </Button>
        ))}
        {set && attempt && restored && set.material_id && (
          <GeneratedQuiz
            key={attempt.id}
            quiz={restored.quiz}
            source={{ material_id: set.material_id }}
            saved={{
              setId: set.id,
              questionIds: restored.questionIds,
              attemptId: attempt.id,
              answers: restored.answers,
              evaluations: restored.evaluations,
              complete: attempt.status === "evaluated",
            }}
          />
        )}
        {set && !restored && (
          <p role="alert">
            Esta atividade está incompleta. Volte ao material e tente salvar novamente.
          </p>
        )}
        {set && restored && !set.material_id && (
          <div className="space-y-3">
            <p role="status" className="text-sm text-muted-foreground">
              O material original foi excluído. O histórico permanece disponível; novas correções
              precisam de uma fonte.
            </p>
            {restored.quiz.questions.map((q, i) => (
              <div key={restored.questionIds[i]} className="rounded-xl border p-4 text-sm">
                <p className="font-medium">{q.question}</p>
                <p>
                  Sua resposta:{" "}
                  {q.type === "open"
                    ? restored.answers[i]
                    : restored.answers[i] === undefined
                      ? "Não respondida"
                      : q.options[Number(restored.answers[i])]}
                </p>
                {restored.evaluations[i] && <p>{restored.evaluations[i]!.feedback}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
