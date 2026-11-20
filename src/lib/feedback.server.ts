import { createFeedbackRepo } from "./repo/feedback.server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { backendMode } from "./auth-config";
import { verifyLocalBearer } from "./local/auth.server";
import { feedbackSchema } from "./core/feedback";
import { gmailConfigured, sendFeedbackEmail } from "./gmail.server";

const attempts = new Map<string, number[]>();
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", Vary: "Authorization" },
  });
export function feedbackStatus() {
  return json({
    configured: true,
    emailConfigured: gmailConfigured(),
  });
}
export async function handleFeedback(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return json({ error: "Entre na sua conta para enviar feedback." }, 401);
  let cloud: SupabaseClient | undefined;
  let user: { id: string; email?: string } | null = null;
  try {
    if (backendMode() === "local") user = verifyLocalBearer(token)?.user ?? null;
    else {
      const url = process.env["SUPABASE_URL"],
        key = process.env["SUPABASE_PUBLISHABLE_KEY"];
      if (url && key) {
        const client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        user = (await client.auth.getUser(token)).data.user;
        cloud = client;
      }
    }
  } catch {
    return json({ error: "Não foi possível validar sua sessão." }, 502);
  }
  if (!user) return json({ error: "Sessão expirada. Entre novamente." }, 401);
  const now = Date.now();
  for (const [id, times] of attempts)
    if (!times.some((t) => now - t < 3600000)) attempts.delete(id);
  const recent = (attempts.get(user.id) ?? []).filter((t) => now - t < 3600000);
  if (recent.length >= 5)
    return json({ error: "Limite de 5 envios por hora atingido. Tente mais tarde." }, 429);
  recent.push(now);
  attempts.set(user.id, recent);
  let raw: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Mensagem vazia." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 24000) {
          await reader.cancel();
          return json({ error: "Mensagem muito grande." }, 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return json({ error: "Mensagem inválida." }, 400);
  }
  const parsed = feedbackSchema.safeParse(raw);
  if (!parsed.success)
    return json(
      { error: "Informe nome, Gmail válido, tipo e mensagem de 10 a 5000 caracteres." },
      400,
    );
  let id: string;
  try {
    id = await createFeedbackRepo(user.id, cloud).record(parsed.data);
  } catch {
    return json(
      { error: "Não foi possível registrar. Seu texto foi mantido; tente novamente." },
      503,
    );
  }
  let emailSent = false;
  if (gmailConfigured()) {
    try {
      await sendFeedbackEmail(parsed.data, user);
      emailSent = true;
    } catch {
      // Registration is durable even when the optional email provider fails.
    }
  }
  return json({ saved: true, sent: emailSent, id });
}
