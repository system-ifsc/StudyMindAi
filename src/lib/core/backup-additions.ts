import type { Backup } from "./backup";
import type { TableName, Tables } from "./types";
/** Fresh IDs are supplied by the caller; references are namespaced by table. */
export function backupAdditions(
  b: Backup,
  nextId: () => string,
): Partial<{ [K in TableName]: Tables[K][] }> {
  const subjects = new Map(b.subjects.map((r) => [r.id, nextId()]));
  const tasks = new Map(b.tasks.map((r) => [r.id, nextId()]));
  const sub = (id: string | null) => (id ? subjects.get(id)! : null);
  return {
    subjects: b.subjects.map((r) => ({ ...r, id: subjects.get(r.id)! })),
    tasks: b.tasks.map((r) => ({ ...r, id: tasks.get(r.id)!, subject_id: sub(r.subject_id) })),
    study_sessions: b.sessions.map((r) => ({
      ...r,
      id: nextId(),
      client_id: nextId(),
      subject_id: sub(r.subject_id),
      task_id: r.task_id ? tasks.get(r.task_id)! : null,
    })),
    flashcards: b.flashcards.map((r) => ({ ...r, id: nextId(), subject_id: sub(r.subject_id) })),
    goals: b.goals.map((r) => ({ ...r, id: nextId() })),
    materials: b.materials.map((r) => ({ ...r, id: nextId() })),
    quiz_answers: b.quiz_answers.map((r) => ({ ...r, id: nextId() })),
  };
}
