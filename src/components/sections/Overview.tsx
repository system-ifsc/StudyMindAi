import {
  Clock,
  Timer,
  Flame,
  CheckCircle2,
  Layers,
  ArrowRight,
  AlertCircle,
  Play,
  BookOpen,
  CalendarDays,
  TrendingUp,
  ArrowUpRight,
  Target,
} from "lucide-react";
import { useProfile, useTable } from "@/hooks/use-data";
import { Panel, Stat, Loading, ErrorState, Empty, Dot } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { addDays, formatBR, formatMinutes, today } from "@/lib/core/dates";
import { completion, dueCards, minutesInRange, overdueTasks, streak } from "@/lib/core/metrics";
import { buildAdaptivePlan } from "@/lib/core/adaptive-plan";
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
  const todayPlan = buildAdaptivePlan(
    ts,
    p.availability,
    t,
    subjects.data ?? [],
    answers.data ?? [],
    ss,
    14,
  ).blocks.filter((b) => b.date === t);
  const subj = (id: string | null) => subjects.data?.find((s) => s.id === id);
  const upcoming = ts
    .filter((x) => !x.done)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5);

  return (
    <div className="overview-page space-y-6">
      <div className="overview-greeting">
        <p className="overview-date text-sm text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Olá{p.display_name ? `, ${p.display_name.split(" ")[0]}` : ""} <span aria-hidden>✦</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {p.objective || "Um passo de cada vez. Seu próximo começa aqui."}
        </p>
      </div>
      <div className="overview-spotlight">
        <section className="focus-hero" aria-labelledby="focus-heading">
          <div className="relative z-10 max-w-[75%]">
            <span className="hero-eyebrow">
              <span className="size-1.5 rounded-full bg-current" /> SEU MOMENTO DE FOCO
            </span>
            <h2 id="focus-heading" className="mt-4 text-2xl font-bold leading-tight sm:text-3xl">
              Pequenos passos.
              <br />
              Grandes conquistas.
            </h2>
            <p className="mt-3 max-w-xs text-sm leading-relaxed opacity-75">
              Reserve um momento para aprender algo novo hoje.
            </p>
            <Button onClick={() => go("foco")} className="hero-start mt-5">
              <Play className="size-4" aria-hidden /> Começar a estudar{" "}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
          <div className="focus-art" aria-hidden="true">
            <span className="focus-art-ring" />
            <div className="focus-clock">
              <svg viewBox="0 0 160 160" fill="none">
                <circle cx="80" cy="80" r="68" className="clock-track" />
                <circle cx="80" cy="80" r="68" className="clock-arc" />
              </svg>
              <span className="clock-hand clock-hand-minute" />
              <span className="clock-hand clock-hand-hour" />
              <span className="clock-pin" />
            </div>
            <span className="focus-art-caption">
              <Timer className="size-3.5" /> Um passo de cada vez
            </span>
          </div>
        </section>
        <Panel className="weekly-card">
          <div className="weekly-card-heading">
            <span className="weekly-icon">
              <Target className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Seu compromisso com você</p>
              <h2 className="mt-1 font-semibold">Meta semanal</h2>
            </div>
            <TrendingUp className="ml-auto size-5 text-primary" aria-hidden />
          </div>
          <div
            className="weekly-progress"
            role="img"
            aria-label={`${formatMinutes(week)} de ${formatMinutes(goal)} na meta semanal`}
          >
            <svg viewBox="0 0 160 160" aria-hidden="true">
              <circle className="weekly-track" cx="80" cy="80" r="66" />
              <circle
                className="weekly-fill"
                cx="80"
                cy="80"
                r="66"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={100 - (goal ? Math.min(100, (week / goal) * 100) : 0)}
              />
            </svg>
            <div>
              <strong>{formatMinutes(week)}</strong>
              <span>de {formatMinutes(goal)}</span>
            </div>
          </div>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Cada sessão faz a diferença.
            <br />
            Progresso das sessões registradas.
          </p>
          <Button
            variant="ghost"
            className="mt-3 w-full text-primary"
            onClick={() => go("desempenho")}
          >
            Ver minha evolução <ArrowUpRight className="size-4" aria-hidden />
          </Button>
        </Panel>
      </div>
      <div className="grid grid-cols-3 gap-3" aria-label="Atalhos de estudo">
        {[
          { key: "disciplinas", label: "Disciplinas", icon: BookOpen, color: "mint" },
          { key: "planejador", label: "Meu plano", icon: CalendarDays, color: "lilac" },
          { key: "flashcards", label: "Flashcards", icon: Layers, color: "peach" },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => go(item.key)}
            className={`study-shortcut ${item.color}`}
          >
            <span>
              <item.icon className="size-5" aria-hidden />
            </span>
            <span className="shortcut-copy">
              {item.label}
              <small>
                {item.key === "disciplinas"
                  ? "Organize seu conhecimento"
                  : item.key === "planejador"
                    ? "Encontre seu próximo passo"
                    : "Fixe o que você aprendeu"}
              </small>
            </span>
            <ArrowUpRight className="shortcut-arrow size-4" aria-hidden />
          </button>
        ))}
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
              className="recommendation-card rounded-xl border bg-surface p-4 text-left hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="block font-medium">{item.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{item.reason}</span>
            </button>
          ))}
        </div>
      </Panel>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={Clock}
          label="Estudo nos últimos 7 dias"
          value={formatMinutes(week)}
          hint={`Meta: ${p.weekly_hours}h`}
        />
        <Stat
          icon={Flame}
          label="Sequência"
          value={<span className="inline-flex items-center gap-2">{streak(ss, t)} dias</span>}
        />
        <Stat
          icon={CheckCircle2}
          label="Atividades concluídas"
          value={`${comp.pct}%`}
          hint={`${comp.done} de ${comp.total}`}
        />
        <Stat icon={Layers} label="Cartões para revisar" value={due} hint="vencidos até hoje" />
      </div>
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
              <Layers className="size-5 text-primary" aria-hidden />
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
