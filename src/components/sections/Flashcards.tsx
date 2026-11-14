import { StudyTools } from "./StudyTools";
import { useState, type FormEvent } from "react";
import { Pencil, Plus, RotateCcw } from "lucide-react";
import { useInsert, useRemove, useTable, useUpdate } from "@/hooks/use-data";
import {
  ConfirmDelete,
  Empty,
  ErrorState,
  Loading,
  NativeSelect,
  PageHeader,
  Panel,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBR, today } from "@/lib/core/dates";
import { review, type Grade } from "@/lib/core/srs";
import { dueCards } from "@/lib/core/metrics";
import type { Flashcard } from "@/lib/core/types";

export function Flashcards() {
  const cards = useTable("flashcards"),
    subjects = useTable("subjects");
  const ins = useInsert("flashcards", "Cartão criado"),
    upd = useUpdate("flashcards"),
    del = useRemove("flashcards");
  const [open, setOpen] = useState(false),
    [flipped, setFlipped] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [filterSubject, setFilterSubject] = useState("all");
  const t = today();
  const visible = (cards.data ?? []).filter(
    (c) =>
      filterSubject === "all" ||
      (filterSubject === "none" ? !c.subject_id : c.subject_id === filterSubject),
  );
  const due = dueCards(visible, t);
  const card = due[0];

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const row = {
      front: String(f.get("front")).trim(),
      back: String(f.get("back")).trim(),
      subject_id: String(f.get("subject")) || null,
    };
    if (editingCard) {
      upd.mutate(
        { id: editingCard.id, patch: row },
        {
          onSuccess: () => {
            setOpen(false);
            setEditingCard(null);
          },
        },
      );
    } else {
      ins.mutate(
        { ...row, due_date: t, interval_days: 0, ease: 2.5, reps: 0 },
        { onSuccess: () => setOpen(false) },
      );
    }
  }
  function grade(g: Grade) {
    if (!card) return;
    upd.mutate({ id: card.id, patch: review(card, g, t) }, { onSuccess: () => setFlipped(false) });
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Flashcards"
        description="Revisão espaçada: quanto melhor você lembra, mais tempo o cartão demora para voltar."
        actions={
          <Button
            onClick={() => {
              setEditingCard(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Novo cartão
          </Button>
        }
      />
      {cards.isLoading ? (
        <Loading />
      ) : cards.error ? (
        <ErrorState error={cards.error} retry={cards.refetch} />
      ) : (
        <>
          <div className="max-w-sm space-y-1.5">
            <label htmlFor="fc-subject" className="text-sm font-medium">
              Filtrar por disciplina
            </label>
            <NativeSelect
              id="fc-subject"
              value={filterSubject}
              onChange={(e) => {
                setFilterSubject(e.target.value);
                setFlipped(false);
              }}
            >
              <option value="all">Todas as disciplinas</option>
              <option value="none">Sem disciplina</option>
              {subjects.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Panel title={`Revisão de hoje · ${due.length} pendente(s)`}>
            {!card ? (
              <Empty title="Tudo revisado por hoje" text="Volte amanhã ou crie novos cartões." />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={() => setFlipped(!flipped)}
                  className="min-h-44 w-full max-w-xl rounded-2xl border bg-surface p-8 text-center text-lg shadow-card"
                  aria-label={flipped ? "Mostrar pergunta" : "Mostrar resposta"}
                >
                  <span className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
                    {flipped ? "Resposta" : "Pergunta"}
                  </span>
                  {flipped ? card.back : card.front}
                </button>
                {!flipped ? (
                  <Button variant="outline" onClick={() => setFlipped(true)}>
                    <RotateCcw className="size-4" aria-hidden />
                    Mostrar resposta
                  </Button>
                ) : (
                  <div
                    className="flex flex-wrap justify-center gap-2"
                    role="group"
                    aria-label="Como foi lembrar?"
                  >
                    <Button variant="destructive" onClick={() => grade(0)} disabled={upd.isPending}>
                      Errei
                    </Button>
                    <Button variant="outline" onClick={() => grade(1)} disabled={upd.isPending}>
                      Difícil
                    </Button>
                    <Button variant="secondary" onClick={() => grade(2)} disabled={upd.isPending}>
                      Bom
                    </Button>
                    <Button onClick={() => grade(3)} disabled={upd.isPending}>
                      Fácil
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Panel>
          <Panel title={`Cartões visíveis (${visible.length})`}>
            {visible.length === 0 ? (
              <Empty
                title="Nenhum cartão"
                action={<Button onClick={() => setOpen(true)}>Criar cartão</Button>}
              />
            ) : (
              <ul className="divide-y">
                {visible.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.front}</span>
                      <span className="text-xs text-muted-foreground">
                        Próxima revisão {formatBR(c.due_date)} · intervalo {c.interval_days} dia(s)
                      </span>
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Editar ${c.front}`}
                      onClick={() => {
                        setEditingCard(c);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <ConfirmDelete what={c.front.slice(0, 40)} onConfirm={() => del.mutate(c.id)} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCard ? "Editar cartão" : "Novo cartão"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-front">Frente (pergunta)</Label>
              <Textarea
                id="c-front"
                name="front"
                required
                maxLength={1000}
                defaultValue={editingCard?.front}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-back">Verso (resposta)</Label>
              <Textarea
                id="c-back"
                name="back"
                required
                maxLength={3000}
                defaultValue={editingCard?.back}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-sub">Disciplina</Label>
              <NativeSelect id="c-sub" name="subject" defaultValue={editingCard?.subject_id ?? ""}>
                <option value="">Sem disciplina</option>
                {subjects.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={ins.isPending || upd.isPending}>
                {editingCard ? "Atualizar" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <StudyTools initialAction="flashcards" allowed={["flashcards"]} />
    </div>
  );
}
