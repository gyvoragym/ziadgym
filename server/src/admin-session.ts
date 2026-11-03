import { createHmac, timingSafeEqual } from "node:crypto";

export function isValidAdminSessionToken(token: string, secret: string, now = Date.now()) {
  const [expires, providedSignature, extra] = token.split(".");
  if (!expires || !providedSignature || extra || !/^\d+$/.test(expires)) return false;
  const expiresAt = Number(expires);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) return false;

  const expected = createHmac("sha256", secret)
    .update(`gyvora-admin:${expiresAt}`)
    .digest("base64url");
  const provided = Buffer.from(providedSignature);
  const expectedBytes = Buffer.from(expected);
  return provided.length === expectedBytes.length && timingSafeEqual(provided, expectedBytes);
}
