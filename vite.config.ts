import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  if (command === "build" && process.env["VERCEL"] === "1") {
    const selected = env["VITE_BACKEND"];
    const url = env["VITE_SUPABASE_URL"];
    const key = env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    const cloud = selected === "supabase" || (selected !== "local" && Boolean(url || key));
    if (!cloud)
      throw new Error(
        "SQLite local não pode persistir contas na Vercel. Configure VITE_BACKEND=supabase, VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no projeto Vercel e aplique as migrações. Consulte README.md (Publicar na Vercel).",
      );
    let validUrl = false;
    try {
      validUrl = Boolean(url) && ["https:", "http:"].includes(new URL(url!).protocol);
    } catch {
      // Invalid public configuration must stop the deployment before it reaches users.
    }
    if (!validUrl || !key?.trim() || key.startsWith("sb_secret_"))
      throw new Error(
        "Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY válidas na Vercel. Use apenas a chave pública do Supabase.",
      );
  }
  return {
    server: { host: "0.0.0.0", port: 8080 },
    resolve: { tsconfigPaths: true },
    plugins: [tailwindcss(), tanstackStart({ server: { entry: "server" } }), nitro(), react()],
  };
});
