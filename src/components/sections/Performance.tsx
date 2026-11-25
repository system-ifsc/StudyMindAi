import { learningRewards } from "@/lib/core/engagement";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useProfile, useTable } from "@/hooks/use-data";
import { Empty, ErrorState, Loading, PageHeader, Panel, Stat } from "@/components/app/ui";
import { addDays, formatBR, formatMinutes, today } from "@/lib/core/dates";
import { dailySeries, minutesInRange, quizStats, streak } from "@/lib/core/metrics";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function Performance() {
  const profile = useProfile();
  const sessions = useTable("study_sessions"),
    subjects = useTable("subjects"),
    answers = useTable("quiz_answers");
  if (sessions.isLoading || profile.isLoading) return <Loading rows={4} />;
  if (sessions.error || profile.error)
    return <ErrorState error={(sessions.error || profile.error)!} retry={sessions.refetch} />;
  const ss = sessions.data!;
  const weekEnd = today();
  const weekStart = addDays(weekEnd, -6);
  const weekMinutes = minutesInRange(ss, weekStart, weekEnd);
  const weekTarget = Math.max(60, (profile.data?.weekly_hours ?? 0) * 60);
  const series = dailySeries(ss, today(), 14).map((d) => ({ ...d, label: formatBR(d.date) }));
  const total = ss.reduce((n, s) => n + s.minutes, 0);
  const bySub = (subjects.data ?? [])
    .map((s) => ({
      name: s.name,
      value: ss.filter((x) => x.subject_id === s.id).reduce((n, x) => n + x.minutes, 0),
    }))
    .filter((x) => x.value > 0);
  const free = ss.filter((x) => !x.subject_id).reduce((n, x) => n + x.minutes, 0);
  if (free) bySub.push({ name: "Sem disciplina", value: free });
  const rewards = learningRewards(ss, answers.data ?? [], today());
  const q = quizStats(answers.data ?? []);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Desempenho"
        description="Gráficos calculados exclusivamente das suas sessões e respostas registradas."
      />
      <p className="text-sm text-muted-foreground">
        Tempo cronometrado vem do Foco. Questões respondidas contam como prática mesmo sem
        cronômetro; acertos descrevem o histórico e não certificam domínio de uma matéria. Retome as
        dificuldades no caderno de erros em Exercícios.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Tempo cronometrado"
          value={formatMinutes(total)}
          hint={`${ss.length} sessões`}
        />
        <Stat
          label="Média por sessão"
          value={ss.length ? formatMinutes(Math.round(total / ss.length)) : "—"}
        />
        <Stat
          label="Acertos registrados"
          value={q.total ? `${q.pct}%` : "—"}
          hint={`${q.correct} de ${q.total} respostas`}
        />
        <Stat
          label="Sequência atual"
          value={`${streak(ss, today())} dia(s)`}
          hint="Dias consecutivos com estudo"
        />
        <Stat
          label="Meta da semana"
          value={`${Math.min(100, Math.round((weekMinutes / weekTarget) * 100))}%`}
          hint={`${formatMinutes(weekMinutes)} de ${formatMinutes(weekTarget)}`}
        />
      </div>
      {!answers.isLoading && !answers.error && (
        <Panel title="Conquistas pessoais">
          <p className="font-semibold">
            Nível {rewards.level} · {rewards.xp} XP · {rewards.nextLevel} XP para o próximo nível
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Progresso privado: 1 XP por minuto (até 60 por dia), 5 por acerto e 2 por tentativa.
            Calculado dos registros atuais.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {rewards.badges.map((b) => (
              <li key={b.title}>
                {b.earned ? "✓" : "○"} {b.title} — {b.description}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            Desafio opcional de hoje: responder 5 questões · {rewards.challenge.progress}/5{" "}
            {rewards.challenge.completed && "· Concluído"}
          </p>
        </Panel>
      )}
      {ss.length === 0 ? (
        <Empty
          title="Sem sessões registradas"
          text="Use o modo Foco para registrar seu tempo de estudo."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Panel title="Minutos por dia (14 dias)">
            <div
              className="h-64"
              role="img"
              aria-label="Gráfico de barras de minutos estudados por dia"
            >
              <ResponsiveContainer>
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    interval={1}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={32} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                    }}
                    formatter={(v: number) => [`${v} min`, "Estudo"]}
                  />
                  <Bar dataKey="minutes" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Por disciplina">
            <div className="h-64" role="img" aria-label="Distribuição de minutos por disciplina">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={bySub}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {bySub.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatMinutes(v)}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {bySub.map((s, i) => (
                <li key={s.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: COLORS[i % COLORS.length] }}
                      aria-hidden
                    />
                    {s.name}
                  </span>
                  <span className="text-muted-foreground">{formatMinutes(s.value)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
      {q.byTopic.length > 0 && (
        <Panel title="Exercícios por tema">
          <ul className="space-y-3">
            {q.byTopic.map((t) => (
              <li key={t.topic}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{t.topic}</span>
                  <span className="text-muted-foreground">
                    {t.correct}/{t.total} · {t.pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-brand" style={{ width: `${t.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
