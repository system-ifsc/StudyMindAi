import { createFileRoute } from "@tanstack/react-router";
import { assistantStatus, handleAssistant } from "@/lib/ai/assistant.server";

export const Route = createFileRoute("/api/assistant")({
  server: {
    handlers: { GET: () => assistantStatus(), POST: ({ request }) => handleAssistant(request) },
  },
});
