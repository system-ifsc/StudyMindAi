import { supabase } from "@/integrations/supabase/client";
import { backendMode } from "@/lib/auth-config";
import { localRequest } from "@/lib/local/client";
import type {
  AuthChangeEvent,
  Session,
  User,
  SignUpWithPasswordCredentials,
  SignInWithPasswordCredentials,
} from "@supabase/supabase-js";

type EventCallback = (event: AuthChangeEvent, session: Session | null) => void;
const listeners = new Set<EventCallback>();
let broadcast: BroadcastChannel | undefined;
function emit(event: AuthChangeEvent, session: Session | null) {
  for (const listener of listeners) listener(event, session);
}
function changed(event: AuthChangeEvent, session: Session | null) {
  emit(event, session);
  broadcast?.postMessage(event);
}
async function result<T>(fn: () => Promise<T>, fallback: T) {
  try {
    return { data: await fn(), error: null };
  } catch (error) {
    return { data: fallback, error: error as Error };
  }
}
const localAuth = {
  async getSession() {
    return result(async () => localRequest<{ session: Session | null }>({ op: "auth:session" }), {
      session: null,
    });
  },
  async getUser() {
    const r = await this.getSession();
    return { data: { user: r.data.session?.user ?? null }, error: r.error };
  },
  async signUp(input: SignUpWithPasswordCredentials) {
    return result(
      async () => {
        if (!("email" in input)) throw new Error("Use um e-mail para criar sua conta.");
        const data = await localRequest<{ user: User; session: Session; recovery_code: string }>({
          op: "auth:signup",
          email: input.email,
          password: input.password,
          name: (input.options?.data as Record<string, unknown> | undefined)?.["name"],
        });
        changed("SIGNED_IN", data.session);
        return data;
      },
      { user: null, session: null, recovery_code: "" } as {
        user: User | null;
        session: Session | null;
        recovery_code?: string;
      },
    );
  },
  async signInWithPassword(input: SignInWithPasswordCredentials) {
    return result(
      async () => {
        if (!("email" in input)) throw new Error("Use um e-mail para entrar.");
        const data = await localRequest<{ user: User; session: Session }>({
          op: "auth:login",
          email: input.email,
          password: input.password,
        });
        changed("SIGNED_IN", data.session);
        return data;
      },
      { user: null, session: null } as { user: User | null; session: Session | null },
    );
  },
  async signOut() {
    try {
      await localRequest({ op: "auth:logout" });
      changed("SIGNED_OUT", null);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },
  onAuthStateChange(callback: EventCallback) {
    listeners.add(callback);
    if (!broadcast && typeof BroadcastChannel !== "undefined") {
      broadcast = new BroadcastChannel("studymind-auth");
      broadcast.onmessage = async (event: MessageEvent<AuthChangeEvent>) => {
        const r = await localAuth.getSession();
        emit(event.data, r.data.session);
      };
    }
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            listeners.delete(callback);
          },
        },
      },
    };
  },
};
// Existing UI uses the same small auth interface in either backend.
const localMethods = {
  ...localAuth,
  async signInWithOAuth(_input: unknown) {
    return { error: new Error("Google não está disponível no modo local. Use e-mail e senha.") };
  },
  async resetPasswordForEmail(_email: string, _options?: unknown) {
    return { error: new Error("Use seu código de recuperação no modo local.") };
  },
  async resend(_input: unknown) {
    return { error: new Error("Contas locais não exigem confirmação por e-mail.") };
  },
  async updateUser(_input: unknown) {
    return { error: new Error("Use a recuperação por código para alterar a senha.") };
  },
};
export const auth = new Proxy({} as typeof localMethods | typeof supabase.auth, {
  get(_, key) {
    const target = backendMode() === "local" ? localMethods : supabase.auth;
    const value = Reflect.get(target, key);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
export async function recoverLocalPassword(email: string, code: string, password: string) {
  const data = await localRequest<{ recovery_code: string }>({
    op: "auth:recover",
    email,
    code,
    password,
  });
  changed("SIGNED_OUT", null);
  return data;
}
