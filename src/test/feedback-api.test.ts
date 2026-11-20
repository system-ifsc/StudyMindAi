import { afterEach, beforeEach, expect, it, vi } from "vitest";
const verify = vi.hoisted(() => vi.fn());
const record = vi.hoisted(() => vi.fn());
vi.mock("@/lib/repo/feedback.server", () => ({ createFeedbackRepo: () => ({ record }) }));
vi.mock("@/lib/auth-config", () => ({ backendMode: () => "local" }));
vi.mock("@/lib/local/auth.server", () => ({ verifyLocalBearer: verify }));
import { feedbackStatus, handleFeedback } from "@/lib/feedback.server";
let sequence = 0;
const send = (body: unknown, authenticated = true) =>
  handleFeedback(
    new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: authenticated ? { authorization: "Bearer test" } : {},
      body: JSON.stringify({ name: "Ana Silva", email: "ana@gmail.com", ...(body as object) }),
    }),
  );
beforeEach(() => {
  vi.stubEnv("GMAIL_APP_PASSWORD", "");
  record.mockReset().mockResolvedValue("receipt-123");
  vi.stubEnv("GMAIL_CLIENT_ID", "client-id");
  vi.stubEnv("GMAIL_CLIENT_SECRET", "server-secret");
  vi.stubEnv("GMAIL_REFRESH_TOKEN", "refresh-token");
  vi.stubEnv("GMAIL_SENDER", "system.ifsc@gmail.com");
  verify.mockReturnValue({ user: { id: `user-${sequence++}`, email: "student@example.com" } });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(async (url: string) =>
        Response.json(
          url.includes("oauth2.googleapis.com")
            ? { access_token: "access-token" }
            : { id: "email-id" },
        ),
      ),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("rejects unauthenticated feedback without contacting the provider", async () => {
  expect((await send({}, false)).status).toBe(401);
  expect(fetch).not.toHaveBeenCalled();
});
it("rejects invalid messages and oversized requests", async () => {
  expect((await send({ category: "Opinião", message: " " })).status).toBe(400);
  expect((await send({ category: "Problema", message: "a".repeat(25000) })).status).toBe(413);
  expect(fetch).not.toHaveBeenCalled();
});
it("sends only to the fixed recipient with the submitted contact address", async () => {
  const response = await send({
    category: "Sugestão",
    message: "Adicionar novos temas",
    to: "other@example.com",
  });
  expect(response.status).toBe(200);
  const options = vi.mocked(fetch).mock.calls[1]![1]!;
  const mime = Buffer.from(JSON.parse(options.body as string).raw, "base64url").toString("utf8");
  expect(mime).toContain("To: system.ifsc@gmail.com\r\n");
  expect(mime).toContain("Reply-To: ana@gmail.com\r\n");
  expect(mime).not.toContain("other@example.com");
  expect(Buffer.from(mime.split("\r\n\r\n")[1]!, "base64").toString("utf8")).toContain(
    "Adicionar novos temas",
  );
  const text = Buffer.from(mime.split("\r\n\r\n")[1]!, "base64").toString("utf8");
  expect(text).toContain("Nome: Ana Silva");
  expect(text).toContain("Gmail para contato: ana@gmail.com");
  expect(mime).toContain("From: StudyMind <system.ifsc@gmail.com>");
  expect(options.headers).toMatchObject({ Authorization: "Bearer access-token" });
});
it("saves even without email configuration or when the provider fails", async () => {
  vi.stubEnv("GMAIL_REFRESH_TOKEN", "");
  expect(
    await (await send({ category: "Opinião", message: "Gostei muito do app" })).json(),
  ).toEqual({ saved: true, sent: false, id: "receipt-123" });
  expect(fetch).not.toHaveBeenCalled();
  vi.stubEnv("GMAIL_REFRESH_TOKEN", "secret");
  vi.mocked(fetch).mockResolvedValue(new Response("failure", { status: 500 }));
  expect(
    await (await send({ category: "Opinião", message: "Gostei muito do app" })).json(),
  ).toEqual({ saved: true, sent: false, id: "receipt-123" });
});
it("limits attempts per authenticated user", async () => {
  for (let i = 0; i < 5; i++)
    expect((await send({ category: "Opinião", message: "Gostei muito do app" })).status).toBe(200);
  expect((await send({ category: "Opinião", message: "Gostei muito do app" })).status).toBe(429);
});

it("does not send a message when OAuth refresh fails", async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ error: "invalid_grant" }, { status: 400 }));
  expect(
    await (await send({ category: "Opinião", message: "Gostei muito do app" })).json(),
  ).toEqual({ saved: true, sent: false, id: "receipt-123" });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("rejects missing confirmation from Gmail", async () => {
  vi.mocked(fetch).mockImplementation(async () => Response.json({ access_token: "token" }));
  expect(
    await (await send({ category: "Opinião", message: "Gostei muito do app" })).json(),
  ).toEqual({ saved: true, sent: false, id: "receipt-123" });
});

it("rejects missing name, non-Gmail contacts and header injection", async () => {
  for (const contact of [
    { name: "" },
    { email: "person@example.com" },
    { email: "ana@gmail.com\r\nBcc: other@gmail.com" },
  ]) {
    expect(
      (await send({ category: "Opinião", message: "Gostei muito do app", ...contact })).status,
    ).toBe(400);
  }
  expect(fetch).not.toHaveBeenCalled();
});

it("enables registration without Gmail", async () => {
  vi.stubEnv("GMAIL_REFRESH_TOKEN", "");
  expect(await feedbackStatus().json()).toEqual({ configured: true, emailConfigured: false });
});
it("does not confirm success or send email when persistence fails", async () => {
  record.mockRejectedValueOnce(new Error("disk full"));
  const response = await send({ category: "Problema", message: "Erro no calendário" });
  expect(response.status).toBe(503);
  expect(await response.json()).not.toHaveProperty("saved");
  expect(fetch).not.toHaveBeenCalled();
});
