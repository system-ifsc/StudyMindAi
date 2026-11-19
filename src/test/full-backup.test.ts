// @vitest-environment node
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, appendFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { closeLocalDatabase, localDatabase } from "@/lib/local/database.server";
import { handleLocalApi } from "@/lib/local/api.server";
import { createLocalRepo } from "@/lib/repo/local.server";
import { exportFullBackup } from "@/lib/repo/full-backup";
import { verifyFullBackup, parseAnyBackup } from "@/lib/core/full-backup";
import { restoreQuiz } from "@/lib/core/learning";
import { TABLES } from "@/lib/core/types";
import type { Repo } from "@/lib/repo/types";
import { fullBackupFixture } from "./fixtures/full-backup";
let directory: string, source: Repo, target: Repo;
beforeAll(async () => {
  mkdirSync("data", { recursive: true });
  directory = mkdtempSync(resolve("data/restore-test-"));
  vi.stubEnv("LOCAL_DATA_DIR", directory);
  vi.stubEnv("VITE_BACKEND", "local");
  const register = async (email: string) => {
    const r = await handleLocalApi(
      new Request("http://localhost/api/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "auth:signup",
          email,
          password: "Backup-test-123!",
          name: "Teste",
        }),
      }),
    );
    expect(r.status).toBe(200);
    return createLocalRepo((await r.json()).data.user.id);
  };
  source = await register("source@example.test");
  target = await register("target@example.test");
  await source.importAll(await fullBackupFixture());
});
afterAll(() => {
  closeLocalDatabase();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});
it("exporta e restaura todas as tabelas e os binários entre contas com IDs novos", async () => {
  const backup = await exportFullBackup(source);
  expect(parseAnyBackup(JSON.stringify(backup)).ok).toBe(true);
  await target.importAll(backup);
  for (const table of TABLES) {
    const a = await source.list(table),
      b = await target.list(table);
    expect(a.length).toBeGreaterThan(0);
    expect(b).toHaveLength(a.length);
    expect(b[0]!.id).not.toBe(a[0]!.id);
  }
  const restored = await exportFullBackup(target);
  await expect(verifyFullBackup(restored)).resolves.toBeDefined();
  expect(restored.files[0]!.sha256).toBe(backup.files[0]!.sha256);
  expect(restored.files[0]!.base64).toBe(backup.files[0]!.base64);
  expect(restored.records.materials[0]!.subject_id).toBe(restored.records.subjects[0]!.id);
  expect(restored.records.question_attempt_answers[0]!.attempt_id).toBe(
    restored.records.question_attempts[0]!.id,
  );
  expect(restored.records.study_message_sources[0]!.message_id).toBe(
    restored.records.study_messages[0]!.id,
  );
  expect(
    restoreQuiz(
      restored.records.generated_question_sets[0]!,
      restored.records.generated_questions,
      restored.records.generated_question_options,
      restored.records.question_attempt_answers,
    )?.evaluations[0]?.correct,
  ).toBe(true);
});
it("recusa arquivo adulterado e referências quebradas antes de alterar a conta", async () => {
  const backup = await exportFullBackup(source);
  const broken = structuredClone(backup);
  broken.files[0]!.sha256 = "0".repeat(64);
  await expect(target.importAll(broken)).rejects.toThrow(/corrompido/);
  const dangling = structuredClone(backup);
  dangling.records.materials = [];
  await expect(target.importAll(dangling)).rejects.toThrow();
  expect(await target.list("subjects")).toHaveLength(1);
});
it("desfaz perfil, linhas e arquivos se a gravação do binário falhar", async () => {
  const backup = await exportFullBackup(source);
  const before = await target.getProfile();
  localDatabase().exec(
    "CREATE TEMP TRIGGER reject_backup_file BEFORE INSERT ON files BEGIN SELECT RAISE(ABORT,'simulated disk failure'); END;",
  );
  try {
    await expect(target.importAll(backup)).rejects.toThrow(/simulated/);
  } finally {
    localDatabase().exec("DROP TRIGGER reject_backup_file;");
  }
  expect(await target.list("study_messages")).toHaveLength(1);
  expect(await target.list("material_files")).toHaveLength(1);
  expect(await target.getProfile()).toEqual(before);
});
it("gera snapshot consistente com WAL e restaura contas e arquivos em banco novo", () => {
  const snapshot = join(directory, "snapshots/backup.sqlite");
  const restoredDirectory = join(directory, "restored");
  const env = { ...process.env, LOCAL_DATA_DIR: directory };
  execFileSync(process.execPath, ["scripts/local-backup.mjs", "create", snapshot], {
    env,
    stdio: "pipe",
  });
  execFileSync(
    process.execPath,
    ["scripts/local-backup.mjs", "restore", snapshot, restoredDirectory],
    { env, stdio: "pipe" },
  );
  const db = new DatabaseSync(join(restoredDirectory, "studymind.sqlite"), { readOnly: true });
  try {
    for (const table of ["users", "records", "files", "settings"])
      expect(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()).toEqual(
        localDatabase().prepare(`SELECT count(*) AS n FROM ${table}`).get(),
      );
    expect(db.prepare("SELECT hex(bytes) AS bytes FROM files ORDER BY owner,id").all()).toEqual(
      localDatabase().prepare("SELECT hex(bytes) AS bytes FROM files ORDER BY owner,id").all(),
    );
    expect(() =>
      execFileSync(
        process.execPath,
        ["scripts/local-backup.mjs", "restore", snapshot, restoredDirectory],
        { env, stdio: "pipe" },
      ),
    ).toThrow();
  } finally {
    db.close();
  }
  appendFileSync(snapshot, "corruption");
  expect(() =>
    execFileSync(
      process.execPath,
      ["scripts/local-backup.mjs", "restore", snapshot, join(directory, "invalid")],
      { env, stdio: "pipe" },
    ),
  ).toThrow();
});
