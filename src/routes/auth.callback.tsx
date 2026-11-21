import { redirectPasswordRecovery } from "@/lib/auth/recovery-routing";
import { capturePasswordRecovery } from "@/lib/auth/recovery";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { auth } from "@/lib/auth/client";
import { isAuthConfigured, authUnavailableMessage } from "@/lib/auth-config";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  beforeLoad: ({ location }) => redirectPasswordRecovery(location.pathname),
  head: () => ({ meta: [{ title: "Confirmar acesso — StudyMind AI" }] }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function confirm() {
      if (!isAuthConfigured()) throw new Error(authUnavailableMessage);
      const recovery = capturePasswordRecovery();
      const query = new URLSearchParams(window.location.search);
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      if (query.has("error") || fragment.has("error"))
        throw new Error("O link expirou ou foi recusado. Solicite um novo link e tente novamente.");
      // supabase-js finishes parsing the implicit-flow token before getSession resolves.
      const { data, error } = await auth.getSession();
      if (error) throw error;
      if (!data.session)
        throw new Error(
          "Não foi possível confirmar o acesso. Abra o link completo do e-mail ou entre na sua conta.",
        );
      if (recovery) {
        if (active) await navigate({ to: "/reset-password", replace: true });
        return;
      }
      window.history.replaceState(null, "", "/auth/callback");
      if (active)
        await navigate({ to: "/app/$section", params: { section: "painel" }, replace: true });
    }
    void confirm().catch((err: Error) => {
      if (active) setError(err.message);
    });
    return () => {
      active = false;
    };
  }, [navigate]);
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="glass-panel max-w-md rounded-2xl border p-6">
        <h1 className="text-2xl font-semibold">Confirmar acesso</h1>
        {error ? (
          <>
            <p role="alert" className="my-4">
              {error}
            </p>
            <Link to="/login" className="underline">
              Voltar ao login
            </Link>
          </>
        ) : (
          <p role="status" className="mt-4">
            Confirmando sua sessão…
          </p>
        )}
      </div>
    </main>
  );
}
