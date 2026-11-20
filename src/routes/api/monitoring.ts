import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/monitoring")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        (await import("@/lib/monitoring-api.server")).monitoringRead(request),
      POST: async ({ request }) =>
        (await import("@/lib/monitoring-api.server")).monitoringWrite(request),
    },
  },
});
