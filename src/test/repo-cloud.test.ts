import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
import { createCloudRepo } from "@/lib/repo/cloud";

describe("leitura completa do Repo Cloud", () => {
  beforeEach(() => vi.clearAllMocks());
  it("pagina além de 5000 registros, sempre filtrando a conta e ordenando IDs", async () => {
    const rows = Array.from({ length: 5101 }, (_, i) => ({ id: String(i) }));
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn(async (start: number, end: number) => ({
        data: rows.slice(start, end + 1),
        error: null,
      })),
    };
    mocks.from.mockReturnValue(query);
    const result = await createCloudRepo("owner").list("quiz_answers");
    expect(result).toEqual(rows);
    expect(query.range).toHaveBeenCalledTimes(11);
    expect(query.eq.mock.calls.every((args) => args[0] === "user_id" && args[1] === "owner")).toBe(
      true,
    );
    expect(query.order).toHaveBeenCalledWith("id", { ascending: true });
  });
  it("não devolve sucesso parcial quando uma página falha", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi
        .fn()
        .mockResolvedValueOnce({ data: Array(500).fill({ id: "1" }), error: null })
        .mockResolvedValueOnce({ data: null, error: { message: "network" } }),
    };
    mocks.from.mockReturnValue(query);
    await expect(createCloudRepo("owner").list("quiz_answers")).rejects.toThrow(
      "carregar os dados",
    );
  });
});
