import { createFileRoute } from "@tanstack/react-router";
import { handleLocalApi } from "@/lib/local/api.server";
export const Route = createFileRoute("/api/local")({
  server: { handlers: { POST: ({ request }) => handleLocalApi(request) } },
});
