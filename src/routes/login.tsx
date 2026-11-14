import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/auth/AuthCard";

export const Route = createFileRoute("/login")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app/$section", params: { section: "painel" } });
  },
  head: () => ({
    meta: [
      { title: "Entrar — StudyMind AI" },
      { name: "description", content: "Acesse sua conta StudyMind." },
      { property: "og:title", content: "Entrar — StudyMind AI" },
      { property: "og:description", content: "Acesse sua conta StudyMind." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthCard mode="login" />,
});
