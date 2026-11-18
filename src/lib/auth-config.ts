// Only public build-time configuration belongs in this module.
export function isCloudConfigured(): boolean {
  const url = import.meta.env["VITE_SUPABASE_URL"]?.trim();
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim();
  if (!url || !key || key.startsWith("sb_secret_")) return false;
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

export const authUnavailableMessage =
  "Login e cadastro temporariamente indisponíveis. Você ainda pode explorar a demonstração.";

export function backendMode(): "local" | "supabase" {
  const selected = import.meta.env["VITE_BACKEND"];
  if (selected === "local") return "local";
  if (selected === "supabase") return "supabase";
  return import.meta.env["VITE_SUPABASE_URL"] || import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]
    ? "supabase"
    : "local";
}
export function isAuthConfigured(): boolean {
  return backendMode() === "local" || isCloudConfigured();
}
