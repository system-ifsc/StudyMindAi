import { z } from "zod";
import { backupSchema, parseBackup, type Backup } from "./backup";
import { rowSchemas, rowReferences } from "./local-validation";
import { TABLES, type TableName, type Tables } from "./types";

export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
export type BackupRecords = { [K in TableName]: Tables[K][] };
export interface FullBackup {
  app: "studymind";
  version: 2;
  exported_at: string;
  profile: Backup["profile"];
  records: BackupRecords;
  files: { id: string; base64: string; sha256: string }[];
}
export type AnyBackup = Backup | FullBackup;
const recordsSchema = z.object(
  Object.fromEntries(TABLES.map((t) => [t, z.array(rowSchemas[t]).max(20000)])),
) as unknown as z.ZodType<BackupRecords>;
export const fullBackupSchema = z
  .object({
    app: z.literal("studymind"),
    version: z.literal(2),
    exported_at: z.iso.datetime({ offset: true }),
    profile: backupSchema.shape.profile,
    records: recordsSchema,
    files: z
      .array(
        z.object({
          id: z.string().uuid(),
          base64: z
            .string()
            .max(13333336)
            .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      )
      .max(100),
  })
  .superRefine((b, ctx) => {
    const ids = new Map(TABLES.map((t) => [t, new Set(b.records[t].map((r) => r.id))]));
    for (const table of TABLES) {
      if (ids.get(table)!.size !== b.records[table].length)
        ctx.addIssue({ code: "custom", message: `IDs duplicados em ${table}.` });
      for (const row of b.records[table]) {
        for (const [field, target] of Object.entries(rowReferences[table] ?? {})) {
          const value = (row as unknown as Record<string, unknown>)[field];
          if (value != null && !ids.get(target)!.has(value as string))
            ctx.addIssue({ code: "custom", message: `Referência inválida em ${table}.${field}.` });
        }
      }
    }
    for (const row of b.records.question_attempt_answers) {
      if (
        b.records.question_attempts.find((a) => a.id === row.attempt_id)?.set_id !== row.set_id ||
        b.records.generated_questions.find((q) => q.id === row.question_id)?.set_id !== row.set_id
      )
        ctx.addIssue({ code: "custom", message: "A resposta não pertence ao simulado informado." });
    }
    const fileIds = new Set(b.files.map((f) => f.id));
    if (
      fileIds.size !== b.files.length ||
      fileIds.size !== b.records.material_files.length ||
      b.records.material_files.some((f) => !fileIds.has(f.id))
    )
      ctx.addIssue({
        code: "custom",
        message: "O backup está sem arquivos originais ou contém arquivos duplicados.",
      });
  });

export function bytesToBase64(bytes: Uint8Array): string {
  let value = "";
  for (let i = 0; i < bytes.length; i += 32768)
    value += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(value);
}
export function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
export async function fileDigest(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, "0")).join("");
}
export async function verifyFullBackup(raw: unknown): Promise<FullBackup> {
  const b = fullBackupSchema.parse(raw);
  if (new TextEncoder().encode(JSON.stringify(b)).length > MAX_BACKUP_BYTES)
    throw new Error("O backup ultrapassa 64 MB.");
  for (const file of b.files) {
    const bytes = base64ToBytes(file.base64);
    const metadata = b.records.material_files.find((r) => r.id === file.id)!;
    if (
      bytes.length !== metadata.size_bytes ||
      (await fileDigest(bytes)) !== file.sha256 ||
      (metadata.sha256 && metadata.sha256 !== file.sha256)
    )
      throw new Error("Arquivo original corrompido no backup. Nada foi importado.");
  }
  return b;
}
export function parseAnyBackup(
  text: string,
): { ok: true; data: AnyBackup } | { ok: false; error: string } {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    return { ok: false, error: "Arquivo grande demais (máx. 64 MB)." };
  try {
    const raw = JSON.parse(text);
    if (raw.version !== 2) return parseBackup(text);
    const parsed = fullBackupSchema.safeParse(raw);
    if (!parsed.success)
      return { ok: false, error: "Backup completo inválido: " + parsed.error.issues[0]?.message };
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, error: "O arquivo não é um JSON válido." };
  }
}
/** Mapeamento independente por tabela, sem reutilizar IDs ou caminhos de outra conta. */
export function fullBackupAdditions(
  b: FullBackup,
  owner: string,
  nextId: () => string,
): BackupRecords {
  const ids = new Map(TABLES.map((t) => [t, new Map(b.records[t].map((r) => [r.id, nextId()]))]));
  return Object.fromEntries(
    TABLES.map((table) => [
      table,
      b.records[table].map((original) => {
        const row = { ...original, id: ids.get(table)!.get(original.id)! } as Record<
          string,
          unknown
        >;
        for (const [field, target] of Object.entries(rowReferences[table] ?? {}))
          if (row[field] != null) row[field] = ids.get(target)!.get(row[field] as string)!;
        if ("client_id" in row) row["client_id"] = nextId();
        if (table === "material_files") row["object_path"] = `${owner}/${row["id"]}`;
        return row;
      }),
    ]),
  ) as unknown as BackupRecords;
}
