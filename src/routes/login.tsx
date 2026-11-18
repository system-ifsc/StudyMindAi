import { isAuthConfigured } from "@/lib/auth-config";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { auth } from "@/lib/auth/client";
import { AuthCard } from "@/components/auth/AuthCard";

export const Route = createFileRoute("/login")({
  ssr: false,
  beforeLoad: async () => {
    if (!isAuthConfigured()) return;
    const { data } = await auth.getSession();
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
