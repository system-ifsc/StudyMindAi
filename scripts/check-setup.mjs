import { mkdir, open, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
const selected = process.env.VITE_BACKEND?.trim();
const cloud =
  selected === "supabase" ||
  (selected !== "local" &&
    Boolean(process.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_PUBLISHABLE_KEY));
let failed = false;
if (selected && !["local", "supabase"].includes(selected)) {
  console.error("VITE_BACKEND deve ser local ou supabase.");
  process.exit(1);
}
console.log(`Backend: ${cloud ? "Supabase" : "local (SQLite)"}`);
if (!cloud) {
  const directory = resolve(process.env.LOCAL_DATA_DIR || "data");
  const probe = join(directory, `.write-check-${process.pid}`);
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(":memory:");
    db.exec("SELECT 1");
    db.close();
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const file = await open(probe, "wx", 0o600);
    await file.close();
    await unlink(probe);
    console.log("OK: SQLite disponível e diretório de dados gravável.");
    console.log("OK: cadastro, login e armazenamento local não precisam de Supabase.");
    console.log(
      "Recuperação de senha: código privado fornecido no cadastro; não há envio de e-mail no modo local.",
    );
  } catch {
    console.error("Falha: use Node 22.13+ e um LOCAL_DATA_DIR com permissão de escrita.");
    failed = true;
  }
} else {
  for (const name of ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
    const present = Boolean(process.env[name]?.trim());
    console.log(`${present ? "OK" : "FALTA"}: ${name}`);
    if (!present) failed = true;
  }
  if (!failed)
    try {
      const base = new URL(process.env.VITE_SUPABASE_URL);
      if (!["https:", "http:"].includes(base.protocol)) throw new Error();
      const response = await fetch(new URL("/auth/v1/settings", base), {
        headers: { apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error();
      const settings = await response.json();
      const emailEnabled = settings.external?.email === true;
      console.log(`Auth por e-mail: ${emailEnabled ? "habilitado" : "desabilitado"}`);
      if (!emailEnabled) failed = true;
    } catch {
      console.error("Não foi possível acessar o Auth. Confira URL, chave pública e rede.");
      failed = true;
    }
  if (
    process.env.SUPABASE_URL &&
    process.env.VITE_SUPABASE_URL &&
    process.env.SUPABASE_URL.replace(/\/+$/, "") !==
      process.env.VITE_SUPABASE_URL.replace(/\/+$/, "")
  ) {
    console.error("Cliente e servidor apontam para backends diferentes.");
    failed = true;
  }
}
const ai = ["AI_BASE_URL", "AI_MODEL", "AI_API_KEY"].every((name) => process.env[name]?.trim());
console.log(
  `IA: ${ai ? "configurada (acesso ao modelo não testado)" : "opcional, não configurada; recursos de estudo continuam disponíveis"}`,
);
if (cloud && ai)
  for (const name of [
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "AI_DAILY_REQUEST_LIMIT",
    "AI_MONTHLY_REQUEST_LIMIT",
  ]) {
    if (!process.env[name]?.trim()) console.log(`FALTA PARA IA: ${name}`);
  }
process.exitCode = failed ? 1 : 0;
