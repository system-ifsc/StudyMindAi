import type { Task } from "./types";
import { addDays, weekdayIndex } from "./dates";

export interface PlanBlock {
  date: string;
  taskId: string;
  title: string;
  minutes: number;
  late: boolean;
}
export interface PlanResult {
  blocks: PlanBlock[];
  unscheduled: { taskId: string; title: string; missingMinutes: number }[];
}

/**
 * Planejador DETERMINÍSTICO (não é IA): ordena atividades pendentes por prazo,
 * depois prioridade (3 = alta) e título; distribui os minutos de cada uma nos dias
 * disponíveis a partir de `start` até o prazo, dividindo em blocos de no mínimo
 * `minBlock` minutos. Atividades atrasadas entram no primeiro dia com marcação `late`.
 * Mesma entrada → mesma saída.
 */
export function buildPlan(
  tasks: Task[],
  availability: number[],
  start: string,
  horizonDays = 14,
  minBlock = 15,
  rescheduleOverdue = false,
  rank?: ReadonlyMap<string, number>,
): PlanResult {
  const pending = tasks
    .filter((t) => !t.done)
    .sort(
      (a, b) =>
        a.due_date.localeCompare(b.due_date) ||
        (rank?.get(a.id) ?? 0) - (rank?.get(b.id) ?? 0) ||
        b.priority - a.priority ||
        a.title.localeCompare(b.title) ||
        a.id.localeCompare(b.id),
    );
  const capacity = new Map<string, number>();
  for (let i = 0; i < horizonDays; i++) {
    const d = addDays(start, i);
    capacity.set(d, Math.max(0, availability[weekdayIndex(d)] ?? 0));
  }
  const blocks: PlanBlock[] = [];
  const unscheduled: PlanResult["unscheduled"] = [];
  for (const t of pending) {
    let remaining = t.duration_min;
    const late = t.due_date < start;
    const lastDay = late
      ? rescheduleOverdue
        ? addDays(start, horizonDays - 1)
        : start
      : t.due_date;
    for (let i = 0; i < horizonDays && remaining > 0; i++) {
      const d = addDays(start, i);
      if (d > lastDay) break;
      const free = capacity.get(d) ?? 0;
      if (free < Math.min(minBlock, remaining)) continue;
      const use = Math.min(free, remaining);
      capacity.set(d, free - use);
      remaining -= use;
      blocks.push({ date: d, taskId: t.id, title: t.title, minutes: use, late });
    }
    if (remaining > 0)
      unscheduled.push({ taskId: t.id, title: t.title, missingMinutes: remaining });
  }
  blocks.sort((a, b) => a.date.localeCompare(b.date));
  return { blocks, unscheduled };
}
