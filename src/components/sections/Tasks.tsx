import { useMemo, useState, type FormEvent } from "react";
import { Plus, Pencil } from "lucide-react";
import { useInsert, useRemove, useTable, useUpdate } from "@/hooks/use-data";
import {
  ConfirmDelete,
  Dot,
  Empty,
  ErrorState,
  Loading,
  NativeSelect,
  PageHeader,
  PRIORITY_LABEL,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatBR, formatMinutes, today } from "@/lib/core/dates";
import type { Priority, Task } from "@/lib/core/types";

export function Tasks() {
  const tasks = useTable("tasks"),
    subjects = useTable("subjects");
  const ins = useInsert("tasks", "Atividade criada"),
    upd = useUpdate("tasks"),
    del = useRemove("tasks");
  const [edit, setEdit] = useState<Task | "new" | null>(null);
  const [q, setQ] = useState(""),
    [fSub, setFSub] = useState("all"),
    [fStatus, setFStatus] = useState("pending"),
    [fPri, setFPri] = useState("all");
  const t = today();

  const list = useMemo(
    () =>
      (tasks.data ?? [])
        .filter(
          (x) =>
            x.title.toLowerCase().includes(q.toLowerCase()) ||
            x.notes.toLowerCase().includes(q.toLowerCase()),
        )
        .filter((x) => fSub === "all" || (fSub === "none" ? !x.subject_id : x.subject_id === fSub))
        .filter(
          (x) =>
            fStatus === "all" ||
            (fStatus === "done"
              ? x.done
              : fStatus === "late"
                ? !x.done && x.due_date < t
                : !x.done),
        )
        .filter((x) => fPri === "all" || String(x.priority) === fPri)
        .sort(
          (a, b) =>
            Number(a.done) - Number(b.done) ||
            a.due_date.localeCompare(b.due_date) ||
            b.priority - a.priority,
        ),
    [tasks.data, q, fSub, fStatus, fPri, t],
  );

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const row = {
      title: String(f.get("title")).trim(),
      notes: String(f.get("notes") ?? "").trim(),
      subject_id: String(f.get("subject")) || null,
      due_date: String(f.get("due")),
      duration_min: Math.max(5, Math.min(480, Number(f.get("duration")) || 30)),
      priority: Number(f.get("priority")) as Priority,
    };
    if (!row.title || !row.due_date) return;
    const done = { onSuccess: () => setEdit(null) };
    if (edit === "new") ins.mutate({ ...row, done: false, completed_at: null }, done);
    else if (edit)
      upd.mutate(
        { id: edit.id, patch: row },
        {
          onSuccess: () => {
            setEdit(null);
          },
        },
      );
  }
  const toggle = (x: Task) =>
    upd.mutate({
      id: x.id,
      patch: { done: !x.done, completed_at: x.done ? null : new Date().toISOString() },
    });
  const subj = (id: string | null) => subjects.data?.find((s) => s.id === id);
  const cur = edit && edit !== "new" ? edit : null;

  return (
    <div>
      <PageHeader
        title="Atividades"
        description="Tudo que precisa ser feito, com prazo, duração estimada e prioridade."
        actions={
          <Button onClick={() => setEdit("new")}>
            <Plus className="size-4" aria-hidden />
            Nova atividade
          </Button>
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Input
          placeholder="Buscar…"
          aria-label="Buscar atividade"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <NativeSelect
          aria-label="Filtrar por disciplina"
          value={fSub}
          onChange={(e) => setFSub(e.target.value)}
        >
          <option value="all">Todas as disciplinas</option>
          <option value="none">Sem disciplina</option>
          {subjects.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Filtrar por situação"
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value)}
        >
          <option value="pending">Pendentes</option>
          <option value="late">Atrasadas</option>
          <option value="done">Concluídas</option>
          <option value="all">Todas</option>
        </NativeSelect>
        <NativeSelect
          aria-label="Filtrar por prioridade"
          value={fPri}
          onChange={(e) => setFPri(e.target.value)}
        >
          <option value="all">Qualquer prioridade</option>
          <option value="3">Alta</option>
          <option value="2">Média</option>
          <option value="1">Baixa</option>
        </NativeSelect>
      </div>
      {tasks.isLoading ? (
        <Loading />
      ) : tasks.error ? (
        <ErrorState error={tasks.error} retry={tasks.refetch} />
      ) : list.length === 0 ? (
        <Empty
          title="Nenhuma atividade aqui"
          text="Ajuste os filtros ou crie uma atividade."
          action={<Button onClick={() => setEdit("new")}>Criar atividade</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {list.map((x) => (
            <li
              key={x.id}
              className="glass-panel flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-card"
            >
              <Checkbox
                checked={x.done}
                onCheckedChange={() => toggle(x)}
                aria-label={`Marcar “${x.title}” como ${x.done ? "pendente" : "concluída"}`}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={
                    x.done ? "truncate text-muted-foreground line-through" : "truncate font-medium"
                  }
                >
                  {x.title}
                </p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {subj(x.subject_id) && (
                    <span className="flex items-center gap-1.5">
                      <Dot color={subj(x.subject_id)?.color} />
                      {subj(x.subject_id)?.name}
                    </span>
                  )}
                  <span className={!x.done && x.due_date < t ? "text-destructive" : ""}>
                    Prazo {formatBR(x.due_date)}
                  </span>
                  <span>{formatMinutes(x.duration_min)}</span>
                </p>
              </div>
              <Badge
                variant={x.priority === 3 ? "default" : "secondary"}
                className="hidden sm:inline-flex"
              >
                {PRIORITY_LABEL[x.priority]}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Editar ${x.title}`}
                onClick={() => setEdit(x)}
              >
                <Pencil className="size-4" />
              </Button>
              <ConfirmDelete what={x.title} onConfirm={() => del.mutate(x.id)} />
            </li>
          ))}
        </ul>
      )}
      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cur ? "Editar atividade" : "Nova atividade"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4" key={cur?.id ?? "new"}>
            <div className="space-y-1.5">
              <Label htmlFor="t-title">Título</Label>
              <Input id="t-title" name="title" required maxLength={200} defaultValue={cur?.title} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="t-sub">Disciplina</Label>
                <NativeSelect id="t-sub" name="subject" defaultValue={cur?.subject_id ?? ""}>
                  <option value="">Sem disciplina</option>
                  {subjects.data?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-due">Prazo</Label>
                <Input
                  id="t-due"
                  name="due"
                  type="date"
                  required
                  defaultValue={cur?.due_date ?? t}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-dur">Duração (min)</Label>
                <Input
                  id="t-dur"
                  name="duration"
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  required
                  defaultValue={cur?.duration_min ?? 30}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-pri">Prioridade</Label>
                <NativeSelect id="t-pri" name="priority" defaultValue={cur?.priority ?? 2}>
                  <option value={3}>Alta</option>
                  <option value={2}>Média</option>
                  <option value={1}>Baixa</option>
                </NativeSelect>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-notes">Observações</Label>
              <Textarea id="t-notes" name="notes" maxLength={2000} defaultValue={cur?.notes} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={ins.isPending || upd.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
