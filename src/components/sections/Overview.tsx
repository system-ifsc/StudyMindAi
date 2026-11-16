import { Clock, Flame, CheckCircle2, Layers, ArrowRight, AlertCircle } from "lucide-react";
import { useProfile, useTable } from "@/hooks/use-data";
import { Panel, Stat, Loading, ErrorState, Empty, Dot } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { addDays, formatBR, formatMinutes, today } from "@/lib/core/dates";
import { completion, dueCards, minutesInRange, overdueTasks, streak } from "@/lib/core/metrics";
import { buildPlan } from "@/lib/core/planner";
import { learningRecommendations } from "@/lib/core/learning";
import type { SectionProps } from "./registry";

export function Overview({ go }: SectionProps) {
  const profile = useProfile(),
    tasks = useTable("tasks"),
    sessions = useTable("study_sessions"),
    cards = useTable("flashcards"),
    subjects = useTable("subjects"),
    answers = useTable("quiz_answers");
  const queries = [profile, tasks, sessions, cards, subjects, answers];
  if (queries.some((q) => q.isLoading)) return <Loading rows={4} />;
  const err = queries.find((q) => q.error)?.error;
  if (err)
    return (
      <ErrorState
        error={err}
        retry={() => {
          queries.forEach((q) => void q.refetch());
        }}
      />
    );
  const t = today(),
    p = profile.data!,
    ts = tasks.data!,
    ss = sessions.data!;
  const week = minutesInRange(ss, addDays(t, -6), t);
  const goal = p.weekly_hours * 60;
  const comp = completion(ts);
  const due = dueCards(cards.data ?? [], t).length;
  const late = overdueTasks(ts, t);
  const todayPlan = buildPlan(ts, p.availability, t, 14).blocks.filter((b) => b.date === t);
  const subj = (id: string | null) => subjects.data?.find((s) => s.id === id);
  const upcoming = ts
    .filter((x) => !x.done)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">
          Olá{p.display_name ? `, ${p.display_name.split(" ")[0]}` : ""}. Seu aprendizado, em
          movimento.
        </h1>
        {p.objective && <p className="mt-2 text-muted-foreground">Objetivo: {p.objective}</p>}
      </div>
      <Panel title="Sua central de aprendizagem">
        <p className="mb-4 text-sm text-muted-foreground">
          Sugestões calculadas por regras determinísticas com base no seu histórico, prazos e
          revisões.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {learningRecommendations(ts, cards.data ?? [], answers.data ?? [], ss, t).map((item) => (
            <button
              key={item.title}
              onClick={() => go(item.section)}
              className="rounded-xl border bg-surface p-4 text-left hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="block font-medium">{item.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{item.reason}</span>
            </button>
          ))}
        </div>
      </Panel>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Estudo nos últimos 7 dias"
          value={formatMinutes(week)}
          hint={`Meta: ${p.weekly_hours}h`}
        />
        <Stat
          label="Sequência"
          value={
            <span className="inline-flex items-center gap-2">
              <Flame className="size-6 text-warning" aria-hidden />
              {streak(ss, t)} dias
            </span>
          }
        />
        <Stat
          label="Atividades concluídas"
          value={`${comp.pct}%`}
          hint={`${comp.done} de ${comp.total}`}
        />
        <Stat label="Cartões para revisar" value={due} hint="vencidos até hoje" />
      </div>
      <Panel title="Meta semanal">
        <Progress
          value={goal ? Math.min(100, (week / goal) * 100) : 0}
          aria-label="Progresso da meta semanal"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          {formatMinutes(week)} de {formatMinutes(goal)} · calculado das sessões registradas
        </p>
      </Panel>
      {late.length > 0 && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          <AlertCircle className="size-4 text-warning" aria-hidden /> {late.length} atividade(s) com
          prazo vencido.
          <Button size="sm" variant="link" onClick={() => go("atividades")}>
            Revisar
          </Button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Hoje no plano"
          action={
            <Button size="sm" variant="ghost" onClick={() => go("planejador")}>
              Planejador <ArrowRight className="size-4" aria-hidden />
            </Button>
          }
        >
          <p className="mb-3 text-xs text-muted-foreground">
            Planejamento calculado por algoritmo determinístico.
          </p>
          {todayPlan.length === 0 ? (
            <Empty
              title="Nada planejado para hoje"
              text="Adicione atividades com prazo ou ajuste sua disponibilidade."
            />
          ) : (
            <ul className="space-y-2">
              {todayPlan.map((b, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-surface px-4 py-3"
                >
                  <span className="flex items-center gap-2">
                    <Clock className="size-4 text-primary" aria-hidden />
                    {b.title}
                  </span>
                  <span className="text-sm text-muted-foreground">{formatMinutes(b.minutes)}</span>
                </li>
              ))}
            </ul>
          )}
          <Button className="mt-4 rounded-full" onClick={() => go("foco")}>
            Iniciar foco
          </Button>
        </Panel>
        <Panel
          title="Próximos prazos"
          action={
            <Button size="sm" variant="ghost" onClick={() => go("atividades")}>
              Ver todas <ArrowRight className="size-4" aria-hidden />
            </Button>
          }
        >
          {upcoming.length === 0 ? (
            <Empty
              title="Sem atividades pendentes"
              action={
                <Button size="sm" onClick={() => go("atividades")}>
                  Criar atividade
                </Button>
              }
            />
          ) : (
            <ul className="divide-y">
              {upcoming.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <Dot color={subj(x.subject_id)?.color} />
                    <span className="truncate">{x.title}</span>
                  </span>
                  <span
                    className={
                      x.due_date < t ? "text-sm text-destructive" : "text-sm text-muted-foreground"
                    }
                  >
                    {formatBR(x.due_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      {due > 0 && (
        <Panel>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <Layers className="size-5 text-ifsc-red" aria-hidden />
              {due} cartão(ões) aguardando revisão.
            </span>
            <Button size="sm" onClick={() => go("flashcards")}>
              <CheckCircle2 className="size-4" aria-hidden />
              Revisar
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
