import { useMemo, useRef, useState } from "react";
import { FileText, Upload, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { useInsert, useRemove, useTable, useUpdate, useRepo } from "@/hooks/use-data";
import {
  ConfirmDelete,
  Empty,
  ErrorState,
  Loading,
  PageHeader,
  Panel,
  Spin,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { StudyTools } from "./StudyTools";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MAX_CHARS, validateContent, validateFile } from "@/lib/core/files";
import type { Material } from "@/lib/core/types";
import { printMaterial } from "@/lib/print-material";

export function Materials() {
  const repo = useRepo();
  const originals = useTable("material_files");
  const mats = useTable("materials");
  const ins = useInsert("materials", "Material salvo"),
    upd = useUpdate("materials", "Alterações salvas"),
    del = useRemove("materials");
  const [sel, setSel] = useState<Material | null>(null),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState("");
  const [newNote, setNewNote] = useState(false);
  const [query, setQuery] = useState("");
  const [reading, setReading] = useState(false);
  const [ocrEnabled, setOcrEnabled] = useState(false);
  const [readProgress, setReadProgress] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const filtered = useMemo(
    () =>
      (mats.data ?? []).filter((m) =>
        `${m.name} ${m.content}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
      ),
    [mats.data, query],
  );

  async function onFile(file: File) {
    const v = validateFile(file.name, file.size);
    if (!v.ok) {
      toast.error(v.error);
      return;
    }
    setReading(true);
    try {
      let text: string;
      if (v.kind === "pdf") {
        const { extractPdfText } = await import("@/lib/pdf-extract");
        text = await extractPdfText(file, { ocr: ocrEnabled, onProgress: setReadProgress });
        if (!text.trim())
          throw new Error(
            "Este PDF não tem texto extraível. Ative o OCR para reconhecer páginas digitalizadas. Nada foi salvo.",
          );
      } else if (v.kind === "docx" || v.kind === "pptx") {
        const { extractOfficeText } = await import("@/lib/document-extract");
        text = await extractOfficeText(file, v.kind);
      } else text = await file.text();
      const err = validateContent(text);
      if (err) throw new Error(err);
      const id = crypto.randomUUID();
      await ins.mutateAsync({
        id,
        name: file.name.slice(0, 150),
        kind: v.kind === "docx" || v.kind === "pptx" ? "md" : v.kind,
        content: text,
      });
      try {
        await repo.uploadMaterialFile(id, file);
        await originals.refetch();
      } catch (e) {
        throw new Error(
          `O texto foi salvo. Não foi possível guardar o arquivo original: ${(e as Error).message}`,
        );
      }
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível ler o arquivo.");
    } finally {
      setReading(false);
      setReadProgress("");
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materiais"
        description={`Envie TXT/MD (até 1 MB), PDF com texto, DOCX ou PPTX (até 10 MB). O texto e o arquivo original são privados na sua conta. Limite de ${MAX_CHARS.toLocaleString("pt-BR")} caracteres por material.`}
        actions={
          <>
            <Button variant="outline" onClick={() => setNewNote(true)}>
              Nova anotação
            </Button>
            <input
              ref={input}
              type="file"
              accept=".txt,.md,.markdown,.pdf,.docx,.pptx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              className="sr-only"
              id="mat-file"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            <Button onClick={() => input.current?.click()} disabled={reading || ins.isPending}>
              {reading || ins.isPending ? <Spin /> : <Upload className="size-4" aria-hidden />}
              Enviar arquivo
            </Button>
          </>
        }
      />
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={ocrEnabled}
          disabled={reading}
          onChange={(e) => setOcrEnabled(e.target.checked)}
        />
        Reconhecer PDFs digitalizados com OCR local (português e inglês, até 20 páginas sem texto).
        O primeiro uso baixa o mecanismo e os idiomas. Confira o texto reconhecido antes de estudar.
      </label>
      {readProgress && (
        <p role="status" className="text-sm">
          {readProgress}
        </p>
      )}
      <Dialog open={newNote} onOpenChange={setNewNote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova anotação</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const name = String(f.get("name")).trim();
              const content = String(f.get("content")).trim();
              const err = validateContent(content);
              if (err || !name) {
                toast.error(err || "Informe um título.");
                return;
              }
              ins.mutate({ name, content, kind: "md" }, { onSuccess: () => setNewNote(false) });
            }}
          >
            <Label htmlFor="note-name">Título</Label>
            <Input id="note-name" name="name" maxLength={150} required />
            <Label htmlFor="note-content">Anotação</Label>
            <Textarea
              id="note-content"
              name="content"
              maxLength={MAX_CHARS}
              required
              className="min-h-64"
            />
            <Button type="submit" disabled={ins.isPending}>
              {ins.isPending && <Spin />}Salvar anotação
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {mats.isLoading ? (
        <Loading />
      ) : mats.error ? (
        <ErrorState error={mats.error} retry={mats.refetch} />
      ) : mats.data!.length === 0 ? (
        <Empty
          title="Nenhum material"
          text="Envie anotações e resumos para ler aqui e usar com o assistente."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3">
            <Input
              placeholder="Buscar em materiais…"
              aria-label="Buscar materiais"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ul className="space-y-2" aria-label="Lista de materiais">
              {filtered.map((m) => (
                <li key={m.id} className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setSel(m);
                      setEditing(false);
                    }}
                    className={`glass-control flex min-w-0 flex-1 items-center gap-2 truncate rounded-xl border px-3 py-2 text-left text-sm ${sel?.id === m.id ? "border-primary bg-accent" : "bg-card"}`}
                  >
                    <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="truncate">{m.name}</span>
                    <span className="ml-auto text-xs uppercase text-muted-foreground">
                      {m.kind}
                    </span>
                  </button>
                  <ConfirmDelete
                    what={m.name}
                    onConfirm={() => {
                      del.mutate(m.id, {
                        onSuccess: () => {
                          if (sel?.id === m.id) setSel(null);
                        },
                      });
                    }}
                  />
                </li>
              ))}
            </ul>
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum material corresponde à busca.</p>
            )}
          </div>
          <Panel
            title={sel?.name ?? "Selecione um material"}
            action={
              sel &&
              (editing ? (
                <Button
                  size="sm"
                  onClick={() => {
                    const err = validateContent(draft);
                    if (err) {
                      toast.error(err);
                      return;
                    }
                    upd.mutate(
                      { id: sel.id, patch: { content: draft } },
                      {
                        onSuccess: () => {
                          setSel({ ...sel, content: draft });
                          setEditing(false);
                        },
                      },
                    );
                  }}
                  disabled={upd.isPending}
                >
                  <Save className="size-4" aria-hidden />
                  Salvar
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDraft(sel.content);
                    setEditing(true);
                  }}
                >
                  <Pencil className="size-4" aria-hidden />
                  Editar
                </Button>
              ))
            }
          >
            {!sel ? (
              <p className="text-sm text-muted-foreground">Escolha um item à esquerda para ler.</p>
            ) : editing ? (
              <>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-h-96 font-mono text-sm"
                  aria-label="Conteúdo do material"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {draft.length.toLocaleString("pt-BR")} / {MAX_CHARS.toLocaleString("pt-BR")}
                </p>
              </>
            ) : (
              <div className="max-h-[32rem] overflow-auto whitespace-pre-wrap text-sm leading-relaxed">
                {sel.content}
              </div>
            )}
          </Panel>
        </div>
      )}
      {sel && !editing && (
        <>
          {originals.data
            ?.filter((f) => f.material_id === sel.id)
            .map((f) => (
              <Button
                key={f.id}
                variant="outline"
                onClick={async () => {
                  try {
                    const blob = await repo.downloadMaterialFile(f.id);
                    const url = URL.createObjectURL(blob);
                    Object.assign(document.createElement("a"), {
                      href: url,
                      download: f.original_name,
                    }).click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                Baixar original: {f.original_name}
              </Button>
            ))}
          <Button
            variant="outline"
            onClick={() => {
              try {
                printMaterial(sel.name, sel.content);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Imprimir / salvar como PDF
          </Button>
          <StudyTools key={`${sel.id}-${sel.updated_at ?? sel.content}`} material={sel} />
        </>
      )}
    </div>
  );
}
