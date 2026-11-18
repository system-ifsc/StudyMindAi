import { localRequest } from "@/lib/local/client";
import type { Repo } from "./types";
export function createLocalHttpRepo(): Repo {
  return {
    mode: "real",
    getProfile: () => localRequest({ op: "profile" }),
    updateProfile: (patch) => localRequest({ op: "profile:update", patch }),
    list: (table) => localRequest({ op: "list", table }),
    get: (table, id) => localRequest({ op: "get", table, id }),
    insert: (table, row) => localRequest({ op: "insert", table, row }),
    update: (table, id, patch) => localRequest({ op: "update", table, id, patch }),
    remove: (table, id) => localRequest({ op: "remove", table, id }),
    recordSession: (row) => localRequest({ op: "session:record", table: "study_sessions", row }),
    importAll: (backup) => localRequest({ op: "import", backup }),
    async uploadMaterialFile(materialId, file) {
      const form = new FormData();
      form.set("materialId", materialId);
      form.set("file", file);
      const response = await fetch("/api/local", {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
      if (!response.ok) throw new Error(((await response.json()) as { error: string }).error);
    },
    async downloadMaterialFile(id) {
      const response = await fetch("/api/local", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "download", id }),
      });
      if (!response.ok) throw new Error(((await response.json()) as { error: string }).error);
      return response.blob();
    },
  };
}
