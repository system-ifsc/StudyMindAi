import { z } from "zod";
import nodemailer from "nodemailer";
import { FEEDBACK_EMAIL, type FeedbackInput } from "./core/feedback";

function gmailSmtpConfig() {
  const sender = process.env["GMAIL_SENDER"]?.trim();
  const password = process.env["GMAIL_APP_PASSWORD"]?.replace(/\s/g, "");
  if (!sender || !z.email().safeParse(sender).success || /[\r\n]/.test(sender)) return null;
  if (!password || !/^[a-zA-Z]{16}$/.test(password)) return null;
  return { sender, password };
}

function smtpTransport(config: { sender: string; password: string }) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: config.sender, pass: config.password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

/** Checks SMTP authentication without sending any email. */
export async function verifyGmailSmtp() {
  const config = gmailSmtpConfig();
  if (!config) throw new Error("Configure o remetente e uma senha de app de 16 letras.");
  const transport = smtpTransport(config);
  try {
    await transport.verify();
  } finally {
    transport.close();
  }
}

function gmailConfig() {
  const clientId = process.env["GMAIL_CLIENT_ID"]?.trim();
  const clientSecret = process.env["GMAIL_CLIENT_SECRET"]?.trim();
  const refreshToken = process.env["GMAIL_REFRESH_TOKEN"]?.trim();
  const sender = process.env["GMAIL_SENDER"]?.trim();
  if (
    !clientId ||
    !clientSecret ||
    !refreshToken ||
    !sender ||
    !z.email().safeParse(sender).success ||
    /[\r\n]/.test(sender)
  )
    return null;
  return { clientId, clientSecret, refreshToken, sender };
}

export function gmailConfigured() {
  return Boolean(gmailSmtpConfig() || gmailConfig());
}

export async function sendFeedbackEmail(
  feedback: FeedbackInput,
  user: { id: string; email?: string },
) {
  const { name, email, category, message } = feedback;
  const text = `Nome: ${name}\nGmail para contato: ${email}\nTipo: ${category}\nConta autenticada: ${user.id}\n\n${message}`;
  const smtp = gmailSmtpConfig();
  if (smtp) {
    const transport = smtpTransport(smtp);
    try {
      const result = await transport.sendMail({
        from: { name: "StudyMind", address: smtp.sender },
        to: FEEDBACK_EMAIL,
        replyTo: email,
        subject: `[StudyMind] ${category}`,
        text,
      });
      if (!result.accepted.some((address) => String(address).toLowerCase() === FEEDBACK_EMAIL))
        throw new Error("Gmail rejected message");
      return;
    } finally {
      transport.close();
    }
  }
  const config = gmailConfig();
  if (!config) throw new Error("Gmail not configured");
  // Refresh on the server: no Google credentials or tokens reach the browser.
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenResponse.ok) throw new Error("Gmail authorization failed");
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("Missing Gmail access token");
  const subject = Buffer.from(`[StudyMind] ${category}`, "utf8").toString("base64");
  const body =
    Buffer.from(text, "utf8")
      .toString("base64")
      .match(/.{1,76}/g)
      ?.join("\r\n") ?? "";
  const replyTo = email;
  const mime = [
    `From: StudyMind <${config.sender}>`,
    `To: ${FEEDBACK_EMAIL}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: =?UTF-8?B?${subject}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ].join("\r\n");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: Buffer.from(mime, "utf8").toString("base64url") }),
  });
  if (!response.ok) throw new Error("Gmail rejected message");
  const result = (await response.json()) as { id?: string };
  if (!result.id) throw new Error("Missing Gmail confirmation");
}
