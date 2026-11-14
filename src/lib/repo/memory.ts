import type { Profile, TableName, Tables } from "@/lib/core/types";
import type { Repo } from "./types";

type Store = { profile: Profile } & { [K in TableName]: Tables[K][] };

/** Repositório em memória: usado SOMENTE no modo demonstração. Nada é enviado ao servidor. */
export function createMemoryRepo(seed: () => Store): Repo {
  let s = seed();
  const delay = () => new Promise((r) => setTimeout(r, 60));
  return {
    mode: "demo",
    async getProfile() {
      await delay();
      return { ...s.profile };
    },
    async updateProfile(patch) {
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
      s = { ...s, [table]: (s[table] as { id: string }[]).filter((r) => r.id !== id) };
      if (table === "subjects")
        s.tasks = s.tasks.map((t) => (t.subject_id === id ? { ...t, subject_id: null } : t));
    },
    async recordSession(row) {
      if (s.study_sessions.some((x) => x.client_id === row.client_id)) return;
      s.study_sessions.push({ ...row, id: row.id ?? crypto.randomUUID() });
    },
    async importAll(b) {
      s = {
        profile: { ...s.profile, ...b.profile },
        subjects: b.subjects,
        tasks: b.tasks,
        study_sessions: b.sessions,
        flashcards: b.flashcards,
        goals: b.goals,
        materials: b.materials,
        quiz_answers: b.quiz_answers,
      };
    },
  };
}
