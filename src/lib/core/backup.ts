import { z } from "zod";

const uuid = z.string().uuid();
const date = z.iso.date();
const ts = z.iso.datetime({ offset: true });

export const backupSchema = z
  .object({
    app: z.literal("studymind"),
    version: z.literal(1),
    exported_at: ts,
    profile: z.object({
      display_name: z.string().max(80),
      course: z.string().max(150),
      objective: z.string().max(300),
      weekly_hours: z.number().int().min(1).max(100),
      availability: z.array(z.number().int().min(0).max(960)).length(7),
    }),
    subjects: z
      .array(z.object({ id: uuid, name: z.string().min(1).max(100), color: z.string().max(30) }))
      .max(200),
    tasks: z
      .array(
        z.object({
          id: uuid,
          subject_id: uuid.nullable(),
          title: z.string().min(1).max(200),
          notes: z.string().max(2000),
          due_date: date,
          duration_min: z.number().int().min(5).max(480),
          priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
          done: z.boolean(),
          completed_at: ts.nullable(),
        }),
      )
      .max(2000),
    sessions: z
      .array(
        z.object({
          id: uuid,
          client_id: uuid,
          subject_id: uuid.nullable(),
          task_id: uuid.nullable(),
          title: z.string().max(200),
          started_at: ts,
          ended_at: ts,
          minutes: z.number().int().min(1).max(480),
        }),
      )
      .max(10000),
    flashcards: z
      .array(
        z.object({
          id: uuid,
          subject_id: uuid.nullable(),
          front: z.string().min(1).max(1000),
          back: z.string().min(1).max(3000),
          due_date: date,
          interval_days: z.number().int().min(0).max(365),
          ease: z.number().min(1).max(5),
          reps: z.number().int().min(0),
        }),
      )
      .max(3000),
    goals: z
      .array(
        z.object({
          id: uuid,
          title: z.string().min(1).max(200),
          target_date: date.nullable(),
          done: z.boolean(),
        }),
      )
      .max(300),
    materials: z
      .array(
        z.object({
          id: uuid,
          name: z.string().min(1).max(150),
          kind: z.enum(["txt", "md", "pdf"]),
          content: z.string().max(200000),
        }),
      )
      .max(100),
    quiz_answers: z
      .array(
        z.object({
          id: uuid,
          question_id: z.string().max(40),
          topic: z.string().max(80),
          correct: z.boolean(),
          answered_at: ts,
        }),
      )
      .max(20000),
  })
  .superRefine((b, ctx) => {
    for (const [table, rows] of Object.entries({
      subjects: b.subjects,
      tasks: b.tasks,
      sessions: b.sessions,
      flashcards: b.flashcards,
      goals: b.goals,
      materials: b.materials,
      quiz_answers: b.quiz_answers,
    })) {
      if (new Set(rows.map((row) => row.id)).size !== rows.length)
        ctx.addIssue({ code: "custom", message: `IDs duplicados em ${table}.` });
    }
    if (new Set(b.sessions.map((s) => s.client_id)).size !== b.sessions.length)
      ctx.addIssue({ code: "custom", message: "Sessões com client_id duplicado." });
    const subjects = new Set(b.subjects.map((s) => s.id));
    const tasks = new Set(b.tasks.map((t) => t.id));
    for (const t of b.tasks)
      if (t.subject_id && !subjects.has(t.subject_id))
        ctx.addIssue({
          code: "custom",
          message: `Atividade "${t.title}" aponta para disciplina inexistente.`,
        });
    for (const s of b.sessions) {
      if (Date.parse(s.ended_at) < Date.parse(s.started_at))
        ctx.addIssue({ code: "custom", message: "Sessão termina antes de começar." });
      if (s.subject_id && !subjects.has(s.subject_id))
        ctx.addIssue({ code: "custom", message: "Sessão aponta para disciplina inexistente." });
      if (s.task_id && !tasks.has(s.task_id))
        ctx.addIssue({ code: "custom", message: "Sessão aponta para atividade inexistente." });
    }
    for (const card of b.flashcards)
      if (card.subject_id && !subjects.has(card.subject_id))
        ctx.addIssue({ code: "custom", message: "Cartão aponta para disciplina inexistente." });
  });
export type Backup = z.infer<typeof backupSchema>;

export function parseBackup(
  text: string,
): { ok: true; data: Backup } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "O arquivo não é um JSON válido." };
  }
  const r = backupSchema.safeParse(raw);
  if (!r.success) {
    const i = r.error.issues[0];
    if (!i) return { ok: false, error: "Arquivo inválido." };
    return {
      ok: false,
      error: `Arquivo inválido: ${i.message}${i.path.length ? ` (campo ${i.path.join(".")})` : ""}`,
    };
  }
  return { ok: true, data: r.data };
}
