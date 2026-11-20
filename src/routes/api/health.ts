import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: { handlers: { GET: async () => (await import("@/lib/health.server")).healthResponse() } },
});
