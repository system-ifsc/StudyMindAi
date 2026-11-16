import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useProfile, useTable } from "@/hooks/use-data";
import { ErrorState, Loading, PageHeader, Dot } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import {
  addDays,
  formatBR,
  formatMinutes,
  startOfWeek,
  today,
  toISODate,
  WEEKDAYS_SHORT,
} from "@/lib/core/dates";
import { buildAdaptivePlan } from "@/lib/core/adaptive-plan";
import { cn } from "@/lib/utils";

export function Calendar() {
  const answers = useTable("quiz_answers"),
    tasks = useTable("tasks"),
    profile = useProfile(),
    subjects = useTable("subjects"),
    sessions = useTable("study_sessions");
  const [week, setWeek] = useState(() => startOfWeek(today()));
  if ([tasks, profile, subjects, sessions, answers].some((q) => q.isLoading)) return <Loading />;
  const error = [tasks, profile, subjects, sessions, answers].find((q) => q.error)?.error;
  if (error) return <ErrorState error={error} />;
  const t = today();
  const plan = buildAdaptivePlan(
    tasks.data!,
    profile.data!.availability,
    t,
    subjects.data!,
    answers.data!,
    sessions.data!,
    28,
  ).blocks;
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const color = (id: string | null) => subjects.data?.find((s) => s.id === id)?.color;
  return (
    <div>
      <PageHeader
        title="Calendário semanal"
        description="Prazos, blocos sugeridos pelo planejador e minutos estudados em cada dia."
        actions={
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              aria-label="Semana anterior"
              onClick={() => setWeek(addDays(week, -7))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" onClick={() => setWeek(startOfWeek(t))}>
              Hoje
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="Próxima semana"
              onClick={() => setWeek(addDays(week, 7))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        {days.map((d, i) => {
          const due = tasks.data!.filter((x) => x.due_date === d);
          const blocks = plan.filter((b) => b.date === d);
          const studied = (sessions.data ?? [])
            .filter((s) => toISODate(new Date(s.started_at)) === d)
            .reduce((n, s) => n + s.minutes, 0);
          return (
            <section
              key={d}
              aria-label={formatBR(d)}
              className={cn(
                "glass-panel min-w-0 min-h-40 rounded-2xl border bg-card p-3 shadow-card",
                d === t && "ring-2 ring-primary",
              )}
            >
              <p className="text-xs text-muted-foreground">{WEEKDAYS_SHORT[i]}</p>
              <p className="font-display text-lg font-semibold">{formatBR(d)}</p>
              {studied > 0 && (
                <p className="mt-1 text-xs text-success">{formatMinutes(studied)} estudados</p>
              )}
              <ul className="mt-2 space-y-1.5">
                {due.map((x) => (
                  <li
                    key={x.id}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2 py-1 text-xs",
                      x.done && "opacity-50 line-through",
                    )}
                  >
                    <Dot color={color(x.subject_id)} />
                    <span className="truncate">Prazo: {x.title}</span>
                  </li>
                ))}
                {blocks.map((b, j) => (
                  <li
                    key={j}
                    className="rounded-lg bg-accent px-2 py-1 text-xs text-accent-foreground"
                  >
                    <span className="block truncate">{b.title}</span>
                    {formatMinutes(b.minutes)}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Blocos em verde são sugestões do planejador (algoritmo determinístico); prazos aparecem em
        vermelho.
      </p>
    </div>
  );
}
