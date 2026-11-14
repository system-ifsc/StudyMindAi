/**
 * Cronômetro baseado em timestamps: o tempo decorrido é calculado a partir de
 * Date.now(), nunca de contadores de setInterval. Sobrevive a recarregar a página
 * (estado salvo no navegador) e a abas em segundo plano.
 */
export function timerStorageKey(mode: "real" | "demo", ownerId: string): string {
  return `studymind-timer-${mode}-${ownerId}`;
}

export interface TimerState {
  clientId: string; // identifica a sessão — o registro no banco é idempotente por ele
  label: string;
  taskId: string | null;
  subjectId: string | null;
  targetMin: number;
  startedAt: number;
  accumulatedMs: number;
  runningSince: number | null;
}

export function startTimer(
  p: {
    clientId: string;
    label: string;
    taskId: string | null;
    subjectId: string | null;
    targetMin: number;
  },
  now: number,
): TimerState {
  return { ...p, startedAt: now, accumulatedMs: 0, runningSince: now };
}
export function pauseTimer(s: TimerState, now: number): TimerState {
  if (s.runningSince == null) return s;
  return {
    ...s,
    accumulatedMs: s.accumulatedMs + Math.max(0, now - s.runningSince),
    runningSince: null,
  };
}
export function resumeTimer(s: TimerState, now: number): TimerState {
  if (s.runningSince != null) return s;
  return { ...s, runningSince: now };
}
export function elapsedMs(s: TimerState, now: number): number {
  return s.accumulatedMs + (s.runningSince != null ? Math.max(0, now - s.runningSince) : 0);
}
export function sessionMinutes(s: TimerState, now: number): number {
  return Math.min(480, Math.floor(elapsedMs(s, now) / 60000));
}
