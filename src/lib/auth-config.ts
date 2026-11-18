// Only public build-time configuration belongs in this module.
export function isAuthConfigured(): boolean {
  return Boolean(
    import.meta.env["VITE_SUPABASE_URL"] && import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
  );
}

export const authUnavailableMessage =
  "Login e cadastro temporariamente indisponíveis. Você ainda pode explorar a demonstração.";
