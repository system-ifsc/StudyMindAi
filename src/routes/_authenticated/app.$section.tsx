import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/app/AppShell";
import { DataProvider } from "@/hooks/use-data";
import { createRepo } from "@/lib/repo";
import { findSection } from "@/components/sections/registry";

export const Route = createFileRoute("/_authenticated/app/$section")({
  beforeLoad: async ({ context, params }) => {
    if (!findSection(params.section))
      throw redirect({ to: "/app/$section", params: { section: "painel" } });
    const profile = await createRepo(context.user.id).getProfile();
    if (!profile.onboarded) throw redirect({ to: "/onboarding" });
  },
  head: ({ params }) => ({
    meta: [
      { title: `${findSection(params.section)?.label ?? "Painel"} — StudyMind AI` },
      { name: "description", content: "Seu espaço de estudos na StudyMind." },
      { property: "og:title", content: "StudyMind AI" },
      { property: "og:description", content: "Seu espaço de estudos na StudyMind." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppPage,
});

function AppPage() {
  const { user } = Route.useRouteContext();
  const { section } = Route.useParams();
  const repo = useMemo(() => createRepo(user.id), [user.id]);
  return (
    <DataProvider repo={repo}>
      <AppShell mode="real" section={section} />
    </DataProvider>
  );
}
