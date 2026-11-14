import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { DataProvider } from "@/hooks/use-data";
import { createCloudRepo } from "@/lib/repo/cloud";
import { findSection } from "@/components/sections/registry";

export const Route = createFileRoute("/_authenticated/app/$section")({
  beforeLoad: async ({ context, params }) => {
    if (!findSection(params.section))
      throw redirect({ to: "/app/$section", params: { section: "painel" } });
    const { data } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", context.user.id)
      .maybeSingle();
    if (!data?.onboarded) throw redirect({ to: "/onboarding" });
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
  const repo = useMemo(() => createCloudRepo(user.id), [user.id]);
  return (
    <DataProvider repo={repo}>
      <AppShell mode="real" section={section} />
    </DataProvider>
  );
}
