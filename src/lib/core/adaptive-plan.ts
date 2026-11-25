import type { QuizAnswer, StudySession, Subject, Task } from "./types";
import { buildPlan } from "./planner";
import { quizStats } from "./metrics";
import { addDays, toISODate } from "./dates";

/** Evidência por disciplina: associação explícita pelo nome do tópico, sem inferir domínio. */
export function adaptiveTasks(
  tasks: Task[],
  subjects: Subject[],
  answers: QuizAnswer[],
  sessions: StudySession[],
  start: string,
) {
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  const topics = quizStats(answers).byTopic;
  return tasks
    .filter((task) => !task.done)
    .map((task) => {
      const subject = subjects.find((s) => s.id === task.subject_id);
      const evidence = topics.filter(
        (t) =>
          normalize(t.topic) === normalize(task.title) ||
          (subject && normalize(t.topic) === normalize(subject.name)),
      );
      const total = evidence.reduce((sum, t) => sum + t.total, 0);
      const correct = evidence.reduce((sum, t) => sum + t.correct, 0);
      const accuracy = total >= 3 ? Math.round((correct / total) * 100) : null;
      const studied = sessions
        .filter((s) => s.task_id === task.id && toISODate(new Date(s.started_at)) <= start)
        .reduce((sum, s) => sum + Math.max(0, s.minutes), 0);
      const remaining = Math.max(0, task.duration_min - studied);
      const score = task.priority * 100 + (accuracy === null ? 0 : 100 - accuracy);
      return {
        task: { ...task, duration_min: remaining },
        accuracy,
        total,
        score,
        reason:
          accuracy === null
            ? "Sem pelo menos 3 respostas associadas; prioridade original."
            : `${correct}/${total} acertos (${accuracy}%) no tópico associado.`,
      };
    })
    .filter((row) => row.task.duration_min > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.task.due_date.localeCompare(b.task.due_date) ||
        a.task.id.localeCompare(b.task.id),
    );
}

/** Reserva primeiro os prazos urgentes; dentro de cada prazo prioriza o foco 80/20 e as dificuldades. */
export function buildAdaptivePlan(
  tasks: Task[],
  availability: number[],
  start: string,
  subjects: Subject[],
  answers: QuizAnswer[],
  sessions: StudySession[],
  horizon = 14,
  minBlock = 15,
  dailyCapacity: Readonly<Record<string, number>> = {},
) {
  const ranked = adaptiveTasks(tasks, subjects, answers, sessions, start);
  const focus = ranked.slice(0, Math.ceil(ranked.length * 0.2));
  const rank = new Map(ranked.map((row, index) => [row.task.id, index]));
  const plan = buildPlan(
    ranked.map((row) => row.task),
    availability,
    start,
    horizon,
    minBlock,
    true,
    rank,
    dailyCapacity,
  );
  return { ...plan, focus, evidence: ranked, end: addDays(start, horizon - 1) };
}
