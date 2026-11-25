import { parseISODate, toISODate } from "./dates";
import type { Material, QuizAnswer } from "./types";
import type {
  GeneratedQuestion,
  QuestionOption,
  QuestionSet,
  AttemptAnswer,
} from "./learning-data";
import type { Question } from "./questions";
import { studyQuestionSchema, type StudyQuestion } from "./study-tools";

/** Um orçamento de tempo, não uma promessa de domínio ou aprovação. */
export function examSprint(minutes: number) {
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 180)
    throw new Error("Informe entre 15 e 180 minutos inteiros.");
  const diagnostic = Math.max(5, Math.floor(minutes * 0.2));
  const practice = Math.max(5, Math.floor(minutes * 0.35));
  const review = minutes - diagnostic - practice;
  return [
    {
      title: "Diagnóstico: tente antes de consultar",
      minutes: diagnostic,
      action: "quiz" as const,
    },
    {
      title: "Revisão essencial: confira as lacunas",
      minutes: review,
      action: "simplified" as const,
    },
    { title: "Prática: teste o que compreendeu", minutes: practice, action: "quiz" as const },
  ];
}

export function examSprintTasks(material: Material, minutes: number, deadline: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || toISODate(parseISODate(deadline)) !== deadline)
    throw new Error("Escolha uma data válida para a prova.");
  return examSprint(minutes).map((step) => ({
    title: `${step.title} · ${material.name}`.slice(0, 200),
    notes: `Material: ${material.id}. Plano curto de revisão; tempos estimados, sem garantia de domínio.`,
    subject_id: material.subject_id ?? null,
    due_date: deadline,
    duration_min: step.minutes,
    priority: 3 as const,
    done: false,
    completed_at: null,
  }));
}
export interface ReviewError {
  id: string;
  question: StudyQuestion;
  materialId: string | null;
  setId: string | null;
  latestCorrect: boolean;
  mistakes: number;
  lastAnswer: string | null;
  lastAt: string;
}

/** Reconstrói o caderno de registros existentes. Não inventa a alternativa de respostas antigas. */
export function errorNotebook(
  history: QuizAnswer[],
  fixed: Question[],
  generated: GeneratedQuestion[],
  options: QuestionOption[],
  sets: QuestionSet[],
  attempts: AttemptAnswer[],
): ReviewError[] {
  const grouped = new Map<string, QuizAnswer[]>();
  for (const answer of history)
    grouped.set(answer.question_id, [...(grouped.get(answer.question_id) ?? []), answer]);
  const result: ReviewError[] = [];
  for (const [id, answers] of grouped) {
    const mistakes = answers.filter((a) => !a.correct).length;
    if (!mistakes) continue;
    const latest = [...answers].sort(
      (a, b) => b.answered_at.localeCompare(a.answered_at) || b.id.localeCompare(a.id),
    )[0]!;
    const known = fixed.find((q) => q.id === id),
      saved = generated.find((q) => q.id === id);
    const opts = options
      .filter((o) => o.question_id === id)
      .sort((a, b) => a.position - b.position);
    const parsed = studyQuestionSchema.safeParse(
      known
        ? {
            type: "multiple_choice",
            topic: known.topic,
            question: known.q,
            options: known.opts,
            correct: known.correct,
            answer: known.opts[known.correct],
            explanation: known.why,
          }
        : saved
          ? {
              type: saved.kind === "essay" || saved.kind === "short_answer" ? "open" : saved.kind,
              topic:
                typeof saved.rubric["topic"] === "string" ? saved.rubric["topic"] : latest.topic,
              question: saved.prompt,
              options: opts.map((o) => o.content),
              correct: opts.length ? opts.findIndex((o) => o.is_correct) : null,
              answer: saved.expected_answer,
              explanation: saved.explanation,
            }
          : null,
    );
    if (!parsed.success) continue;
    const attempted = [...attempts]
      .filter((a) => a.question_id === id && a.correct !== null)
      .sort((a, b) =>
        (b.evaluated_at ?? b.answered_at).localeCompare(a.evaluated_at ?? a.answered_at),
      )[0];
    const lastAnswer = attempted
      ? parsed.data.type === "open"
        ? attempted.answer
        : (parsed.data.options[Number(attempted.answer)] ?? null)
      : null;
    result.push({
      id,
      question: parsed.data,
      materialId: sets.find((s) => s.id === saved?.set_id)?.material_id ?? null,
      setId: saved?.set_id ?? null,
      latestCorrect: latest.correct,
      mistakes,
      lastAnswer,
      lastAt: latest.answered_at,
    });
  }
  return result.sort(
    (a, b) =>
      Number(a.latestCorrect) - Number(b.latestCorrect) ||
      b.lastAt.localeCompare(a.lastAt) ||
      a.id.localeCompare(b.id),
  );
}
