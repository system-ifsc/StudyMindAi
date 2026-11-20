// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  verify: vi.fn(),
  close: vi.fn(),
  create: vi.fn(),
}));
vi.mock("nodemailer", () => ({ default: { createTransport: mocks.create } }));
import { gmailConfigured, sendFeedbackEmail, verifyGmailSmtp } from "@/lib/gmail.server";

const feedback = {
  name: "Ana Silva",
  email: "ana@gmail.com",
  category: "Problema" as const,
  message: "Calendário não abre",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GMAIL_SENDER", "system.ifsc@gmail.com");
  vi.stubEnv("GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop");
  vi.stubEnv("GMAIL_REFRESH_TOKEN", "");
  mocks.create.mockReturnValue({ sendMail: mocks.send, verify: mocks.verify, close: mocks.close });
  mocks.send.mockResolvedValue({ accepted: ["system.ifsc@gmail.com"] });
  mocks.verify.mockResolvedValue(true);
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("uses TLS SMTP and a normalized app password, with fixed recipient and contact reply-to", async () => {
  expect(gmailConfigured()).toBe(true);
  await sendFeedbackEmail(feedback, { id: "user-123" });
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "system.ifsc@gmail.com", pass: "abcdefghijklmnop" },
      disableFileAccess: true,
      disableUrlAccess: true,
    }),
  );
  expect(mocks.send).toHaveBeenCalledWith(
    expect.objectContaining({
      to: "system.ifsc@gmail.com",
      replyTo: "ana@gmail.com",
      subject: "[StudyMind] Problema",
      text: expect.stringContaining(feedback.message),
    }),
  );
  expect(fetch).not.toHaveBeenCalled();
  expect(mocks.close).toHaveBeenCalledOnce();
});
it("does not confirm delivery when the recipient is rejected", async () => {
  mocks.send.mockResolvedValue({ accepted: [] });
  await expect(sendFeedbackEmail(feedback, { id: "user" })).rejects.toThrow();
  expect(mocks.close).toHaveBeenCalledOnce();
});
it("closes the transport after an authentication error", async () => {
  mocks.send.mockRejectedValue(new Error("authentication failed"));
  await expect(sendFeedbackEmail(feedback, { id: "user" })).rejects.toThrow();
  expect(mocks.close).toHaveBeenCalledOnce();
});
it("verifies credentials without sending an email", async () => {
  await verifyGmailSmtp();
  expect(mocks.verify).toHaveBeenCalledOnce();
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.close).toHaveBeenCalledOnce();
});
it("rejects missing or malformed configuration", () => {
  for (const password of ["", "normal-password", "1234567890123456"]) {
    vi.stubEnv("GMAIL_APP_PASSWORD", password);
    expect(gmailConfigured()).toBe(false);
  }
  vi.stubEnv("GMAIL_APP_PASSWORD", "abcdefghijklmnop");
  vi.stubEnv("GMAIL_SENDER", "sender@gmail.com\r\nBcc: other@gmail.com");
  expect(gmailConfigured()).toBe(false);
});
