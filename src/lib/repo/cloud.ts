import { supabase } from "@/integrations/supabase/client";
import { requireCourse } from "@/lib/core/courses";
import type { Profile, TableName, Tables } from "@/lib/core/types";
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
      if (patch.course !== undefined) patch = { ...patch, course: requireCourse(patch.course) };
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
          : table === "quiz_answers" || table === "question_attempt_answers"
            ? "answered_at"
            : table === "question_attempts"
              ? "started_at"
              : table === "generated_question_options" || table === "generated_question_sources"
                ? "id"
                : "created_at";
      // Páginas pequenas respeitam o limite padrão do PostgREST. Nunca devolver um
      // histórico parcial como se estivesse completo (inclusive na exportação).
      const rows: Tables[typeof table][] = [];
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await from(table)
          .select("*")
          .eq("user_id", userId)
          .order(order, { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + pageSize - 1);
        fail(error, "carregar os dados");
        rows.push(...(data ?? []));
        if (!data || data.length < pageSize) return rows;
      }
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
      if (table === "materials") {
        // Preserva o histórico, removendo somente o vínculo com o material excluído.
        for (const linked of [
          "study_conversations",
          "study_message_sources",
          "generated_question_sets",
          "generated_question_sources",
        ]) {
          const result = await from(linked)
            .update({ material_id: null })
            .eq("user_id", userId)
            .eq("material_id", id);
          fail(result.error, "desvincular o material do histórico");
        }
        const originals = (await this.list("material_files")).filter((f) => f.material_id === id);
        if (originals.length) {
          const result = await client.storage
            .from("study-materials")
            .remove(originals.map((f) => f.object_path));
          fail(result.error, "excluir os arquivos privados");
          const removed = await from("material_files")
            .delete()
            .eq("user_id", userId)
            .eq("material_id", id);
          fail(removed.error, "excluir os metadados dos arquivos");
        }
      }
      if (table === "subjects") {
        for (const linked of [
          "tasks",
          "flashcards",
          "study_sessions",
          "materials",
          "study_conversations",
          "generated_question_sets",
        ]) {
          const result = await from(linked)
            .update({ subject_id: null })
            .eq("user_id", userId)
            .eq("subject_id", id);
          fail(result.error, "desvincular a disciplina do histórico");
        }
      }
      if (table === "tasks") {
        for (const linked of ["study_sessions", "study_conversations", "generated_question_sets"]) {
          const result = await from(linked)
            .update({ task_id: null })
            .eq("user_id", userId)
            .eq("task_id", id);
          fail(result.error, "desvincular a atividade do histórico");
        }
      }
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
    async uploadMaterialFile(materialId, file) {
      // Confere acesso antes de criar o objeto. O nome original fica só no metadado.
      if (!(await this.get("materials", materialId))) throw new Error("Material não encontrado.");
      const id = crypto.randomUUID();
      const objectPath = `${userId}/${id}`;
      const bucket = client.storage.from("study-materials");
      const { error } = await bucket.upload(objectPath, file, {
        upsert: false,
        contentType: "application/octet-stream",
      });
      fail(error, "guardar o arquivo privado");
      try {
        await this.insert("material_files", {
          id,
          material_id: materialId,
          bucket_id: "study-materials",
          object_path: objectPath,
          original_name: file.name.slice(0, 255),
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          sha256: null,
          extraction_status: "ready",
          extraction_error: null,
        });
      } catch (e) {
        await bucket.remove([objectPath]);
        throw e;
      }
    },
    async downloadMaterialFile(fileId) {
      const row = await this.get("material_files", fileId);
      if (!row || !row.object_path.startsWith(`${userId}/`))
        throw new Error("Arquivo não encontrado.");
      const { data, error } = await client.storage
        .from("study-materials")
        .download(row.object_path);
      fail(error, "baixar o arquivo privado");
      if (!data) throw new Error("Arquivo indisponível.");
      return data;
    },
    async importAll(b) {
      const { error } = await client.rpc("import_user_data", {
        payload: b,
      });
      fail(error, "importar o backup");
    },
  };
}
