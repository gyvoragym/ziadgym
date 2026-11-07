import { describe, expect, it } from "vitest";
import { isSupabaseClientConfigured } from "@/lib/supabase-availability";

describe("Supabase client configuration", () => {
  it("requires both the project URL and publishable key", () => {
    expect(isSupabaseClientConfigured({})).toBe(false);
    expect(isSupabaseClientConfigured({ VITE_SUPABASE_URL: "https://example.supabase.co" })).toBe(
      false,
    );
    expect(isSupabaseClientConfigured({ VITE_SUPABASE_PUBLISHABLE_KEY: "public-key" })).toBe(false);
  });

  it("enables the client when both required values are present", () => {
    expect(
      isSupabaseClientConfigured({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "public-key",
      }),
    ).toBe(true);
  });
});
