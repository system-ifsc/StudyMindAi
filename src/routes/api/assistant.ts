import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/assistant")({
  server: {
    handlers: {
      GET: async () => (await import("@/lib/ai/assistant.server")).assistantStatus(),
      POST: async ({ request }) =>
        (await import("@/lib/ai/assistant.server")).handleAssistant(request),
    },
  },
});
