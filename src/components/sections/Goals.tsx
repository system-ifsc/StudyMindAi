import { type FormEvent } from "react";
import { useInsert, useProfile, useRemove, useTable, useUpdate } from "@/hooks/use-data";
import { ConfirmDelete, Empty, ErrorState, Loading, PageHeader, Panel } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { addDays, formatBR, formatMinutes, today } from "@/lib/core/dates";
import { minutesInRange } from "@/lib/core/metrics";

export function Goals() {
  const goals = useTable("goals"),
    profile = useProfile(),
    sessions = useTable("study_sessions");
  const ins = useInsert("goals", "Meta criada"),
    upd = useUpdate("goals"),
    del = useRemove("goals");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    const title = String(f.get("title")).trim();
    if (!title) return;
    ins.mutate(
      { title, target_date: String(f.get("date")) || null, done: false },
      { onSuccess: () => form.reset() },
    );
  }
  const t = today();
  const week = minutesInRange(sessions.data ?? [], addDays(t, -6), t),
    goal = (profile.data?.weekly_hours ?? 0) * 60;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Metas"
        description="Defina conquistas concretas e acompanhe a meta semanal de horas."
      />
      <Panel title="Meta semanal de estudo">
        <Progress
          value={goal ? Math.min(100, (week / goal) * 100) : 0}
          aria-label="Progresso semanal"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          {formatMinutes(week)} de {formatMinutes(goal)} nos últimos 7 dias. Altere em
          Configurações.
        </p>
      </Panel>
      <Panel title="Minhas metas">
        <form onSubmit={submit} className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Input
            name="title"
            placeholder="Ex.: Terminar a lista de SQL"
            aria-label="Nova meta"
            maxLength={200}
            required
          />
          <Input name="date" type="date" aria-label="Data-alvo (opcional)" className="sm:w-44" />
          <Button type="submit" disabled={ins.isPending}>
            Adicionar
          </Button>
        </form>
        {goals.isLoading ? (
          <Loading />
        ) : goals.error ? (
          <ErrorState error={goals.error} />
        ) : goals.data!.length === 0 ? (
          <Empty title="Nenhuma meta ainda" />
        ) : (
          <ul className="divide-y">
            {goals.data!.map((g) => (
              <li key={g.id} className="flex items-center gap-3 py-3">
                <Checkbox
                  checked={g.done}
                  onCheckedChange={() => upd.mutate({ id: g.id, patch: { done: !g.done } })}
                  aria-label={`Marcar meta ${g.title}`}
                />
                <span
                  className={
                    g.done
                      ? "min-w-0 flex-1 break-words text-muted-foreground line-through"
                      : "min-w-0 flex-1 break-words"
                  }
                >
                  {g.title}
                </span>
                {g.target_date && (
                  <span
                    className={
                      !g.done && g.target_date < t
                        ? "text-sm text-destructive"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {formatBR(g.target_date)}
                  </span>
                )}
                <ConfirmDelete what={g.title} onConfirm={() => del.mutate(g.id)} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
