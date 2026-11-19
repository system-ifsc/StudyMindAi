import { randomUUID, timingSafeEqual } from "node:crypto";
import { appendFile, mkdir, rename, stat } from "node:fs/promises";
import { resolve, join } from "node:path";

const startedAt = Date.now();
const counters = { requests: 0, errors: 0, clientErrors: 0, durationMs: 0 };
let pendingLog = Promise.resolve();
export function monitoringRoute(url: string) {
  const path = new URL(url, "http://localhost").pathname;
  return ["/api/assistant", "/api/local", "/api/health", "/api/monitoring"].includes(path)
    ? path
    : "page";
}
/** Deliberadamente sem mensagens, stacks, query strings, contas, cabeçalhos ou conteúdo de estudo. */
export function recordEvent(event: {
  kind: "request" | "client" | "server";
  route: string;
  status: number;
  durationMs?: number;
  requestId?: string;
}) {
  if (event.kind === "request") {
    counters.requests++;
    counters.durationMs += event.durationMs ?? 0;
  }
  if (event.status >= 500) counters.errors++;
  if (event.kind === "client") counters.clientErrors++;
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...event,
    route: monitoringRoute(event.route),
  });
  // Erros sempre geram um evento estruturado; sucesso só se houver coleta habilitada.
  if (event.status >= 500 || event.kind === "client" || process.env["MONITORING_LOG_DIR"])
    console.info(line);
  const directory = process.env["MONITORING_LOG_DIR"];
  if (directory)
    pendingLog = pendingLog
      .then(async () => {
        const folder = resolve(directory);
        await mkdir(folder, { recursive: true, mode: 0o700 });
        const path = join(folder, "events.jsonl");
        const size = await stat(path)
          .then((s) => s.size)
          .catch(() => 0);
        if (size > 5 * 1024 * 1024) await rename(path, path + ".1");
        await appendFile(path, line + "\n", { mode: 0o600 });
      })
      .catch(() => {
        console.warn("monitoring log unavailable");
      });
}
export function monitoringSnapshot() {
  return {
    ...counters,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    averageDurationMs: counters.requests ? Math.round(counters.durationMs / counters.requests) : 0,
  };
}
export function monitoringAuthorized(request: Request) {
  const secret = process.env["MONITORING_TOKEN"];
  const provided = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!secret || !provided) return false;
  const a = Buffer.from(secret),
    b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function monitorRequest(request: Request, handler: () => Promise<Response>) {
  const requestId = randomUUID();
  const start = performance.now();
  let status = 500;
  try {
    const response = await handler();
    status = response.status;
    // Copiar preserva respostas com headers imutáveis.
    const headers = new Headers(response.headers);
    headers.set("X-Request-Id", requestId);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } finally {
    recordEvent({
      kind: "request",
      route: request.url,
      status,
      durationMs: Math.round(performance.now() - start),
      requestId,
    });
  }
}
