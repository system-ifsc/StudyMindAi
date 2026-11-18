// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const a = "10000000-0000-4000-8000-000000000001";
const b = "10000000-0000-4000-8000-000000000002";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  // Minimal Supabase system schemas; migrations themselves run unmodified.
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$;
    GRANT USAGE ON SCHEMA storage TO authenticated,service_role;
    GRANT SELECT,INSERT,DELETE ON storage.objects TO authenticated;
  `);
  const directory = new URL("../../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort())
    await db.exec(await readFile(new URL(name, directory), "utf8"));
  await db.query(
    `INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ($1,'a@example.com','{"name":"Conta A"}'),($2,'b@example.com','{"name":"Conta B"}')`,
    [a, b],
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});

async function asUser<T>(id: string, fn: (tx: PGlite) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE authenticated`);
    await tx.query(`SELECT set_config('request.jwt.claim.sub',$1,true)`, [id]);
    return fn(tx as unknown as PGlite);
  });
}

describe("migrações PostgreSQL independentes", () => {
  it("cria o perfil automaticamente para novos usuários e isola a leitura", async () => {
    const result = await asUser(a, (tx) =>
      tx.query<{ id: string; display_name: string }>("SELECT id,display_name FROM public.profiles"),
    );
    expect(result.rows).toEqual([{ id: a, display_name: "Conta A" }]);
    await expect(
      asUser(a, (tx) =>
        tx.query("UPDATE profiles SET display_name='B' WHERE id=$1 RETURNING id", [b]),
      ),
    ).resolves.toMatchObject({ rows: [] });
  });
  it("rejeita vínculos entre contas mesmo quando o invasor conhece o ID", async () => {
    const id = crypto.randomUUID();
    await asUser(a, (tx) =>
      tx.query("INSERT INTO subjects(id,user_id,name) VALUES($1,$2,'Privada')", [id, a]),
    );
    expect(
      (await asUser(b, (tx) => tx.query("SELECT * FROM subjects WHERE id=$1", [id]))).rows,
    ).toEqual([]);
    await expect(
      asUser(b, (tx) =>
        tx.query(
          "INSERT INTO tasks(user_id,subject_id,title,due_date) VALUES($1,$2,'Ataque',current_date)",
          [b, id],
        ),
      ),
    ).rejects.toThrow(/foreign key/i);
    await expect(
      asUser(b, (tx) => tx.query("INSERT INTO subjects(user_id,name) VALUES($1,'Ataque')", [a])),
    ).rejects.toThrow(/row.level security/i);
  });
  it("permite arquivos só na pasta do proprietário", async () => {
    await asUser(a, (tx) =>
      tx.query("INSERT INTO storage.objects(bucket_id,name) VALUES('study-materials',$1)", [
        `${a}/file`,
      ]),
    );
    expect((await asUser(b, (tx) => tx.query("SELECT * FROM storage.objects"))).rows).toHaveLength(
      0,
    );
    await expect(
      asUser(b, (tx) =>
        tx.query("INSERT INTO storage.objects(bucket_id,name) VALUES('study-materials',$1)", [
          `${a}/other`,
        ]),
      ),
    ).rejects.toThrow(/row.level security/i);
  });
  it("importa backup aditivamente, remapeia IDs por tabela e desfaz falhas", async () => {
    const id = crypto.randomUUID();
    const payload = {
      app: "studymind",
      version: 1,
      exported_at: new Date().toISOString(),
      profile: {
        display_name: "Importado",
        course: "Curso",
        objective: "Meta",
        weekly_hours: 5,
        availability: [60, 60, 60, 60, 60, 0, 0],
      },
      subjects: [{ id, name: "Importada", color: "indigo" }],
      tasks: [
        {
          id,
          subject_id: id,
          title: "Tarefa",
          notes: "",
          due_date: "2026-11-20",
          duration_min: 30,
          priority: 2,
          done: false,
          completed_at: null,
        },
      ],
      sessions: [],
      flashcards: [],
      goals: [],
      materials: [],
      quiz_answers: [],
    };
    await asUser(a, (tx) =>
      tx.query("SELECT import_user_data($1::jsonb)", [JSON.stringify(payload)]),
    );
    await asUser(a, (tx) =>
      tx.query("SELECT import_user_data($1::jsonb)", [JSON.stringify(payload)]),
    );
    const rows = await asUser(a, (tx) =>
      tx.query<{ id: string; subject_id: string }>(
        "SELECT id,subject_id FROM tasks WHERE title='Tarefa'",
      ),
    );
    expect(rows.rows).toHaveLength(2);
    expect(
      rows.rows.every((row) => row.id !== row.subject_id && row.id !== id && row.subject_id !== id),
    ).toBe(true);
    const invalid = { ...payload, profile: { ...payload.profile, weekly_hours: 0 } };
    await expect(
      asUser(a, (tx) => tx.query("SELECT import_user_data($1::jsonb)", [JSON.stringify(invalid)])),
    ).rejects.toThrow();
    expect(
      (await asUser(a, (tx) => tx.query("SELECT id FROM tasks WHERE title='Tarefa'"))).rows,
    ).toHaveLength(2);
  });
  it("cotas são exclusivas do servidor e recusam o terceiro pedido acima do limite", async () => {
    await db.query(
      "INSERT INTO ai_usage_limits(user_id,daily_units,monthly_units) VALUES($1,2,5)",
      [a],
    );
    await expect(
      asUser(a, (tx) => tx.query("SELECT reserve_ai_usage($1,$2,1)", [a, crypto.randomUUID()])),
    ).rejects.toThrow(/permission denied/i);
    for (let i = 0; i < 2; i++)
      await db.transaction(async (tx) => {
        await tx.exec("SET LOCAL ROLE service_role");
        await tx.query("SELECT reserve_ai_usage($1,$2,1)", [a, crypto.randomUUID()]);
      });
    await expect(
      db.transaction(async (tx) => {
        await tx.exec("SET LOCAL ROLE service_role");
        await tx.query("SELECT reserve_ai_usage($1,$2,1)", [a, crypto.randomUUID()]);
      }),
    ).rejects.toThrow(/usage limit exceeded/i);
  });
});
