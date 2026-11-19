import { createFileRoute } from "@tanstack/react-router";
import { backendMode } from "@/lib/auth-config";
import { localDatabase } from "@/lib/local/database.server";

export async function healthResponse() {
  try {
    if (backendMode() === "local") localDatabase().prepare("SELECT 1").get();
    return Response.json(
      { status: "ok", storage: backendMode() === "local" ? "reachable" : "external-not-probed" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export const Route = createFileRoute("/api/health")({
  server: { handlers: { GET: healthResponse } },
});
