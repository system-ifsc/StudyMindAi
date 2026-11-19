import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile, chmod, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, join, dirname } from "node:path";

function checkDatabase(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const result = db.prepare("PRAGMA integrity_check").all();
    if (result.length !== 1 || Object.values(result[0])[0] !== "ok")
      throw new Error("A integridade SQLite falhou.");
    if (db.prepare("PRAGMA user_version").get().user_version !== 1)
      throw new Error("Versão SQLite incompatível.");
    for (const table of ["users", "records", "files", "settings"])
      db.prepare(`SELECT count(*) FROM ${table}`).get();
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
const digest = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
export async function createSnapshot(
  destination,
  directory = process.env.LOCAL_DATA_DIR || "data",
) {
  const target = resolve(destination);
  if (
    await stat(target)
      .then(() => true)
      .catch(() => false)
  )
    throw new Error("O destino já existe. Escolha um arquivo novo.");
  const db = checkDatabase(join(resolve(directory), "studymind.sqlite"));
  try {
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    // VACUUM INTO gera uma cópia consistente, incluindo dados que ainda estão no WAL.
    db.prepare("VACUUM INTO ?").run(target);
    await chmod(target, 0o600);
    await writeFile(target + ".sha256", (await digest(target)) + "\n", { flag: "wx", mode: 0o600 });
  } finally {
    db.close();
  }
  return target;
}
export async function restoreSnapshot(snapshot, targetDirectory) {
  const source = resolve(snapshot),
    target = resolve(targetDirectory);
  const expected = (await readFile(source + ".sha256", "utf8")).trim();
  if (!/^[a-f0-9]{64}$/.test(expected) || (await digest(source)) !== expected)
    throw new Error("Checksum do snapshot inválido.");
  checkDatabase(source).close();
  // Sem recursive: recusa qualquer diretório existente e nunca substitui dados de produção.
  await mkdir(target, { mode: 0o700 });
  const destination = join(target, "studymind.sqlite");
  await copyFile(source, destination, constants.COPYFILE_EXCL);
  await chmod(destination, 0o600);
  checkDatabase(destination).close();
  return destination;
}
if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const [command, source, destination] = process.argv.slice(2);
  try {
    if (command === "create" && source)
      console.log("Snapshot criado:", await createSnapshot(source));
    else if (command === "restore" && source && destination)
      console.log("Snapshot restaurado:", await restoreSnapshot(source, destination));
    else
      throw new Error("Use: npm run backup:local -- create ARQUIVO ou restore ARQUIVO NOVA_PASTA");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
