import feedbackSchema from "../../../supabase/migrations/sqlite/0002_feedback.sql?raw";
import initialSchema from "../../../supabase/migrations/sqlite/0001_initial.sql?raw";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { resolve, join } from "node:path";

let database: DatabaseSync | undefined;
let location: string | undefined;
export function localDatabase() {
  const directory = resolve(process.env["LOCAL_DATA_DIR"] || "data");
  const path = join(directory, "studymind.sqlite");
  if (database && location === path) return database;
  database?.close();
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  const version = (db.prepare("PRAGMA user_version").get() as { user_version: number })
    .user_version;
  if (version > 2) {
    db.close();
    throw new Error("O banco local foi criado por uma versão mais nova do aplicativo.");
  }
  if (version === 0) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(initialSchema);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }

  if (version < 2) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(feedbackSchema);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }

  database = db;
  location = path;
  return db;
}
export function transaction<T>(fn: () => T): T {
  const db = localDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function closeLocalDatabase() {
  database?.close();
  database = undefined;
  location = undefined;
}
