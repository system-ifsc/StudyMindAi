import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRepo } from "./use-data";

/** O modo demo nunca chama a API autenticada. */
export function useStudyAI() {
  const repo = useRepo();
  const [status, setStatus] = useState<"checking" | "ready" | "off">("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    if (repo.mode === "demo") {
      setStatus("off");
      return;
    }
    fetch("/api/assistant")
      .then((r) => r.json())
      .then((j: { configured?: boolean }) => {
        if (active) setStatus(j.configured ? "ready" : "off");
      })
      .catch(() => {
        if (active) setStatus("off");
      });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, [repo.mode]);
  async function request(body: unknown): Promise<unknown> {
    if (repo.mode === "demo" || status !== "ready")
      throw new Error("IA indisponível neste ambiente.");
    if (controller.current) throw new Error("Aguarde a solicitação em andamento.");
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    try {
      const { data, error: authError } = await supabase.auth.getSession();
      if (authError || !data.session) throw new Error("Entre novamente na sua conta.");
      const response = await fetch("/api/assistant", {
        method: "POST",
        signal: abort.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível processar o pedido.");
      return payload;
    } catch (e) {
      const message =
        (e as Error).name === "AbortError"
          ? "Solicitação cancelada. Nada foi gerado."
          : (e as Error).message;
      setError(message);
      throw new Error(message);
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }
  return {
    status,
    busy,
    error,
    request,
    cancel: () => controller.current?.abort(),
    demo: repo.mode === "demo",
  };
}
