import { useEffect } from "react";
import { auth } from "@/lib/auth/client";

let lastReport = 0;
export async function reportClientError() {
  if (Date.now() - lastReport < 10000 || location.pathname.startsWith("/demo")) return;
  lastReport = Date.now();
  try {
    const { data } = await auth.getSession();
    if (data.session)
      await fetch("/api/monitoring", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        keepalive: true,
      });
  } catch {
    /* A coleta nunca impede o uso da aplicação. */
  }
}
export function useMonitoring() {
  useEffect(() => {
    const handler = () => {
      void reportClientError();
    };
    window.addEventListener("error", handler);
    window.addEventListener("unhandledrejection", handler);
    return () => {
      window.removeEventListener("error", handler);
      window.removeEventListener("unhandledrejection", handler);
    };
  }, []);
}
