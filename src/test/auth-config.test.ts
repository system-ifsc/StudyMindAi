import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthConfigured, backendMode } from "@/lib/auth-config";

afterEach(() => vi.unstubAllEnvs());

describe("public authentication configuration", () => {
  it("keeps authentication disabled when deployment variables are missing", () => {
    vi.stubEnv("VITE_BACKEND", "supabase");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    expect(isAuthConfigured()).toBe(false);
  });

  it("requires both public settings", () => {
    vi.stubEnv("VITE_BACKEND", "supabase");
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    expect(isAuthConfigured()).toBe(false);
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
    expect(isAuthConfigured()).toBe(true);
    vi.stubEnv("VITE_SUPABASE_URL", "");
    expect(isAuthConfigured()).toBe(false);
  });
});

it("ativa o backend local automaticamente sem Supabase", () => {
  vi.stubEnv("VITE_BACKEND", "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
  expect(backendMode()).toBe("local");
  expect(isAuthConfigured()).toBe(true);
});
