import { availabilityError } from "@/lib/core/profile";
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
import {
  parseAnyBackup,
  verifyFullBackup,
  MAX_BACKUP_BYTES,
  type AnyBackup,
} from "@/lib/core/full-backup";
import { exportFullBackup } from "@/lib/repo/full-backup";
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
  const [pending, setPending] = useState<AnyBackup | null>(null),
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
      const b = await exportFullBackup(repo);
      const blob = new Blob([JSON.stringify(b)], { type: "application/json" });
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
    if (f.size > MAX_BACKUP_BYTES) {
      toast.error("Arquivo grande demais (máx. 64 MB).");
      return;
    }
    try {
      const r = parseAnyBackup(await f.text());
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.data.version === 2) await verifyFullBackup(r.data);
      setPending(r.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler o backup.");
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
    if (p) {
      const error = availabilityError(p.availability);
      if (error) toast.error(error);
      else save.mutate(p);
    }
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
          O backup completo v2 inclui seus estudos, conversas, simulados e arquivos originais, com
          verificação de integridade (até 64 MB). Importar adiciona os dados com novos IDs, preserva
          os registros atuais e atualiza o perfil. Backups v1 continuam aceitos. Contas, senhas e
          sessões de acesso não são exportadas. Guarde o arquivo em local privado.
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
              {pending?.version === 2
                ? `Backup completo: ${pending.records.study_conversations.length} conversas, ${pending.records.generated_question_sets.length} simulados e ${pending.files.length} arquivos originais, além dos dados de estudo.`
                : "Backup v1: serão recuperados os dados básicos de estudo."}{" "}
              Os registros serão adicionados com novos IDs; seu perfil será atualizado. Importar o
              mesmo arquivo novamente cria cópias. Guarde uma exportação atual antes de continuar.
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
