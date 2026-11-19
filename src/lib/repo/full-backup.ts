import type { Repo } from "./types";
import { TABLES } from "@/lib/core/types";
import {
  bytesToBase64,
  fileDigest,
  verifyFullBackup,
  type BackupRecords,
  type FullBackup,
} from "@/lib/core/full-backup";

/** Toda leitura, inclusive dos binários privados, passa pelo Repo da conta ativa. */
export async function exportFullBackup(repo: Repo): Promise<FullBackup> {
  const profile = await repo.getProfile();
  const records = Object.fromEntries(
    await Promise.all(
      TABLES.map(async (table) => [table, structuredClone(await repo.list(table))]),
    ),
  ) as BackupRecords;
  const files: FullBackup["files"] = [];
  let encodedBytes = 0;
  for (const row of records.material_files) {
    encodedBytes += Math.ceil(row.size_bytes / 3) * 4;
    if (encodedBytes > 60 * 1024 * 1024)
      throw new Error(
        "Os arquivos ultrapassam o limite de 64 MB do backup. Solicite um backup administrativo.",
      );
    const bytes = new Uint8Array(await (await repo.downloadMaterialFile(row.id)).arrayBuffer());
    const sha256 = await fileDigest(bytes);
    files.push({ id: row.id, base64: bytesToBase64(bytes), sha256 });
    row.sha256 = sha256;
  }
  return verifyFullBackup({
    app: "studymind",
    version: 2,
    exported_at: new Date().toISOString(),
    profile,
    records,
    files,
  });
}
