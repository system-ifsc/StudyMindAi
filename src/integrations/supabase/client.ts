import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { isCloudConfigured } from "@/lib/auth-config";

function createSupabaseClient() {
  if (!isCloudConfigured())
    throw new Error("Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY para conectar seu Supabase.");
  return createClient<Database>(
    import.meta.env["VITE_SUPABASE_URL"],
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
    {
      auth: {
        persistSession: typeof window !== "undefined",
        autoRefreshToken: typeof window !== "undefined",
        detectSessionInUrl: typeof window !== "undefined",
        flowType: "implicit",
      },
    },
  );
}

let client: ReturnType<typeof createSupabaseClient> | undefined;
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop) {
    client ??= createSupabaseClient();
    return Reflect.get(client, prop);
  },
});
