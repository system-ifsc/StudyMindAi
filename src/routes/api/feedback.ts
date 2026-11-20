import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/feedback")({
  server: {
    handlers: {
      GET: async () => (await import("@/lib/feedback.server")).feedbackStatus(),
      POST: async ({ request }) => (await import("@/lib/feedback.server")).handleFeedback(request),
    },
  },
});
