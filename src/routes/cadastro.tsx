import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/auth/AuthCard";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — StudyMind AI" },
      { name: "description", content: "Crie sua conta gratuita na StudyMind." },
      { property: "og:title", content: "Criar conta — StudyMind AI" },
      { property: "og:description", content: "Crie sua conta gratuita na StudyMind." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthCard mode="cadastro" />,
});
