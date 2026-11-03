import { describe, expect, it } from "vitest";
import { authBackendForRuntime } from "@/lib/auth-backend";

describe("application authentication backend selection", () => {
  it("uses the prototype API only in development and supported previews", () => {
    expect(authBackendForRuntime(true)).toBe("sqlite");
  });

  it("keeps published application authentication on Supabase", () => {
    expect(authBackendForRuntime(false)).toBe("supabase");
  });
});
