import { createClient } from "@supabase/supabase-js";

export function usageConfigured() {
  return Boolean(
    process.env["SUPABASE_SERVICE_ROLE_KEY"] &&
    process.env["AI_DAILY_REQUEST_LIMIT"] &&
    process.env["AI_MONTHLY_REQUEST_LIMIT"],
  );
}
/** Uma unidade representa uma chamada ao gateway, compartilhada entre chat, geração e correção. */
export async function reserveUsage(userId: string) {
  const url = process.env["SUPABASE_URL"],
    key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const daily = Number(process.env["AI_DAILY_REQUEST_LIMIT"]),
    monthly = Number(process.env["AI_MONTHLY_REQUEST_LIMIT"]);
  if (
    !url ||
    !key ||
    !Number.isSafeInteger(daily) ||
    daily < 1 ||
    !Number.isSafeInteger(monthly) ||
    monthly < daily
  )
    throw new Error("USAGE_UNCONFIGURED");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Limites de novas contas são provisionados no servidor; nunca aceitos do cliente.
  const limits = await client
    .from("ai_usage_limits")
    .upsert(
      { user_id: userId, daily_units: daily, monthly_units: monthly, enabled: true },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (limits.error) throw new Error("USAGE_UNAVAILABLE");
  const requestId = crypto.randomUUID();
  const result = await client.rpc("reserve_ai_usage", {
    p_user_id: userId,
    p_request_id: requestId,
    p_units: 1,
  });
  if (result.error)
    throw new Error(result.error.code === "P0001" ? "USAGE_LIMIT" : "USAGE_UNAVAILABLE");
  return async () => {
    // Uma chamada despachada pode gerar custo mesmo se o conteúdo for inválido ou a conexão cair.
    const finalized = await client.rpc("finalize_ai_usage", {
      p_user_id: userId,
      p_request_id: requestId,
      p_commit: true,
    });
    if (finalized.error) console.error("ai usage finalization failed", finalized.error.code);
  };
}
