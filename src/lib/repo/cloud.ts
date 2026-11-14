import { supabase } from "@/integrations/supabase/client";
import type { Profile, TableName } from "@/lib/core/types";
import type { Repo } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function fail(error: { message: string } | null, what: string) {
  if (error) throw new Error(`Não foi possível ${what}: ${error.message}`);
}
// O cliente gerado é tipado por tabela; aqui a tabela é dinâmica, então usamos uma visão sem tipos.
export function createCloudRepo(userId: string, client: SupabaseClient<Database> = supabase): Repo {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const from = (t: string) => (client as any).from(t);
  return {
    mode: "real",
    async getProfile() {
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      fail(error, "carregar o perfil");
      if (!data) {
        const blank = {
          id: userId,
          display_name: "",
          course: "",
          objective: "",
          weekly_hours: 8,
          availability: [60, 60, 60, 60, 60, 0, 0],
          onboarded: false,
        };
        const ins = await client.from("profiles").insert(blank);
        fail(ins.error, "criar o perfil");
        return blank;
      }
      return data as Profile;
    },
    async updateProfile(patch) {
      const { error } = await client
        .from("profiles")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", userId);
      fail(error, "salvar o perfil");
    },
    async list(table) {
      const order =
        table === "study_sessions"
          ? "started_at"
          : table === "quiz_answers"
            ? "answered_at"
            : "created_at";
      const { data, error } = await from(table)
        .select("*")
        .eq("user_id", userId)
        .order(order, { ascending: true })
        .limit(5000);
      fail(error, "carregar os dados");
      return data ?? [];
    },
    async get(table, id) {
      const { data, error } = await from(table)
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      fail(error, "carregar o registro");
      return data ?? null;
    },
    async insert(table, row) {
      const { error } = await from(table).insert({ ...row, user_id: userId });
      fail(error, "salvar");
    },
    async update(table, id, patch) {
      const p = { ...patch } as Record<string, unknown>;
      delete p["id"];
      if (table === "materials") p["updated_at"] = new Date().toISOString();
      delete p["user_id"];
      const { error } = await from(table).update(p).eq("id", id).eq("user_id", userId);
      fail(error, "atualizar");
    },
    async remove(table: TableName, id) {
      const { error } = await from(table).delete().eq("id", id).eq("user_id", userId);
      fail(error, "excluir");
    },
    async recordSession(row) {
      const { error } = await from("study_sessions").upsert(
        { ...row, user_id: userId },
        { onConflict: "user_id,client_id", ignoreDuplicates: true },
      );
      fail(error, "registrar a sessão");
    },
    async importAll(b) {
      const { error } = await client.rpc("import_user_data", {
        payload: {
          subjects: b.subjects,
          tasks: b.tasks,
          sessions: b.sessions,
          flashcards: b.flashcards,
          goals: b.goals,
          materials: b.materials,
          quiz_answers: b.quiz_answers,
        },
      });
      fail(error, "importar o backup");
      await this.updateProfile({ ...b.profile, onboarded: true });
    },
  };
}
