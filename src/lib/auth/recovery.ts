import { isPasswordRecoveryLink } from "@/lib/core/password-recovery";

let pending = false;

// Capture antes de supabase-js consumir e remover o fragmento da URL.
export function capturePasswordRecovery() {
  if (typeof window !== "undefined")
    pending ||= isPasswordRecoveryLink(window.location.search, window.location.hash);
  return pending;
}

export function finishPasswordRecovery() {
  pending = false;
}
