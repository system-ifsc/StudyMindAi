import { redirect } from "@tanstack/react-router";
import { backendMode, isAuthConfigured } from "@/lib/auth-config";
import { auth } from "@/lib/auth/client";
import { capturePasswordRecovery } from "@/lib/auth/recovery";

/** Aguarda o consumo do token antes de trocar de rota e remover o fragmento. */
export async function redirectPasswordRecovery(targetPath?: string) {
  if (typeof window === "undefined" || backendMode() !== "supabase" || !isAuthConfigured()) return;
  if (!capturePasswordRecovery() || (targetPath ?? window.location.pathname) === "/reset-password")
    return;
  await auth.getSession();
  throw redirect({ to: "/reset-password", replace: true });
}
