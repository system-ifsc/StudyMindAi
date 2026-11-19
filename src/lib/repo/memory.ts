import type { Profile, TableName, Tables } from "@/lib/core/types";
import type { Repo } from "./types";
import { requireCourse } from "@/lib/core/courses";

type Store = { profile: Profile } & { [K in TableName]: Tables[K][] };

/** Repositório em memória: usado SOMENTE no modo demonstração. Nada é enviado ao servidor. */
export function createMemoryRepo(seed: () => Store): Repo {
  let s = seed();
  const files = new Map<string, Blob>();
  const delay = () => new Promise((r) => setTimeout(r, 60));
  return {
    mode: "demo",
    async getProfile() {
      await delay();
      return { ...s.profile };
    },
    async updateProfile(patch) {
      if (patch.course !== undefined) patch = { ...patch, course: requireCourse(patch.course) };
      s.profile = { ...s.profile, ...patch };
    },
    async list(table) {
      await delay();
      return [...s[table]] as never;
    },
    async get(table, id) {
      const row = s[table].find((r) => r.id === id);
      return row ? ({ ...row } as never) : null;
    },
    async insert(table, row) {
      (s[table] as unknown[]).push({
        ...row,
        id: row.id ?? crypto.randomUUID(),
        created_at: new Date().toISOString(),
      });
    },
    async update(table, id, patch) {
      s = {
        ...s,
        [table]: (s[table] as { id: string }[]).map((r) => (r.id === id ? { ...r, ...patch } : r)),
      };
    },
    async remove(table, id) {
      if (table === "materials") {
        for (const f of s.material_files.filter((f) => f.material_id === id)) files.delete(f.id);
        s.material_files = s.material_files.filter((f) => f.material_id !== id);
        s.study_conversations = s.study_conversations.map((r) =>
          r.material_id === id ? { ...r, material_id: null } : r,
        );
        s.study_message_sources = s.study_message_sources.map((r) =>
          r.material_id === id ? { ...r, material_id: null } : r,
        );
        s.generated_question_sets = s.generated_question_sets.map((r) =>
          r.material_id === id ? { ...r, material_id: null } : r,
        );
        s.generated_question_sources = s.generated_question_sources.map((r) =>
          r.material_id === id ? { ...r, material_id: null } : r,
        );
      }
      s = { ...s, [table]: (s[table] as { id: string }[]).filter((r) => r.id !== id) };
      if (table === "subjects") {
        s.tasks = s.tasks.map((t) => (t.subject_id === id ? { ...t, subject_id: null } : t));
        s.study_sessions = s.study_sessions.map((r) =>
          r.subject_id === id ? { ...r, subject_id: null } : r,
        );
        s.flashcards = s.flashcards.map((r) =>
          r.subject_id === id ? { ...r, subject_id: null } : r,
        );
        s.materials = s.materials.map((r) =>
          r.subject_id === id ? { ...r, subject_id: null } : r,
        );
        s.study_conversations = s.study_conversations.map((r) =>
          r.subject_id === id ? { ...r, subject_id: null } : r,
        );
        s.generated_question_sets = s.generated_question_sets.map((r) =>
          r.subject_id === id ? { ...r, subject_id: null } : r,
        );
      }
      if (table === "tasks") {
        s.study_sessions = s.study_sessions.map((r) =>
          r.task_id === id ? { ...r, task_id: null } : r,
        );
        s.study_conversations = s.study_conversations.map((r) =>
          r.task_id === id ? { ...r, task_id: null } : r,
        );
        s.generated_question_sets = s.generated_question_sets.map((r) =>
          r.task_id === id ? { ...r, task_id: null } : r,
        );
      }
    },
    async recordSession(row) {
      if (s.study_sessions.some((x) => x.client_id === row.client_id)) return;
      s.study_sessions.push({ ...row, id: row.id ?? crypto.randomUUID() });
    },
    async uploadMaterialFile(materialId, file) {
      if (!s.materials.some((m) => m.id === materialId))
        throw new Error("Material não encontrado.");
      const id = crypto.randomUUID();
      files.set(id, file);
      s.material_files.push({
        id,
        material_id: materialId,
        bucket_id: "study-materials",
        object_path: `demo/${id}`,
        original_name: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        sha256: null,
        extraction_status: "ready",
        extraction_error: null,
      });
    },
    async downloadMaterialFile(fileId) {
      const file = files.get(fileId);
      if (!file) throw new Error("Arquivo não encontrado.");
      return file;
    },
    async importAll(b) {
      const ids = new Map<string, string>();
      for (const rows of [
        b.subjects,
        b.tasks,
        b.sessions,
        b.flashcards,
        b.goals,
        b.materials,
        b.quiz_answers,
      ])
        for (const row of rows) ids.set(row.id, crypto.randomUUID());
      const ref = (id: string | null) => (id ? ids.get(id)! : null);
      s = {
        ...s,
        profile: { ...s.profile, ...b.profile, onboarded: true },
        subjects: [...s.subjects, ...b.subjects.map((r) => ({ ...r, id: ids.get(r.id)! }))],
        tasks: [
          ...s.tasks,
          ...b.tasks.map((r) => ({ ...r, id: ids.get(r.id)!, subject_id: ref(r.subject_id) })),
        ],
        study_sessions: [
          ...s.study_sessions,
          ...b.sessions.map((r) => ({
            ...r,
            id: ids.get(r.id)!,
            client_id: crypto.randomUUID(),
            subject_id: ref(r.subject_id),
            task_id: ref(r.task_id),
          })),
        ],
        flashcards: [
          ...s.flashcards,
          ...b.flashcards.map((r) => ({ ...r, id: ids.get(r.id)!, subject_id: ref(r.subject_id) })),
        ],
        goals: [...s.goals, ...b.goals.map((r) => ({ ...r, id: ids.get(r.id)! }))],
        materials: [...s.materials, ...b.materials.map((r) => ({ ...r, id: ids.get(r.id)! }))],
        quiz_answers: [
          ...s.quiz_answers,
          ...b.quiz_answers.map((r) => ({ ...r, id: ids.get(r.id)! })),
        ],
      };
    },
  };
}
