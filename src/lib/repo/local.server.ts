import { verifyFullBackup, fullBackupAdditions, base64ToBytes } from "@/lib/core/full-backup";
import { randomUUID } from "node:crypto";
import { requireCourse } from "@/lib/core/courses";
import { localDatabase, transaction } from "@/lib/local/database.server";
import { LocalError } from "@/lib/local/auth.server";
import { rowSchemas, profileSchema, rowReferences } from "@/lib/core/local-validation";
import { backupSchema } from "@/lib/core/backup";
import { backupAdditions } from "@/lib/core/backup-additions";
import { TABLES, type TableName, type Tables, type Profile } from "@/lib/core/types";
import type { Repo, NewRow } from "./types";

type Row = Record<string, unknown>;
export function createLocalRepo(owner: string): Repo {
  const db = localDatabase();
  const read = (table: TableName, id: string): Row | null => {
    const found = db
      .prepare("SELECT data FROM records WHERE owner=? AND table_name=? AND id=?")
      .get(owner, table, id) as { data: string } | undefined;
    return found ? JSON.parse(found.data) : null;
  };
  const list = (table: TableName): Row[] =>
    (
      db
        .prepare("SELECT data FROM records WHERE owner=? AND table_name=? ORDER BY rowid")
        .all(owner, table) as { data: string }[]
    ).map((r) => JSON.parse(r.data));
  const write = (table: TableName, row: Row, insert = false) => {
    const data = rowSchemas[table].parse(row) as Row;
    for (const [field, target] of Object.entries(rowReferences[table] ?? {})) {
      const id = data[field];
      if (id != null && !read(target, id as string))
        throw new LocalError("Registro relacionado inexistente ou sem permissão.", 404);
    }
    if (table === "question_attempt_answers") {
      if (
        read("question_attempts", data["attempt_id"] as string)?.["set_id"] !== data["set_id"] ||
        read("generated_questions", data["question_id"] as string)?.["set_id"] !== data["set_id"]
      )
        throw new LocalError("A questão e a tentativa devem pertencer ao mesmo simulado.");
    }
    if (table === "material_files" && !(data["object_path"] as string).startsWith(owner + "/"))
      throw new LocalError("Caminho de arquivo inválido.");
    if (insert)
      db.prepare("INSERT INTO records(owner,table_name,id,data) VALUES(?,?,?,?)").run(
        owner,
        table,
        data["id"] as string,
        JSON.stringify(data),
      );
    else
      db.prepare("UPDATE records SET data=? WHERE owner=? AND table_name=? AND id=?").run(
        JSON.stringify(data),
        owner,
        table,
        data["id"] as string,
      );
  };
  const profile = (): Profile => {
    const user = db.prepare("SELECT profile FROM users WHERE id=?").get(owner) as
      { profile: string } | undefined;
    if (!user) throw new LocalError("Entre novamente na sua conta.", 401);
    return JSON.parse(user.profile);
  };
  return {
    mode: "real",
    async getProfile() {
      return profile();
    },
    async updateProfile(patch) {
      if (patch.course !== undefined) patch = { ...patch, course: requireCourse(patch.course) };
      const value = profileSchema.parse({ ...profile(), ...patch, id: owner });
      db.prepare("UPDATE users SET profile=? WHERE id=?").run(JSON.stringify(value), owner);
    },
    async list<T extends TableName>(table: T) {
      return list(table) as unknown as Tables[T][];
    },
    async get<T extends TableName>(table: T, id: string) {
      return read(table, id) as unknown as Tables[T] | null;
    },
    async insert<T extends TableName>(table: T, row: NewRow<T>) {
      write(
        table,
        { ...row, id: row.id ?? randomUUID(), created_at: new Date().toISOString() },
        true,
      );
    },
    async update(table, id, patch) {
      const row = read(table, id);
      if (!row) throw new LocalError("Registro não encontrado.", 404);
      write(table, {
        ...row,
        ...patch,
        id,
        ...(table === "materials" ? { updated_at: new Date().toISOString() } : {}),
      });
    },
    async remove(table, id) {
      transaction(() => {
        if (!read(table, id)) throw new LocalError("Registro não encontrado.", 404);
        if (table === "materials")
          for (const file of list("material_files").filter((r) => r["material_id"] === id)) {
            db.prepare("DELETE FROM files WHERE owner=? AND id=?").run(owner, file["id"] as string);
            db.prepare(
              "DELETE FROM records WHERE owner=? AND table_name='material_files' AND id=?",
            ).run(owner, file["id"] as string);
          }
        for (const source of TABLES)
          for (const [field, target] of Object.entries(rowReferences[source] ?? {}))
            if (target === table)
              for (const row of list(source).filter((r) => r[field] === id)) {
                if (!["subject_id", "task_id", "material_id"].includes(field))
                  throw new LocalError(
                    "Este registro possui dependências e não pode ser excluído.",
                  );
                write(source, { ...row, [field]: null });
              }
        db.prepare("DELETE FROM records WHERE owner=? AND table_name=? AND id=?").run(
          owner,
          table,
          id,
        );
        if (table === "material_files")
          db.prepare("DELETE FROM files WHERE owner=? AND id=?").run(owner, id);
      });
    },
    async recordSession(row) {
      transaction(() => {
        const existing = db
          .prepare(
            "SELECT id FROM records WHERE owner=? AND table_name='study_sessions' AND json_extract(data,'$.client_id')=?",
          )
          .get(owner, row.client_id);
        if (!existing) write("study_sessions", { ...row, id: row.id ?? randomUUID() }, true);
      });
    },
    async uploadMaterialFile(materialId, file) {
      if (file.size > 10000000) throw new LocalError("Arquivo grande demais (máx. 10 MB).", 413);
      const bytes = Buffer.from(await file.arrayBuffer());
      transaction(() => {
        const id = randomUUID();
        write(
          "material_files",
          {
            id,
            material_id: materialId,
            bucket_id: "study-materials",
            object_path: `${owner}/${id}`,
            original_name: file.name.slice(0, 255),
            mime_type: file.type || "application/octet-stream",
            size_bytes: file.size,
            sha256: null,
            extraction_status: "ready",
            extraction_error: null,
            created_at: new Date().toISOString(),
          },
          true,
        );
        db.prepare("INSERT INTO files(owner,id,bytes) VALUES(?,?,?)").run(owner, id, bytes);
      });
    },
    async downloadMaterialFile(id) {
      const row = read("material_files", id);
      const file = db.prepare("SELECT bytes FROM files WHERE owner=? AND id=?").get(owner, id) as
        { bytes: Uint8Array } | undefined;
      if (!row || !file) throw new LocalError("Arquivo não encontrado.", 404);
      return new Blob([new Uint8Array(file.bytes)], { type: row["mime_type"] as string });
    },
    async importAll(raw) {
      if (raw.version === 2) {
        const backup = await verifyFullBackup(raw);
        transaction(() => {
          const additions = fullBackupAdditions(backup, owner, randomUUID);
          for (const table of TABLES)
            for (const row of additions[table]) write(table, row as unknown as Row, true);
          for (let index = 0; index < backup.records.material_files.length; index++) {
            const original = backup.records.material_files[index]!;
            const restored = additions.material_files[index]!;
            const file = backup.files.find((f) => f.id === original.id)!;
            db.prepare("INSERT INTO files(owner,id,bytes) VALUES(?,?,?)").run(
              owner,
              restored.id,
              Buffer.from(base64ToBytes(file.base64)),
            );
          }
          const p = profileSchema.parse({
            ...profile(),
            ...backup.profile,
            id: owner,
            onboarded: true,
          });
          db.prepare("UPDATE users SET profile=? WHERE id=?").run(JSON.stringify(p), owner);
        });
        return;
      }
      const backup = backupSchema.parse(raw);
      transaction(() => {
        const additions = backupAdditions(backup, randomUUID);
        for (const table of TABLES)
          for (const row of additions[table] ?? []) write(table, row as unknown as Row, true);
        const p = profileSchema.parse({
          ...profile(),
          ...backup.profile,
          id: owner,
          onboarded: true,
        });
        db.prepare("UPDATE users SET profile=? WHERE id=?").run(JSON.stringify(p), owner);
      });
    },
  };
}
