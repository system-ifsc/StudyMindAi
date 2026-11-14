import type { Flashcard } from "./types";
import { addDays } from "./dates";

/** 0 = errei, 1 = difícil, 2 = bom, 3 = fácil. Variação simplificada do SM-2. */
export type Grade = 0 | 1 | 2 | 3;

export function review(
  card: Pick<Flashcard, "interval_days" | "ease" | "reps">,
  grade: Grade,
  on: string,
) {
  let ease = Number(card.ease) || 2.5;
  let reps = card.reps;
  let interval: number;
  if (grade === 0) {
    reps = 0;
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    reps += 1;
    if (reps === 1) interval = grade === 3 ? 3 : 1;
    else if (reps === 2) interval = grade === 1 ? 3 : 6;
    else
      interval = Math.round(
        Math.max(1, card.interval_days) * (grade === 1 ? 1.2 : grade === 3 ? ease * 1.3 : ease),
      );
    ease = Math.min(3, Math.max(1.3, ease + (grade === 1 ? -0.15 : grade === 3 ? 0.15 : 0)));
  }
  interval = Math.min(365, interval);
  return {
    interval_days: interval,
    ease: Math.round(ease * 100) / 100,
    reps,
    due_date: addDays(on, interval),
  };
}
