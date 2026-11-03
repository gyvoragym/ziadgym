const tokenLifetimeSeconds = 12 * 60 * 60;

function signingSecret() {
  const secret = process.env["GYVORA_ADMIN_SESSION_SECRET"] || process.env["GYVORA_ADMIN_PASSWORD"];
  if (!secret) throw new Error("Admin session signing is not configured.");
  return secret;
}

async function signature(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(signed)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export async function createAdminSessionToken(now = Date.now()) {
  const expiresAt = Math.floor(now / 1000) + tokenLifetimeSeconds;
  const payload = `gyvora-admin:${expiresAt}`;
  return `${expiresAt}.${await signature(payload)}`;
}

export async function isValidAdminSessionToken(token: string, now = Date.now()) {
  const [expires, providedSignature, extra] = token.split(".");
  if (!expires || !providedSignature || extra || !/^\d+$/.test(expires)) return false;
  const expiresAt = Number(expires);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) return false;
  const expected = await signature(`gyvora-admin:${expiresAt}`);
  return expected === providedSignature;
}
