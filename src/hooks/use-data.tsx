import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Repo, NewRow } from "@/lib/repo/types";
import type { TableName, Tables, Profile } from "@/lib/core/types";

const Ctx = createContext<Repo | null>(null);
export function DataProvider({ repo, children }: { repo: Repo; children: ReactNode }) {
  return <Ctx.Provider value={repo}>{children}</Ctx.Provider>;
}
export function useRepo() {
  const r = useContext(Ctx);
  if (!r) throw new Error("DataProvider ausente");
  return r;
}
const repoIds = new WeakMap<Repo, number>();
let nextRepoId = 0;
// Cada instância pertence a uma conta. O modo sozinho compartilhava o cache
// entre usuários que entrassem sucessivamente no mesmo navegador.
const key = (repo: Repo, t: string) => {
  let id = repoIds.get(repo);
  if (id === undefined) {
    id = ++nextRepoId;
    repoIds.set(repo, id);
  }
  return [repo.mode, id, t];
};

export function useTable<T extends TableName>(table: T) {
  const repo = useRepo();
  return useQuery<Tables[T][]>({ queryKey: key(repo, table), queryFn: () => repo.list(table) });
}
export function useProfile() {
  const repo = useRepo();
  return useQuery<Profile>({ queryKey: key(repo, "profile"), queryFn: () => repo.getProfile() });
}

/** Mutação com feedback padronizado (toast de sucesso/erro) e recarga das tabelas afetadas. */
export function useSave<A>(
  fn: (repo: Repo, a: A) => Promise<void>,
  opts: { invalidate: string[]; success?: string | undefined },
) {
  const repo = useRepo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: A) => fn(repo, a),
    onSuccess: () => {
      for (const t of opts.invalidate) qc.invalidateQueries({ queryKey: key(repo, t) });
      if (opts.success) toast.success(opts.success);
    },
    onError: (e: Error) => toast.error(e.message || "Algo deu errado. Tente novamente."),
  });
}
export const useInsert = <T extends TableName>(t: T, success = "Salvo") =>
  useSave<NewRow<T>>((r, row) => r.insert(t, row), { invalidate: [t], success });
export const useUpdate = <T extends TableName>(t: T, success?: string) =>
  useSave<{ id: string; patch: Partial<Tables[T]> }>((r, a) => r.update(t, a.id, a.patch), {
    invalidate: [t],
    success,
  });
export const useRemove = (t: TableName, extra: string[] = []) =>
  useSave<string>((r, id) => r.remove(t, id), { invalidate: [t, ...extra], success: "Excluído" });
