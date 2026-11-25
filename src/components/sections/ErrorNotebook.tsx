import { useRef, useState } from "react";
import { useSave, useTable } from "@/hooks/use-data";
import { useStudyAI } from "@/hooks/use-study-ai";
import { errorNotebook, type ReviewError } from "@/lib/core/study-path";
import { QUESTIONS } from "@/lib/core/questions";
import { correctObjective, gradingSchema } from "@/lib/core/study-tools";
import { today } from "@/lib/core/dates";
import { Panel, Loading, ErrorState, Spin } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownContent } from "@/components/app/MarkdownContent";

type Evaluation = { correct: boolean; feedback: string };
export function ErrorNotebook() {
  const history = useTable("quiz_answers"),
    questions = useTable("generated_questions"),
    options = useTable("generated_question_options"),
    sets = useTable("generated_question_sets"),
    answers = useTable("question_attempt_answers");
  const ai = useStudyAI();
  const [showResolved, setShowResolved] = useState(false);
  const [selected, setSelected] = useState<ReviewError | null>(null);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [saved, setSaved] = useState(false),
    [cardSaved, setCardSaved] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<Evaluation | null>(null);
  const ids = useRef({
    answer: crypto.randomUUID(),
    attempt: crypto.randomUUID(),
    card: crypto.randomUUID(),
    at: new Date().toISOString(),
  });
  const review = useSave<{ item: ReviewError; value: string }>(
    async (repo, { item, value }) => {
      let result = pending.current;
      if (!result) {
        if (item.question.type === "open") {
          if (!item.materialId)
            throw new Error(
              "A fonte original não está disponível para avaliar esta resposta discursiva.",
            );
          const payload = (await ai.request({
            action: "grade",
            material_id: item.materialId,
            question: item.question,
            answer: value,
          })) as { evaluation: unknown };
          result = gradingSchema.parse(payload.evaluation);
        } else
          result = {
            correct: correctObjective(item.question, Number(value))!,
            feedback: item.question.explanation,
          };
        ids.current.at = new Date().toISOString();
        pending.current = result;
        setEvaluation(result);
      }
      if (item.setId) {
        if (!(await repo.get("question_attempts", ids.current.attempt)))
          await repo.insert("question_attempts", {
            id: ids.current.attempt,
            client_id: ids.current.attempt,
            set_id: item.setId,
            status: "in_progress",
            started_at: ids.current.at,
            submitted_at: null,
            score: null,
            evaluation:
              "Revisão de uma questão do caderno de erros; não é uma tentativa completa do simulado.",
          });
        if (!(await repo.get("question_attempt_answers", ids.current.answer)))
          await repo.insert("question_attempt_answers", {
            id: ids.current.answer,
            attempt_id: ids.current.attempt,
            set_id: item.setId,
            question_id: item.id,
            answer: value,
            correct: result.correct,
            score: result.correct ? 100 : 0,
            evaluation: result.feedback,
            answered_at: ids.current.at,
            evaluated_at: ids.current.at,
          });
      }
      if (!(await repo.get("quiz_answers", ids.current.answer)))
        await repo.insert("quiz_answers", {
          id: ids.current.answer,
          question_id: item.id,
          topic: item.question.topic,
          correct: result.correct,
          answered_at: ids.current.at,
        });
    },
    {
      invalidate: ["quiz_answers", "question_attempts", "question_attempt_answers"],
      success: "Nova tentativa registrada no desempenho",
    },
  );
  const card = useSave<ReviewError>(
    async (repo, item) => {
      const front = item.question.question.slice(0, 1000),
        back = `${item.question.answer}\n\n${item.question.explanation}`.slice(0, 3000);
      const existing = await repo.list("flashcards");
      if (!existing.some((c) => c.front === front && c.back === back))
        await repo.insert("flashcards", {
          id: ids.current.card,
          front,
          back,
          subject_id: sets.data?.find((s) => s.id === item.setId)?.subject_id ?? null,
          due_date: today(),
          reps: 0,
          interval_days: 0,
          ease: 2.5,
        });
    },
    { invalidate: ["flashcards"], success: "Erro transformado em cartão de revisão" },
  );
  const queries = [history, questions, options, sets, answers];
  if (queries.some((q) => q.isLoading)) return <Loading />;
  const queryError = queries.find((q) => q.error)?.error;
  if (queryError)
    return <ErrorState error={queryError} retry={() => queries.forEach((q) => void q.refetch())} />;
  const items = errorNotebook(
    history.data ?? [],
    QUESTIONS,
    questions.data ?? [],
    options.data ?? [],
    sets.data ?? [],
    answers.data ?? [],
  );
  return (
    <Panel title="Caderno de erros">
      <p className="mb-3 text-sm text-muted-foreground">
        Retome questões em que errou e transforme a explicação em revisão espaçada. Um novo acerto é
        evidência de progresso, não prova de domínio definitivo.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showResolved}
          onChange={(e) => setShowResolved(e.target.checked)}
        />
        Mostrar também erros com acerto na tentativa mais recente
      </label>
      <ul className="mt-3 space-y-2">
        {items
          .filter((item) => showResolved || !item.latestCorrect)
          .map((item) => (
            <li key={item.id}>
              <Button
                variant="outline"
                className="h-auto w-full whitespace-normal text-left"
                disabled={review.isPending || card.isPending}
                onClick={() => {
                  setSelected(item);
                  setAnswer("");
                  setEvaluation(null);
                  pending.current = null;
                  setSaved(false);
                  setCardSaved(false);
                  setError("");
                  ids.current = {
                    answer: crypto.randomUUID(),
                    attempt: crypto.randomUUID(),
                    card: crypto.randomUUID(),
                    at: new Date().toISOString(),
                  };
                }}
              >
                {item.question.topic} · {item.question.question} ·{" "}
                {item.latestCorrect ? "Acerto recente" : `${item.mistakes} erro(s) registrado(s)`}
              </Button>
            </li>
          ))}
      </ul>
      {!items.some((item) => showResolved || !item.latestCorrect) && (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhum erro pendente nos registros disponíveis.
        </p>
      )}
      {selected && (
        <div className="mt-4 space-y-3 rounded-xl border p-4">
          <MarkdownContent content={selected.question.question} />
          <p className="text-xs text-muted-foreground">
            Última resposta detalhada:{" "}
            {selected.lastAnswer ?? "não armazenada nos exercícios antigos do banco fixo"}.
          </p>
          <fieldset disabled={review.isPending || !!evaluation} className="space-y-2">
            <legend className="mb-2 text-sm font-medium">
              Tente novamente antes de consultar a explicação
            </legend>
            {selected.question.type === "open" ? (
              <Textarea
                aria-label="Nova resposta do caderno de erros"
                value={answer}
                maxLength={4000}
                onChange={(e) => setAnswer(e.target.value)}
              />
            ) : (
              selected.question.options.map((option, index) => (
                <label key={index} className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                  <input
                    type="radio"
                    name="error-retry"
                    checked={answer === String(index)}
                    onChange={() => setAnswer(String(index))}
                  />
                  {option}
                </label>
              ))
            )}
          </fieldset>
          <Button
            disabled={
              !answer.trim() ||
              saved ||
              review.isPending ||
              (selected.question.type === "open" && (ai.status !== "ready" || !selected.materialId))
            }
            onClick={async () => {
              setError("");
              try {
                await review.mutateAsync({ item: selected, value: answer });
                setSaved(true);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {review.isPending && <Spin />}
            {saved
              ? "Tentativa registrada"
              : evaluation
                ? "Tentar salvar revisão novamente"
                : "Conferir e registrar nova tentativa"}
          </Button>
          {selected.question.type === "open" && ai.status !== "ready" && (
            <p className="text-xs text-muted-foreground">
              A nova avaliação discursiva exige IA configurada e a fonte original. A explicação
              anterior continua disponível.
            </p>
          )}
          {evaluation && (
            <div role="status">
              <strong>
                {evaluation.correct ? "Correto nesta tentativa" : "Continue revisando"}
              </strong>
              <MarkdownContent content={evaluation.feedback} />
            </div>
          )}
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              Consultar resposta e explicação de referência
            </summary>
            <MarkdownContent
              content={`${selected.question.answer}\n\n${selected.question.explanation}`}
            />
          </details>
          <Button
            variant="outline"
            disabled={cardSaved || card.isPending}
            onClick={async () => {
              setError("");
              try {
                await card.mutateAsync(selected);
                setCardSaved(true);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {cardSaved ? "Cartão disponível na revisão" : "Criar flashcard deste erro"}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
