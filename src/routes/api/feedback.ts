import { createFileRoute } from "@tanstack/react-router";
import { feedbackStatus, handleFeedback } from "@/lib/feedback.server";

export const Route = createFileRoute("/api/feedback")({
  server: {
    handlers: { GET: () => feedbackStatus(), POST: ({ request }) => handleFeedback(request) },
  },
});
