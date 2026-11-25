import { z } from "zod";

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

const timerSchema = z.object({
  clientId: z.string().min(1),
  label: z.string().max(200),
  taskId: z.string().nullable(),
  subjectId: z.string().nullable(),
  targetMin: z.number().int().min(5).max(120),
  startedAt: z.number().finite().nonnegative(),
  accumulatedMs: z.number().finite().nonnegative(),
  runningSince: z.number().finite().nonnegative().nullable(),
});

export function restoreTimer(raw: string | null): TimerState | null {
  if (!raw) return null;
  try {
    const result = timerSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// Para no fim do ciclo mesmo se a aba só voltar a executar horas depois.
// Uma sessão retomada após esse ponto pode continuar além da meta.
export function completeCycle(s: TimerState, now: number): TimerState {
  const targetMs = s.targetMin * 60000;
  if (s.runningSince === null || s.accumulatedMs >= targetMs || elapsedMs(s, now) < targetMs)
    return s;
  return pauseTimer(s, s.runningSince + targetMs - s.accumulatedMs);
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

export function timerDurationError(minutes: number): string | null {
  return Number.isInteger(minutes) && minutes >= 5 && minutes <= 120
    ? null
    : "Escolha uma duração entre 5 e 120 minutos inteiros.";
}
