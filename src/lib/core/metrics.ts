import type { QuizAnswer, StudySession, Task, Flashcard } from "./types";
import { addDays, toISODate } from "./dates";

const sessionDay = (s: StudySession) => toISODate(new Date(s.started_at));

export function minutesInRange(sessions: StudySession[], from: string, to: string) {
  return sessions
    .filter((s) => {
      const d = sessionDay(s);
      return d >= from && d <= to;
    })
    .reduce((n, s) => n + s.minutes, 0);
}
export function dailySeries(sessions: StudySession[], end: string, days: number) {
  const map = new Map<string, number>();
  for (const s of sessions) map.set(sessionDay(s), (map.get(sessionDay(s)) ?? 0) + s.minutes);
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(end, i - days + 1);
    return { date: d, minutes: map.get(d) ?? 0 };
  });
}
/** Dias consecutivos com estudo terminando hoje (ou ontem, se hoje ainda não houve). */
export function streak(sessions: StudySession[], ref: string) {
  const days = new Set(sessions.map(sessionDay));
  let d = days.has(ref) ? ref : addDays(ref, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
export function completion(tasks: Task[]) {
  const done = tasks.filter((t) => t.done).length;
  return {
    done,
    total: tasks.length,
    pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
  };
}
export function quizStats(answers: QuizAnswer[]) {
  const byTopic = new Map<string, { correct: number; total: number }>();
  let correct = 0;
  for (const a of answers) {
    const t = byTopic.get(a.topic) ?? { correct: 0, total: 0 };
    t.total++;
    if (a.correct) {
      t.correct++;
      correct++;
    }
    byTopic.set(a.topic, t);
  }
  return {
    correct,
    total: answers.length,
    pct: answers.length ? Math.round((correct / answers.length) * 100) : 0,
    byTopic: [...byTopic.entries()]
      .map(([topic, v]) => ({ topic, ...v, pct: Math.round((v.correct / v.total) * 100) }))
      .sort((a, b) => a.topic.localeCompare(b.topic)),
  };
}
export function dueCards(cards: Flashcard[], ref: string) {
  return cards.filter((c) => c.due_date <= ref);
}
export function overdueTasks(tasks: Task[], ref: string) {
  return tasks.filter((t) => !t.done && t.due_date < ref);
}
