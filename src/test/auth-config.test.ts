import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthConfigured } from "@/lib/auth-config";

afterEach(() => vi.unstubAllEnvs());

describe("public authentication configuration", () => {
  it("keeps authentication disabled when deployment variables are missing", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    expect(isAuthConfigured()).toBe(false);
  });

  it("requires both public settings", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    expect(isAuthConfigured()).toBe(false);
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
    expect(isAuthConfigured()).toBe(true);
    vi.stubEnv("VITE_SUPABASE_URL", "");
    expect(isAuthConfigured()).toBe(false);
  });
});
