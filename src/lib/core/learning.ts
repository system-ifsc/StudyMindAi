import type { Flashcard, QuizAnswer, StudySession, Task } from "./types";
import { dueCards, quizStats } from "./metrics";
import { studyOutputSchema } from "./study-tools";
import type {
  QuestionSet,
  GeneratedQuestion,
  QuestionOption,
  AttemptAnswer,
} from "./learning-data";

export function restoreQuiz(
  set: QuestionSet,
  questions: GeneratedQuestion[],
  options: QuestionOption[],
  recorded: AttemptAnswer[],
) {
  const rows = questions.filter((q) => q.set_id === set.id).sort((a, b) => a.position - b.position);
  if (
    rows.some(
      (q) =>
        typeof q.rubric["expected_questions"] === "number" &&
        q.rubric["expected_questions"] !== rows.length,
    )
  )
    return null;
  const parsed = studyOutputSchema.safeParse({
    type: "quiz",
    title: set.title,
    questions: rows.map((q) => {
      const opts = options
        .filter((o) => o.question_id === q.id)
        .sort((a, b) => a.position - b.position);
      const correct = opts.findIndex((o) => o.is_correct);
      return {
        type: q.kind === "essay" || q.kind === "short_answer" ? "open" : q.kind,
        topic: typeof q.rubric["topic"] === "string" ? q.rubric["topic"] : "Geral",
        question: q.prompt,
        options: opts.map((o) => o.content),
        correct: correct < 0 ? null : correct,
        answer: q.expected_answer,
        explanation: q.explanation,
      };
    }),
  });
  if (!parsed.success || parsed.data.type !== "quiz") return null;
  const answers: Record<number, string> = {},
    evaluations: Record<number, { correct: boolean; feedback: string }> = {};
  rows.forEach((q, index) => {
    const a = recorded.find((a) => a.question_id === q.id);
    if (a) {
      answers[index] = a.answer;
      if (a.correct !== null) evaluations[index] = { correct: a.correct, feedback: a.evaluation };
    }
  });
  return { quiz: parsed.data, questionIds: rows.map((q) => q.id), answers, evaluations };
}

/** Recomendações determinísticas a partir de registros reais; não são previsões de domínio. */
export function learningRecommendations(
  tasks: Task[],
  cards: Flashcard[],
  answers: QuizAnswer[],
  sessions: StudySession[],
  ref: string,
) {
  const recommendations: { title: string; reason: string; section: string }[] = [];
  const pending = dueCards(cards, ref).length;
  if (pending)
    recommendations.push({
      title: "Revisar cartões",
      reason: `${pending} cartões chegaram à data de revisão.`,
      section: "flashcards",
    });
  const next = tasks
    .filter((t) => !t.done)
    .sort(
      (a, b) =>
        a.due_date.localeCompare(b.due_date) || b.priority - a.priority || a.id.localeCompare(b.id),
    )[0];
  if (next)
    recommendations.push({
      title: next.title,
      reason: `Próxima atividade por prazo: ${next.due_date}.`,
      section: "planejador",
    });
  const weakest = quizStats(answers)
    .byTopic.filter((t) => t.total >= 3 && t.pct < 70)
    .sort((a, b) => a.pct - b.pct || a.topic.localeCompare(b.topic))[0];
  if (weakest)
    recommendations.push({
      title: `Praticar ${weakest.topic}`,
      reason: `${weakest.correct} acertos em ${weakest.total} respostas registradas.`,
      section: "exercicios",
    });
  const last = [...sessions].sort(
    (a, b) => b.started_at.localeCompare(a.started_at) || a.id.localeCompare(b.id),
  )[0];
  if (last)
    recommendations.push({
      title: `Continuar estudando: ${last.title || "estudo livre"}`,
      reason: "Retome o foco após sua última sessão registrada.",
      section: "foco",
    });
  if (!recommendations.length)
    recommendations.push({
      title: "Preparar seu primeiro estudo",
      reason: "Adicione um material para ler, resumir e praticar.",
      section: "materiais",
    });
  return recommendations;
}
