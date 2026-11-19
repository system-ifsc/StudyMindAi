import type { Profile, TableName, Tables } from "@/lib/core/types";
import type { AnyBackup } from "@/lib/core/full-backup";

export type NewRow<T extends TableName> = Omit<Tables[T], "id"> & { id?: string };

/** Contrato único usado pela interface. Implementações: SQLite local ou Supabase (dados reais) e memória (modo demonstração). */
export interface Repo {
  mode: "real" | "demo";
  getProfile(): Promise<Profile>;
  updateProfile(patch: Partial<Omit<Profile, "id">>): Promise<void>;
  list<T extends TableName>(table: T): Promise<Tables[T][]>;
  get<T extends TableName>(table: T, id: string): Promise<Tables[T] | null>;
  insert<T extends TableName>(table: T, row: NewRow<T>): Promise<void>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Promise<void>;
  remove(table: TableName, id: string): Promise<void>;
  /** Registro idempotente: repetir o mesmo client_id não duplica a sessão. */
  recordSession(row: NewRow<"study_sessions">): Promise<void>;
  uploadMaterialFile(materialId: string, file: File): Promise<void>;
  downloadMaterialFile(fileId: string): Promise<Blob>;
  importAll(b: AnyBackup): Promise<void>;
}
