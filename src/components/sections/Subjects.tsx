import { useState, type FormEvent } from "react";
import { Plus, Pencil } from "lucide-react";
import { useInsert, useRemove, useTable, useUpdate, useProfile } from "@/hooks/use-data";
import { findCourse } from "@/lib/core/courses";
import {
  ConfirmDelete,
  Dot,
  Empty,
  ErrorState,
  Loading,
  NativeSelect,
  PageHeader,
  Panel,
  SUBJECT_COLORS,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatMinutes } from "@/lib/core/dates";
import type { Subject } from "@/lib/core/types";

export function Subjects() {
  const profile = useProfile();
  const course = findCourse(profile.data?.course ?? "");
  const subjects = useTable("subjects"),
    tasks = useTable("tasks"),
    sessions = useTable("study_sessions");
  const ins = useInsert("subjects", "Disciplina criada"),
    upd = useUpdate("subjects", "Disciplina atualizada"),
    del = useRemove("subjects", ["tasks"]);
  const [edit, setEdit] = useState<Subject | "new" | null>(null);
  const [q, setQ] = useState("");

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const row = { name: String(f.get("name")).trim(), color: String(f.get("color")) };
    if (!row.name) return;
    const done = { onSuccess: () => setEdit(null) };
    if (edit === "new") ins.mutate(row, done);
    else if (edit) upd.mutate({ id: edit.id, patch: row }, done);
  }
  const list = (subjects.data ?? []).filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      {course && (
        <Panel title={course.name}>
          <p className="mb-3 text-sm text-muted-foreground">
            Sugestões de disciplinas para seu curso. Adicione somente as que fazem parte dos seus
            estudos.
          </p>
          <div className="flex flex-wrap gap-2">
            {course.subjects.map((name) => (
              <Button
                key={name}
                variant="outline"
                disabled={
                  subjects.isLoading ||
                  !!subjects.error ||
                  ins.isPending ||
                  subjects.data?.some((subject) => subject.name === name)
                }
                onClick={() => ins.mutate({ name, color: "teal" })}
              >
                <Plus className="size-4" aria-hidden />
                {name}
              </Button>
            ))}
          </div>
        </Panel>
      )}
      <PageHeader
        title="Disciplinas"
        description="Organize o seu curso em disciplinas; atividades, cartões e sessões podem ser ligados a elas."
        actions={
          <Button onClick={() => setEdit("new")}>
            <Plus className="size-4" aria-hidden />
            Nova disciplina
          </Button>
        }
      />
      <Input
        placeholder="Buscar disciplina…"
        aria-label="Buscar disciplina"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 max-w-sm"
      />
      {subjects.isLoading ? (
        <Loading />
      ) : subjects.error ? (
        <ErrorState error={subjects.error} retry={subjects.refetch} />
      ) : list.length === 0 ? (
        <Empty
          title={q ? "Nenhuma disciplina encontrada" : "Nenhuma disciplina ainda"}
          text="Crie a primeira para organizar seus estudos."
          action={!q && <Button onClick={() => setEdit("new")}>Criar disciplina</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => {
            const ts = (tasks.data ?? []).filter((t) => t.subject_id === s.id);
            const min = (sessions.data ?? [])
              .filter((x) => x.subject_id === s.id)
              .reduce((n, x) => n + x.minutes, 0);
            return (
              <Panel key={s.id}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="flex min-w-0 items-center gap-2 break-words font-semibold">
                    <Dot color={s.color} />
                    {s.name}
                  </h3>
                  <div className="flex shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Editar ${s.name}`}
                      onClick={() => setEdit(s)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <ConfirmDelete what={s.name} onConfirm={() => del.mutate(s.id)} />
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {ts.filter((t) => t.done).length}/{ts.length} atividades · {formatMinutes(min)}{" "}
                  estudados
                </p>
              </Panel>
            );
          })}
        </div>
      )}
      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit === "new" ? "Nova disciplina" : "Editar disciplina"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4" key={edit === "new" ? "new" : edit?.id}>
            <div className="space-y-1.5">
              <Label htmlFor="s-name">Nome</Label>
              <Input
                id="s-name"
                name="name"
                required
                maxLength={100}
                defaultValue={edit && edit !== "new" ? edit.name : ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-color">Cor</Label>
              <NativeSelect
                id="s-color"
                name="color"
                defaultValue={edit && edit !== "new" ? edit.color : "indigo"}
              >
                {Object.keys(SUBJECT_COLORS).map((c) => (
                  <option key={c} value={c}>
                    {
                      {
                        indigo: "Verde IFSC",
                        violet: "Vermelho IFSC",
                        teal: "Verde-água",
                        amber: "Âmbar",
                        rose: "Rosa",
                      }[c]
                    }
                  </option>
                ))}
              </NativeSelect>
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
