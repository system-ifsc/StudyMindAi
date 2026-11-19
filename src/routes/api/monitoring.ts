import { createFileRoute } from "@tanstack/react-router";
import { monitoringAuthorized, monitoringSnapshot, recordEvent } from "@/lib/monitoring.server";
import { verifyLocalBearer } from "@/lib/local/auth.server";
import { backendMode } from "@/lib/auth-config";
import { createClient } from "@supabase/supabase-js";

let windowStart = Date.now(),
  received = 0;
export async function monitoringRead(request: Request) {
  return Response.json(
    monitoringAuthorized(request) ? monitoringSnapshot() : { error: "Não autorizado." },
    { status: monitoringAuthorized(request) ? 200 : 401, headers: { "Cache-Control": "no-store" } },
  );
}
export async function monitoringWrite(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== (process.env["APP_ORIGIN"] || new URL(request.url).origin))
    return new Response(null, { status: 403 });
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return new Response(null, { status: 401 });
  let valid = false;
  if (backendMode() === "local") valid = !!verifyLocalBearer(token);
  else if (process.env["SUPABASE_URL"] && process.env["SUPABASE_PUBLISHABLE_KEY"]) {
    const client = createClient(
      process.env["SUPABASE_URL"],
      process.env["SUPABASE_PUBLISHABLE_KEY"],
      { auth: { persistSession: false } },
    );
    valid = !!(await client.auth.getUser(token)).data.user;
  }
  if (!valid) return new Response(null, { status: 401 });
  if (Date.now() - windowStart > 60000) {
    windowStart = Date.now();
    received = 0;
  }
  if (++received > 100) return new Response(null, { status: 429 });
  // Nenhum corpo de erro é recebido: apenas conta um evento na rota atual.
  recordEvent({
    kind: "client",
    route: request.headers.get("referer") || request.url,
    status: 500,
  });
  return new Response(null, { status: 204 });
}
export const Route = createFileRoute("/api/monitoring")({
  server: {
    handlers: {
      GET: ({ request }) => monitoringRead(request),
      POST: ({ request }) => monitoringWrite(request),
    },
  },
});
