import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { DataProvider } from "@/hooks/use-data";
import { createMemoryRepo } from "@/lib/repo/memory";
import { demoSeed } from "@/lib/repo/demo-seed";
import { findSection } from "@/components/sections/registry";
import type { Repo } from "@/lib/repo/types";

// Uma única instância por carregamento de página: os dados de demonstração nunca tocam o banco.
let demoRepo: Repo | null = null;
const getDemo = () => (demoRepo ??= createMemoryRepo(demoSeed));

export const Route = createFileRoute("/demo/$section")({
  ssr: false,
  beforeLoad: ({ params }) => {
    if (!findSection(params.section))
      throw redirect({ to: "/demo/$section", params: { section: "painel" } });
  },
  head: () => ({
    meta: [
      { title: "Demonstração — StudyMind AI" },
      {
        name: "description",
        content: "Experimente a StudyMind com dados fictícios, sem criar conta.",
      },
      { property: "og:title", content: "Demonstração — StudyMind AI" },
      { property: "og:description", content: "Experimente a StudyMind com dados fictícios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  const { section } = Route.useParams();
  return (
    <DataProvider repo={getDemo()}>
      <AppShell mode="demo" section={section} />
    </DataProvider>
  );
}
