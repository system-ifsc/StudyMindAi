import { useEffect, useState } from "react";
import { Pause, Play, Square, X } from "lucide-react";
import { toast } from "sonner";
import { useProfile, useRepo, useSave, useTable } from "@/hooks/use-data";
import { NativeSelect, PageHeader, Panel, Spin } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  elapsedMs,
  completeCycle,
  pauseTimer,
  resumeTimer,
  restoreTimer,
  sessionMinutes,
  startTimer,
  timerStorageKey,
  timerDurationError,
  type TimerState,
} from "@/lib/core/pomodoro";
import { formatMinutes, today, toISODate } from "@/lib/core/dates";

export function Focus() {
  const repo = useRepo();
  const profile = useProfile();
  const tasks = useTable("tasks"),
    subjects = useTable("subjects"),
    sessions = useTable("study_sessions");
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const storageKey = profile.data?.id ? timerStorageKey(repo.mode, profile.data.id) : null;
  const [now, setNow] = useState(() => Date.now());
  const [taskId, setTaskId] = useState(""),
    [target, setTarget] = useState(25);
  const save = useSave<TimerState>(
    async (r, s) => {
      const end = Date.now();
      const task = tasks.data?.find((t) => t.id === s.taskId);
      await r.recordSession({
        client_id: s.clientId,
        task_id: s.taskId,
        subject_id: task?.subject_id ?? s.subjectId,
        title: s.label,
        started_at: new Date(s.startedAt).toISOString(),
        ended_at: new Date(end).toISOString(),
        minutes: sessionMinutes(s, end),
      });
    },
    { invalidate: ["study_sessions"], success: "Sessão registrada" },
  );

  useEffect(() => {
    if (!storageKey) {
      setTimer(null);
      setLoadedKey(null);
      return;
    }
    let restored: TimerState | null = null;
    try {
      restored = restoreTimer(localStorage.getItem(storageKey));
    } catch {
      // O navegador pode bloquear o armazenamento local.
    }
    setNow(Date.now());
    setTimer(restored);
    setLoadedKey(storageKey);
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey || loadedKey !== storageKey) return;
    try {
      if (timer) localStorage.setItem(storageKey, JSON.stringify(timer));
      else localStorage.removeItem(storageKey);
    } catch {
      // O cronômetro continua disponível na aba mesmo sem persistência local.
    }
  }, [timer, storageKey, loadedKey]);
  useEffect(() => {
    if (timer?.runningSince == null) return;
    const i = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(i);
  }, [timer?.runningSince]);

  const ms = timer ? elapsedMs(timer, now) : 0;
  const remaining = timer ? Math.max(0, timer.targetMin * 60000 - ms) : target * 60000;
  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0"),
    ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
  useEffect(() => {
    if (timer && completeCycle(timer, now) !== timer) {
      setTimer(completeCycle(timer, now));
      toast.success("Ciclo concluído! Registre a sessão ou continue.");
    }
  }, [now, timer]);

  const durationError = timerDurationError(target);
  function start() {
    if (durationError) {
      toast.error(durationError);
      return;
    }
    const task = tasks.data?.find((t) => t.id === taskId);
    setNow(Date.now());
    setTimer(
      startTimer(
        {
          clientId: crypto.randomUUID(),
          label: task?.title ?? "Estudo livre",
          taskId: task?.id ?? null,
          subjectId: task?.subject_id ?? null,
          targetMin: target,
        },
        Date.now(),
      ),
    );
  }
  function finish() {
    if (!timer) return;
    const s = pauseTimer(timer, Date.now());
    setTimer(s);
    if (sessionMinutes(s, Date.now()) < 1) {
      toast.error("Estude pelo menos 1 minuto para registrar.");
      return;
    }
    // O client_id torna o registro idempotente: clicar duas vezes ou repetir após falha de rede não duplica.
    save.mutate(s, { onSuccess: () => setTimer(null) });
  }
  const todayMin = (sessions.data ?? [])
    .filter((s) => toISODate(new Date(s.started_at)) === today())
    .reduce((n, s) => n + s.minutes, 0);

  return (
    <div>
      <PageHeader
        title="Foco (Pomodoro)"
        description="O tempo é calculado por horário real: pausar, trocar de aba ou recarregar a página não perde minutos."
      />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Panel className="focus-timer-panel flex flex-col items-center py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {timer ? timer.label : "Pronto para começar"}
          </p>
          <div
            className="focus-timer-display"
            data-running={timer?.runningSince != null || undefined}
          >
            <p
              className="my-4 font-display text-6xl font-semibold tabular-nums min-[400px]:text-7xl sm:text-8xl"
              aria-live="polite"
              aria-label={`${mm} minutos e ${ss} segundos restantes`}
            >
              {mm}
              <span className="timer-colon">:</span>
              {ss}
            </p>
          </div>
          {timer && (
            <p className="mb-4 text-sm text-muted-foreground">
              Decorrido: {Math.floor(ms / 60000)} min {timer.runningSince ? "" : "· pausado"}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {!timer && (
              <Button
                size="lg"
                variant="hero"
                onClick={start}
                disabled={!storageKey || loadedKey !== storageKey}
              >
                <Play className="size-4" aria-hidden />
                Iniciar
              </Button>
            )}
            {timer?.runningSince != null && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => setTimer(pauseTimer(timer, Date.now()))}
              >
                <Pause className="size-4" aria-hidden />
                Pausar
              </Button>
            )}
            {timer && timer.runningSince == null && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  setNow(Date.now());
                  setTimer(resumeTimer(timer, Date.now()));
                }}
              >
                <Play className="size-4" aria-hidden />
                Continuar
              </Button>
            )}
            {timer && (
              <Button size="lg" onClick={finish} disabled={save.isPending}>
                {save.isPending ? <Spin /> : <Square className="size-4" aria-hidden />}Concluir e
                registrar
              </Button>
            )}
            {timer && (
              <Button
                size="lg"
                variant="ghost"
                onClick={() => setTimer(null)}
                aria-label="Descartar sessão"
              >
                <X className="size-4" aria-hidden />
                Descartar
              </Button>
            )}
          </div>
        </Panel>
        <Panel title="Configurar">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="f-task">Atividade</Label>
              <NativeSelect
                id="f-task"
                value={timer ? (timer.taskId ?? "") : taskId}
                onChange={(e) => setTaskId(e.target.value)}
                disabled={!!timer}
              >
                <option value="">Estudo livre</option>
                {timer?.taskId && !tasks.data?.some((t) => t.id === timer.taskId) && (
                  <option value={timer.taskId}>{timer.label}</option>
                )}
                {tasks.data
                  ?.filter((t) => !t.done || t.id === timer?.taskId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-min">Duração do ciclo (min)</Label>
              <Input
                id="f-min"
                type="number"
                min={5}
                max={120}
                value={timer?.targetMin ?? target}
                disabled={!!timer}
                onChange={(e) => setTarget(Number(e.target.value))}
                aria-describedby="focus-duration-help"
                aria-invalid={!timer && !!durationError}
              />
              <p id="focus-duration-help" className="text-xs text-muted-foreground">
                Informe de 5 a 120 minutos inteiros. O ciclo não é alterado ao voltar para esta
                tela.
              </p>
              {!timer && durationError && (
                <p role="alert" className="text-sm text-destructive">
                  {durationError}
                </p>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Hoje: <strong className="text-foreground">{formatMinutes(todayMin)}</strong>{" "}
              registrados.
            </p>
            {subjects.data?.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Dica: ligue atividades a disciplinas para ver o tempo por disciplina.
              </p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
