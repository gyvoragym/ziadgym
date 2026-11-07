import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidAdminSessionToken } from "../../server/src/admin-session";
import { createAdminSessionToken } from "@/lib/admin-session-token";

function token(secret: string, issuedAt: number) {
  const expiresAt = Math.floor(issuedAt / 1000) + 12 * 60 * 60;
  const signature = createHmac("sha256", secret)
    .update(`gyvora-admin:${expiresAt}`)
    .digest("base64url");
  return `${expiresAt}.${signature}`;
}

describe("API administrator session verification", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts only unexpired tokens signed with the configured secret", () => {
    const secret = "test-only-admin-secret";
    const signed = token(secret, 1_000_000);
    expect(isValidAdminSessionToken(signed, secret, 1_000_001)).toBe(true);
    expect(isValidAdminSessionToken(signed, secret, 1_000_000 + 12 * 60 * 60 * 1000)).toBe(false);
    expect(isValidAdminSessionToken(signed, "different-secret", 1_000_001)).toBe(false);
    expect(isValidAdminSessionToken("malformed", secret, 1_000_001)).toBe(false);
  });

  it("verifies the administrator token produced by the web application", async () => {
    const secret = "test-only-admin-secret";
    vi.stubEnv("GYVORA_ADMIN_SESSION_SECRET", secret);
    const signed = await createAdminSessionToken(1_000_000);
    expect(isValidAdminSessionToken(signed, secret, 1_000_001)).toBe(true);
  });
});
