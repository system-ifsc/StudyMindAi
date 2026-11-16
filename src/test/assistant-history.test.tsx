import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { Assistant } from "@/components/sections/Assistant";
import { DataProvider } from "@/hooks/use-data";
import { createMemoryRepo } from "@/lib/repo/memory";
import { demoSeed } from "@/lib/repo/demo-seed";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "test" } } }) } },
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("retoma conversa e feedback por Repo depois de desmontar a tela", async () => {
  const memory = createMemoryRepo(demoSeed);
  const repo = { ...memory, mode: "real" as const };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options?: RequestInit) =>
      Response.json(
        options?.method === "POST"
          ? { text: "Uma explicação real de teste.", sources: [] }
          : { configured: true },
      ),
    ),
  );
  const tree = () => (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <DataProvider repo={repo}>
        <Assistant />
      </DataProvider>
    </QueryClientProvider>
  );
  const view = render(tree());
  await waitFor(() => expect(screen.getByLabelText("Pergunta")).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText("Pergunta"), { target: { value: "Explique SQL" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Enviar" })).not.toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
  await screen.findByText("Uma explicação real de teste.");
  await waitFor(() => expect(screen.getByRole("button", { name: "Útil" })).not.toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: "Útil" }));
  await waitFor(async () => expect(await repo.list("study_message_feedback")).toHaveLength(1));
  view.unmount();
  render(tree());
  await screen.findByRole("option", { name: "Explique SQL" });
  const conversations = await repo.list("study_conversations");
  fireEvent.change(screen.getByLabelText("Histórico salvo"), {
    target: { value: conversations[0]!.id },
  });
  await screen.findByText("Uma explicação real de teste.");
  expect(screen.getByRole("button", { name: "Útil" })).toHaveAttribute("aria-pressed", "true");
  expect(await repo.list("study_messages")).toHaveLength(2);
});
