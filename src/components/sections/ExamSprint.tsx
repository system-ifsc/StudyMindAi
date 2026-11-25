import { useRef, useState } from "react";
import { useSave, useTable } from "@/hooks/use-data";
import { examSprint, examSprintTasks } from "@/lib/core/study-path";
import { today, addDays } from "@/lib/core/dates";
import { Panel, NativeSelect, Spin } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Material } from "@/lib/core/types";
import { StudyTools } from "./StudyTools";

export function ExamSprint() {
  const materials = useTable("materials");
  const [materialId, setMaterialId] = useState("");
  const [minutes, setMinutes] = useState(40);
  const [deadline, setDeadline] = useState(() => addDays(today(), 1));
  const [active, setActive] = useState<{
    material: Material;
    minutes: number;
    deadline: string;
  } | null>(null);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const ids = useRef<string[]>([]);
  const save = useSave<void>(
    async (repo) => {
      if (!active) return;
      for (const [index, task] of examSprintTasks(
        active.material,
        active.minutes,
        active.deadline,
      ).entries()) {
        const id = ids.current[index]!;
        if (!(await repo.get("tasks", id))) await repo.insert("tasks", { ...task, id });
      }
    },
    { invalidate: ["tasks"], success: "Etapas adicionadas ao calendário e ao planejador" },
  );
  const steps = active ? examSprint(active.minutes) : [];
  return (
    <Panel title="Prova amanhã · revisão com o tempo que você tem">
      <p className="mb-4 text-sm text-muted-foreground">
        Escolha um material já salvo. O roteiro divide seu tempo entre diagnóstico, revisão e
        prática. É um planejamento determinístico; os tempos são estimativas.
      </p>
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          try {
            examSprint(minutes);
            const material = materials.data?.find((m) => m.id === materialId);
            if (!material) throw new Error("Selecione um material da biblioteca.");
            if (!deadline || deadline < today())
              throw new Error("Escolha uma data de hoje em diante.");
            setActive({ material, minutes, deadline });
            setStep(0);
            setSaved(false);
            ids.current = Array.from({ length: 3 }, () => crypto.randomUUID());
          } catch (error) {
            setError((error as Error).message);
          }
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="exam-source">Conteúdo da prova</Label>
          <NativeSelect
            id="exam-source"
            value={materialId}
            required
            disabled={save.isPending}
            onChange={(e) => setMaterialId(e.target.value)}
          >
            <option value="">Selecione um material</option>
            {materials.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="exam-minutes">Tempo disponível (min)</Label>
          <Input
            id="exam-minutes"
            type="number"
            min={15}
            max={180}
            value={minutes}
            disabled={save.isPending}
            onChange={(e) => setMinutes(Number(e.target.value))}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="exam-date">Data da prova</Label>
          <Input
            id="exam-date"
            type="date"
            min={today()}
            value={deadline}
            disabled={save.isPending}
            onChange={(e) => setDeadline(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={materials.isLoading || !!materials.error || save.isPending}>
          Montar revisão
        </Button>
      </form>
      {materials.error && (
        <p role="alert">
          Não foi possível carregar os materiais.{" "}
          <button onClick={() => void materials.refetch()} className="underline">
            Tentar novamente
          </button>
        </p>
      )}
      {!materials.isLoading && !materials.data?.length && (
        <p className="mt-3 text-sm">
          Adicione suas anotações em Materiais para começar, sem reenviar arquivos a cada etapa.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {active && (
        <div className="mt-5 space-y-4">
          <ol className="grid gap-2 sm:grid-cols-3">
            {steps.map((item, index) => (
              <li key={item.title}>
                <Button
                  className="h-auto w-full whitespace-normal text-left"
                  variant={step === index ? "secondary" : "outline"}
                  onClick={() => setStep(index)}
                >
                  {index + 1}. {item.title} · {item.minutes} min
                </Button>
              </li>
            ))}
          </ol>
          <p className="text-sm">
            Material: {active.material.name} · Total: {active.minutes} minutos. Na primeira etapa,
            tente responder antes de consultar as anotações.
          </p>
          <Button
            variant="outline"
            disabled={saved || save.isPending}
            onClick={async () => {
              setError("");
              try {
                await save.mutateAsync();
                setSaved(true);
              } catch (e) {
                setError(
                  `Algumas etapas podem ter sido salvas. Tente novamente para completar sem duplicar. ${(e as Error).message}`,
                );
              }
            }}
          >
            {save.isPending && <Spin />}
            {saved ? "Revisão no cronograma" : "Adicionar etapas ao cronograma"}
          </Button>
          <StudyTools
            key={`${active.material.id}-${active.minutes}-${step}`}
            material={active.material}
            initialCount={step === 0 ? 3 : 5}
            initialAction={steps[step]!.action}
            allowed={[steps[step]!.action]}
          />
        </div>
      )}
    </Panel>
  );
}
