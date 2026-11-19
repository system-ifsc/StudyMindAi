// @vitest-environment node
import { expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { createCloudRepo } from "@/lib/repo/cloud";
import { fullBackupFixture } from "./fixtures/full-backup";

function setup(committed = false) {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: committed ? { id: "committed" } : null, error: null }),
  };
  const client = { storage: { from: () => ({ upload, remove }) }, rpc, from: () => query };
  return {
    upload,
    remove,
    rpc,
    repo: createCloudRepo("10000000-0000-4000-8000-000000000001", client as never),
  };
}
it("envia binários privados antes de confirmar todas as linhas pela RPC v2", async () => {
  const { repo, upload, rpc } = setup();
  await repo.importAll(await fullBackupFixture());
  expect(upload).toHaveBeenCalledTimes(1);
  expect(upload.mock.calls[0]![0]).toMatch(/^10000000-0000-4000-8000-000000000001\//);
  const [name, args] = rpc.mock.calls[0]!;
  expect(name).toBe("import_full_user_data");
  expect(args.payload.files).toEqual([]);
  expect(args.payload.records.study_messages[0].conversation_id).toBe(
    args.payload.records.study_conversations[0].id,
  );
  expect(upload.mock.invocationCallOrder[0]!).toBeLessThan(rpc.mock.invocationCallOrder[0]!);
});
it("remove objetos novos quando a transação falha e não houve confirmação", async () => {
  const { repo, rpc, remove, upload } = setup();
  rpc.mockResolvedValue({ error: { message: "transaction failed" } });
  await expect(repo.importAll(await fullBackupFixture())).rejects.toThrow("restaurar o backup");
  expect(remove).toHaveBeenCalledWith([upload.mock.calls[0]![0]]);
});
it("conserva os arquivos se a RPC confirmou mas a resposta se perdeu", async () => {
  const { repo, rpc, remove } = setup(true);
  rpc.mockResolvedValue({ error: { message: "lost response" } });
  await expect(repo.importAll(await fullBackupFixture())).rejects.toThrow();
  expect(remove).not.toHaveBeenCalled();
});
