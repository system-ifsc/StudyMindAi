// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { monitorRequest, monitoringAuthorized, monitoringSnapshot } from "@/lib/monitoring.server";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("registra falha e latência com ID sem expor token, consulta ou corpo", async () => {
  vi.stubEnv("MONITORING_LOG_DIR", "");
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  const before = monitoringSnapshot();
  const response = await monitorRequest(
    new Request("http://localhost/api/assistant?secret=private-query", {
      headers: { Authorization: "Bearer private-token" },
    }),
    async () => new Response("private-answer", { status: 503 }),
  );
  expect(response.headers.get("X-Request-Id")).toMatch(/^[a-f0-9-]{36}$/);
  const entry = JSON.parse(log.mock.calls[0]![0]);
  expect(entry).toMatchObject({ kind: "request", route: "/api/assistant", status: 503 });
  expect(entry.durationMs).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-query|private-token|private-answer/);
  expect(monitoringSnapshot().errors).toBe(before.errors + 1);
});
it("conta exceções e protege a consulta de métricas com token privado", async () => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubEnv("MONITORING_TOKEN", "monitoring-test-secret");
  expect(monitoringAuthorized(new Request("http://localhost/api/monitoring"))).toBe(false);
  expect(
    monitoringAuthorized(
      new Request("http://localhost/api/monitoring", {
        headers: { Authorization: "Bearer wrong" },
      }),
    ),
  ).toBe(false);
  expect(
    monitoringAuthorized(
      new Request("http://localhost/api/monitoring", {
        headers: { Authorization: "Bearer monitoring-test-secret" },
      }),
    ),
  ).toBe(true);
  const before = monitoringSnapshot().errors;
  await expect(
    monitorRequest(new Request("http://localhost/private-user-path"), async () => {
      throw new Error("private failure");
    }),
  ).rejects.toThrow("private failure");
  expect(monitoringSnapshot().errors).toBe(before + 1);
  expect(JSON.stringify(monitoringSnapshot())).not.toContain("monitoring-test-secret");
});
