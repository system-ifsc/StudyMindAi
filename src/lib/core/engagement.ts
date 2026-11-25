import type { Flashcard, QuizAnswer, StudySession, Material, Task } from "./types";
import { addDays, toISODate } from "./dates";

/** Pontos privados derivados de registros reais, sem competição nem incentivo a longas sessões. */
export function learningRewards(sessions: StudySession[], answers: QuizAnswer[], ref: string) {
  const daily = new Map<string, number>();
  for (const s of new Map(sessions.map((s) => [s.client_id, s])).values()) {
    const day = toISODate(new Date(s.started_at));
    daily.set(day, (daily.get(day) ?? 0) + Math.max(0, s.minutes));
  }
  const uniqueAnswers = [...new Map(answers.map((a) => [a.id, a])).values()];
  const xp =
    [...daily.values()].reduce((n, minutes) => n + Math.min(60, Math.floor(minutes)), 0) +
    uniqueAnswers.reduce((n, a) => n + (a.correct ? 5 : 2), 0);
  const todayAnswers = uniqueAnswers.filter(
    (a) => toISODate(new Date(a.answered_at)) === ref,
  ).length;
  return {
    xp,
    level: Math.floor(xp / 100) + 1,
    nextLevel: 100 - (xp % 100),
    badges: [
      {
        title: "Primeiro passo",
        earned: daily.size > 0,
        description: "Registrar uma sessão de estudo",
      },
      {
        title: "Prática ativa",
        earned: uniqueAnswers.length >= 10,
        description: "Responder dez questões",
      },
      {
        title: "Rotina em construção",
        earned: daily.size >= 5,
        description: "Estudar em cinco dias diferentes",
      },
    ],
    challenge: { completed: todayAnswers >= 5, progress: Math.min(5, todayAnswers), target: 5 },
  };
}

/** Pares distintos evitam respostas ambíguas; só usa cartões reais do estudante. */
export function matchingPairs(cards: Flashcard[]) {
  const fronts = new Set<string>(),
    backs = new Set<string>();
  return [...cards]
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter((c) => {
      const front = c.front.trim().toLocaleLowerCase(),
        back = c.back.trim().toLocaleLowerCase();
      if (!front || !back || fronts.has(front) || backs.has(back)) return false;
      fronts.add(front);
      backs.add(back);
      return true;
    })
    .slice(0, 6);
}

/** Datas fixas de revisão, compatíveis com calendário e planejador existentes. */
export function materialReviewTasks(material: Material, start: string, existing: Task[]) {
  return [1, 7, 30]
    .filter(
      (offset) =>
        !existing.some(
          (t) =>
            t.notes === `Revisão do material: ${material.id}` &&
            t.due_date === addDays(start, offset),
        ),
    )
    .map((offset) => ({
      subject_id: material.subject_id ?? null,
      title: `Revisar: ${material.name}`.slice(0, 200),
      notes: `Revisão do material: ${material.id}`,
      due_date: addDays(start, offset),
      duration_min: 20,
      priority: 2 as const,
      done: false,
      completed_at: null,
    }));
}
