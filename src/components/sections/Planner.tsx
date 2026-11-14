import { useEffect, useState } from "react";
import { Cpu, AlertTriangle } from "lucide-react";
import { useProfile, useTable } from "@/hooks/use-data";
import { Empty, ErrorState, Loading, PageHeader, Panel } from "@/components/app/ui";
import { Badge } from "@/components/ui/badge";
import { formatBR, formatMinutes, today, WEEKDAYS_SHORT } from "@/lib/core/dates";
import { buildPlan } from "@/lib/core/planner";
import type { SectionProps } from "./registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Planner({ go }: SectionProps) {
  const [horizon, setHorizon] = useState(14);
  const [minBlock, setMinBlock] = useState(15);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const tasks = useTable("tasks"),
    profile = useProfile();
  useEffect(() => {
    const id = profile.data?.id;
    setLoadedOwner(null);
    if (!id) return;
    try {
      const saved = localStorage.getItem(`studymind-planner-${id}`);
      if (!saved) return;
      const value = JSON.parse(saved) as { horizon?: number; minBlock?: number };
      if (typeof value.horizon === "number") setHorizon(Math.max(1, Math.min(28, value.horizon)));
      if (typeof value.minBlock === "number")
        setMinBlock(Math.max(5, Math.min(60, value.minBlock)));
    } catch {
      // Preferências locais são opcionais.
    } finally {
      setLoadedOwner(id);
    }
  }, [profile.data?.id]);
  useEffect(() => {
    const id = profile.data?.id;
    if (!id || loadedOwner !== id) return;
    try {
      localStorage.setItem(`studymind-planner-${id}`, JSON.stringify({ horizon, minBlock }));
    } catch {
      // O navegador pode bloquear armazenamento local.
    }
  }, [profile.data?.id, loadedOwner, horizon, minBlock]);
  if (tasks.isLoading || profile.isLoading) return <Loading />;
  if (tasks.error || profile.error) return <ErrorState error={(tasks.error || profile.error)!} />;
  const t = today(),
    p = profile.data!;
  const { blocks, unscheduled } = buildPlan(tasks.data!, p.availability, t, horizon, minBlock);
  const byDay = blocks.reduce<Record<string, typeof blocks>>(
    (m, b) => ((m[b.date] ??= []).push(b), m),
    {},
  );
  const pending = tasks
    .data!.filter((x) => !x.done)
    .sort((a, b) => b.priority - a.priority || a.due_date.localeCompare(b.due_date));
  const top = pending.slice(0, Math.max(1, Math.ceil(pending.length * 0.2)));
  return (
    <div className="space-y-6">
      <PageHeader
        title="Planejador"
        description={`Distribui suas atividades pendentes nos próximos ${horizon} dias conforme sua disponibilidade e os prazos.`}
      />
      <div className="flex items-start gap-3 rounded-2xl border bg-surface p-4 text-sm">
        <Cpu className="mt-0.5 size-4 text-primary" aria-hidden />
        <p>
          <strong>Algoritmo determinístico, não IA.</strong> Regra: ordena por prazo, depois
          prioridade e título; preenche cada dia até o limite de minutos disponíveis, em blocos de
          no mínimo {minBlock} min, sem passar do prazo. Atrasadas entram hoje. Mesmos dados → mesmo
          plano.
        </p>
      </div>
      <Panel
        title="Sua disponibilidade"
        action={
          <Button size="sm" variant="ghost" onClick={() => go("configuracoes")}>
            Alterar
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2 text-sm">
          {WEEKDAYS_SHORT.map((d, i) => (
            <Badge key={d} variant="secondary">
              {d}: {formatMinutes(p.availability[i] ?? 0)}
            </Badge>
          ))}
        </div>
      </Panel>
      <Panel title="Parâmetros do plano">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="plan-horizon">Horizonte (dias)</Label>
            <Input
              id="plan-horizon"
              type="number"
              min={1}
              max={28}
              value={horizon}
              onChange={(e) => setHorizon(Math.max(1, Math.min(28, Number(e.target.value) || 14)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-block">Bloco mínimo (minutos)</Label>
            <Input
              id="plan-block"
              type="number"
              min={5}
              max={60}
              step={5}
              value={minBlock}
              onChange={(e) => setMinBlock(Math.max(5, Math.min(60, Number(e.target.value) || 15)))}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          O plano é recalculado no navegador e não altera suas atividades. Ajuste os parâmetros para
          comparar cenários antes de começar.
        </p>
      </Panel>
      {unscheduled.length > 0 && (
        <div
          role="alert"
          className="flex gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 text-warning" aria-hidden />
          <div>
            <p className="font-medium">Não cabe até o prazo:</p>
            <ul className="mt-1 list-disc pl-5">
              {unscheduled.map((u) => (
                <li key={u.taskId}>
                  {u.title} — faltam {formatMinutes(u.missingMinutes)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {blocks.length === 0 ? (
        <Empty
          title="Nada para planejar"
          text="Crie atividades pendentes com prazo."
          action={<Button onClick={() => go("atividades")}>Criar atividade</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(byDay).map(([d, bs]) => (
            <Panel
              key={d}
              title={d === t ? `Hoje · ${formatBR(d)}` : formatBR(d)}
              action={
                <span className="text-sm text-muted-foreground">
                  {formatMinutes(bs.reduce((n, b) => n + b.minutes, 0))}
                </span>
              }
            >
              <ul className="space-y-2">
                {bs.map((b, i) => (
                  <li
                    key={i}
                    className="flex justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-sm"
                  >
                    <span className="truncate">
                      {b.title}
                      {b.late && <span className="ml-2 text-destructive">(atrasada)</span>}
                    </span>
                    <span className="text-muted-foreground">{formatMinutes(b.minutes)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
      {pending.length > 0 && (
        <Panel title="Foco 80/20">
          <p className="mb-3 text-sm text-muted-foreground">
            Os 20% de atividades com maior prioridade e prazo mais próximo — comece por elas.
          </p>
          <ul className="space-y-1 text-sm">
            {top.map((x) => (
              <li key={x.id}>
                • {x.title} <span className="text-muted-foreground">({formatBR(x.due_date)})</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
