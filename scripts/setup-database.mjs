import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const selected = process.env.VITE_BACKEND;
const local =
  selected === "local" ||
  (selected !== "supabase" &&
    !process.env.VITE_SUPABASE_URL &&
    !process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
if (local) {
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const { mkdirSync, chmodSync } = await import("node:fs");
    const { resolve, join } = await import("node:path");
    const directory = resolve(process.env.LOCAL_DATA_DIR || "data");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const path = join(directory, "studymind.sqlite");
    const db = new DatabaseSync(path);
    chmodSync(path, 0o600);
    try {
      db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
      const version = db.prepare("PRAGMA user_version").get().user_version;
      if (version > 2) throw new Error("O banco local foi criado por uma versão mais nova.");
      if (version === 0) {
        const schema = await readFile(
          new URL("../supabase/migrations/sqlite/0001_initial.sql", import.meta.url),
          "utf8",
        );
        db.exec("BEGIN IMMEDIATE");
        try {
          db.exec(schema);
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      }
      if (version < 2) {
        const schema = await readFile(
          new URL("../supabase/migrations/sqlite/0002_feedback.sql", import.meta.url),
          "utf8",
        );
        db.exec("BEGIN IMMEDIATE");
        try {
          db.exec(schema);
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      }
      console.log("Banco SQLite local configurado. Nenhuma configuração Supabase necessária.");
    } finally {
      db.close();
    }
    process.exit(0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Falha ao configurar SQLite.");
    process.exit(1);
  }
}
const { default: postgres } = await import("postgres");
if (!process.env.DATABASE_URL) {
  console.error("Defina DATABASE_URL no .env com a conexão PostgreSQL do seu projeto Supabase.");
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(571170001)`;
    const [state] = await tx`select to_regclass('public.profiles') as profiles,
      to_regclass('studymind_internal.migrations') as migrations, to_regclass('auth.users') as users`;
    if (!state.users)
      throw new Error("Este banco precisa ser um Supabase com Auth e Storage instalados.");
    if (state.profiles && !state.migrations)
      throw new Error(
        "Este banco já contém dados StudyMind sem histórico destas migrações. Use um projeto novo; a instalação foi cancelada para preservar os dados existentes.",
      );
    await tx`create schema if not exists studymind_internal`;
    await tx`revoke all on schema studymind_internal from public, anon, authenticated`;
    await tx`create table if not exists studymind_internal.migrations (
      name text primary key, checksum text not null, applied_at timestamptz not null default now()
    )`;
    const directory = new URL("../supabase/migrations/", import.meta.url);
    for (const name of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
      const source = await readFile(new URL(name, directory), "utf8");
      const checksum = createHash("sha256").update(source).digest("hex");
      const [existing] =
        await tx`select checksum from studymind_internal.migrations where name=${name}`;
      if (existing) {
        if (existing.checksum !== checksum)
          throw new Error(`Migração aplicada foi modificada: ${name}`);
        continue;
      }
      await tx.unsafe(source);
      await tx`insert into studymind_internal.migrations(name,checksum) values(${name},${checksum})`;
      console.log(`Aplicada: ${name}`);
    }
  });
  console.log("Banco configurado. Configure também as URLs de Auth e o SMTP no painel Supabase.");
} catch (error) {
  // Never print the connection string, password or arbitrary database error details.
  console.error(
    error instanceof Error && !("severity" in error)
      ? error.message
      : "Falha ao instalar as migrações; a transação foi revertida. Confira a conexão e as permissões do banco.",
  );
  process.exitCode = 1;
} finally {
  await sql.end();
}
