import { useEffect, useRef, useState, type FormEvent } from "react";
import { Download, Upload, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile, useRepo, useSave } from "@/hooks/use-data";
import { useTheme } from "@/hooks/use-theme";
import { PageHeader, Panel, Spin } from "@/components/app/ui";
import { AvailabilityEditor } from "@/components/app/AvailabilityEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { backupSchema, parseBackup, type Backup } from "@/lib/core/backup";
import { formatMinutes } from "@/lib/core/dates";
import type { Profile } from "@/lib/core/types";
import { CourseSelect } from "@/components/app/CourseSelect";
import { requireCourse } from "@/lib/core/courses";

export function Settings() {
  const repo = useRepo(),
    qc = useQueryClient(),
    profile = useProfile(),
    { dark, toggle } = useTheme();
  const [p, setP] = useState<Profile | null>(null);
  const [pending, setPending] = useState<Backup | null>(null),
    [importing, setImporting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    if (profile.data) setP(profile.data);
  }, [profile.data]);
  const save = useSave<Profile>(
    (r, x) =>
      r.updateProfile({
        display_name: x.display_name,
        course: requireCourse(x.course),
        objective: x.objective,
        availability: x.availability,
        weekly_hours: Math.max(1, Math.round(x.availability.reduce((a, b) => a + b, 0) / 60)),
      }),
    { invalidate: ["profile"], success: "Perfil salvo" },
  );

  async function exportJson() {
    setExporting(true);
    try {
      const [prof, subjects, tasks, sessions, flashcards, goals, materials, quiz_answers] =
        await Promise.all([
          repo.getProfile(),
          repo.list("subjects"),
          repo.list("tasks"),
          repo.list("study_sessions"),
          repo.list("flashcards"),
          repo.list("goals"),
          repo.list("materials"),
          repo.list("quiz_answers"),
        ]);
      const pick = <T extends object, K extends keyof T>(o: T, ks: K[]) =>
        Object.fromEntries(ks.map((k) => [k, o[k]]));
      const b = {
        app: "studymind",
        version: 1,
        exported_at: new Date().toISOString(),
        profile: pick(prof, [
          "display_name",
          "course",
          "objective",
          "weekly_hours",
          "availability",
        ]),
        subjects: subjects.map((x) => pick(x, ["id", "name", "color"])),
        tasks: tasks.map((x) =>
          pick(x, [
            "id",
            "subject_id",
            "title",
            "notes",
            "due_date",
            "duration_min",
            "priority",
            "done",
            "completed_at",
          ]),
        ),
        sessions: sessions.map((x) =>
          pick(x, [
            "id",
            "client_id",
            "subject_id",
            "task_id",
            "title",
            "started_at",
            "ended_at",
            "minutes",
          ]),
        ),
        flashcards: flashcards.map((x) => ({
          ...pick(x, ["id", "subject_id", "front", "back", "due_date", "interval_days", "reps"]),
          ease: Number(x.ease),
        })),
        goals: goals.map((x) => pick(x, ["id", "title", "target_date", "done"])),
        materials: materials.map((x) => pick(x, ["id", "name", "kind", "content"])),
        quiz_answers: quiz_answers.map((x) =>
          pick(x, ["id", "question_id", "topic", "correct", "answered_at"]),
        ),
      };
      const validated = backupSchema.safeParse(b);
      if (!validated.success)
        throw new Error(
          "Não foi possível criar um backup recuperável: " + validated.error.issues[0]?.message,
        );
      const blob = new Blob([JSON.stringify(validated.data, null, 2)], {
        type: "application/json",
      });
      if (blob.size > 20_000_000)
        throw new Error(
          "O backup ultrapassa o limite de recuperação de 20 MB. Solicite uma exportação administrativa.",
        );
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), {
        href: url,
        download: `studymind-backup-${b.exported_at.slice(0, 10)}.json`,
      });
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup exportado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  async function pickFile(f: File) {
    if (f.size > 20_000_000) {
      toast.error("Arquivo grande demais (máx. 20 MB).");
      return;
    }
    try {
      const r = parseBackup(await f.text());
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setPending(r.data);
    } catch {
      toast.error("Não foi possível ler o backup. Selecione o arquivo novamente.");
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  async function confirmImport() {
    if (!pending) return;
    setImporting(true);
    try {
      await repo.importAll(pending);
      await qc.invalidateQueries({ queryKey: [repo.mode] });
      toast.success("Dados importados");
      setPending(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (p) save.mutate(p);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" />
      {p && (
        <Panel title="Perfil e disponibilidade">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="st-name">Nome</Label>
                <Input
                  id="st-name"
                  value={p.display_name}
                  maxLength={80}
                  onChange={(e) => setP({ ...p, display_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-course">Curso</Label>
                <CourseSelect
                  id="st-course"
                  value={p.course}
                  onChange={(course) => setP({ ...p, course })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-obj">Objetivo</Label>
              <Textarea
                id="st-obj"
                value={p.objective}
                maxLength={300}
                onChange={(e) => setP({ ...p, objective: e.target.value })}
              />
            </div>
            <AvailabilityEditor
              value={p.availability}
              onChange={(availability) => setP({ ...p, availability })}
            />
            <p className="text-sm text-muted-foreground">
              Total: {formatMinutes(p.availability.reduce((a, b) => a + b, 0))}/semana (vira a meta
              semanal).
            </p>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Spin />}Salvar
            </Button>
          </form>
        </Panel>
      )}
      <Panel title="Aparência">
        <Button variant="outline" onClick={toggle} aria-pressed={dark}>
          {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
          {dark ? "Usar tema claro" : "Usar tema escuro"}
        </Button>
      </Panel>
      <Panel title="Backup (JSON)">
        <p className="mb-4 text-sm text-muted-foreground">
          Exporte disciplinas, atividades, sessões, cartões, metas, textos de materiais e
          resultados. Importar adiciona os registros à sua conta e atualiza o perfil em uma
          transação. Os dados atuais são preservados. Reimportar o mesmo arquivo cria novas cópias.
          Conversas, simulados completos e arquivos originais ainda não fazem parte deste backup v1.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportJson} disabled={exporting || importing}>
            <Download className="size-4" aria-hidden />
            Exportar
          </Button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            id="imp"
            onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
          />
          <Button variant="outline" onClick={() => file.current?.click()}>
            <Upload className="size-4" aria-hidden />
            Importar
          </Button>
        </div>
      </Panel>
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adicionar dados do backup?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo é válido e contém {pending?.subjects.length} disciplinas,{" "}
              {pending?.tasks.length} atividades, {pending?.sessions.length} sessões,{" "}
              {pending?.flashcards.length} cartões, {pending?.goals.length} metas e{" "}
              {pending?.materials.length} materiais. Os registros serão adicionados com novos IDs;
              seu perfil será atualizado. Guarde uma exportação atual antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmImport();
              }}
              disabled={importing}
            >
              {importing && <Spin />}Adicionar registros
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
