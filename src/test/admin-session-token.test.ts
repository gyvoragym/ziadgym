import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdminSessionToken, isValidAdminSessionToken } from "@/lib/admin-session-token";

describe("signed prototype administrator sessions", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts a valid token until its expiry", async () => {
    vi.stubEnv("GYVORA_ADMIN_SESSION_SECRET", "test-only-secret");
    const token = await createAdminSessionToken(1_000_000);
    expect(await isValidAdminSessionToken(token, 1_000_001)).toBe(true);
    expect(await isValidAdminSessionToken(token, 1_000_000 + 12 * 60 * 60 * 1000)).toBe(false);
  });

  it("rejects altered tokens and tokens with invalid structure", async () => {
    vi.stubEnv("GYVORA_ADMIN_SESSION_SECRET", "test-only-secret");
    const token = await createAdminSessionToken(1_000_000);
    const [expires, signature] = token.split(".");
    expect(await isValidAdminSessionToken(`${expires}.${signature}x`, 1_000_001)).toBe(false);
    expect(await isValidAdminSessionToken("not-a-token", 1_000_001)).toBe(false);
  });
});
