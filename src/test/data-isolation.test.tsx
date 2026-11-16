import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it } from "vitest";
import { DataProvider, useTable } from "@/hooks/use-data";
import { createMemoryRepo } from "@/lib/repo/memory";
import { demoSeed } from "@/lib/repo/demo-seed";

afterEach(cleanup);
function Subjects() {
  const query = useTable("subjects");
  return <div>{query.data?.map((s) => s.name).join(",") ?? "Carregando"}</div>;
}
it("não exibe dados em cache da conta anterior ao trocar o repositório", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const repo = (name: string) =>
    createMemoryRepo(() => ({ ...demoSeed(), subjects: [{ id: "subject", name, color: "blue" }] }));
  const first = repo("Conta A"),
    second = repo("Conta B");
  const tree = (current: typeof first) => (
    <QueryClientProvider client={client}>
      <DataProvider repo={current}>
        <Subjects />
      </DataProvider>
    </QueryClientProvider>
  );
  const view = render(tree(first));
  await screen.findByText("Conta A");
  view.rerender(tree(second));
  expect(screen.queryByText("Conta A")).toBeNull();
  await screen.findByText("Conta B");
});
