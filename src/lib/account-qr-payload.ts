import { isGyvoraId, normalizeAccountLookup } from "./gyvora-id";

const prefix = "GYVORA:PROFILE:";

export type AccountQrProfile = {
  type: "gym" | "individual";
  gyvora_id: string;
  full_name: string;
  email: string;
  phone: string;
};

const profileSchema = (value: unknown): AccountQrProfile | null => {
  if (!value || typeof value !== "object") return null;
  const profile = value as Record<string, unknown>;
  const type = profile["type"];
  const gyvoraId = profile["gyvora_id"];
  const fullName = profile["full_name"];
  const email = profile["email"];
  const phone = profile["phone"];
  if (
    (type !== "gym" && type !== "individual") ||
    typeof gyvoraId !== "string" ||
    !isGyvoraId(gyvoraId) ||
    typeof fullName !== "string" ||
    typeof email !== "string" ||
    typeof phone !== "string"
  ) return null;

  const expectedPrefix = type === "gym" ? "GYVORA-G-" : "GYVORA-C-";
  if (!gyvoraId.startsWith(expectedPrefix)) return null;
  return {
    type,
    gyvora_id: gyvoraId,
    full_name: fullName.slice(0, 100),
    email: email.slice(0, 255),
    phone: phone.slice(0, 30),
  };
};

export function createAccountQrPayload(profile: AccountQrProfile) {
  const validated = profileSchema(profile);
  if (!validated) throw new Error("Cannot create a QR for an invalid GYVORA profile.");
  const bytes = new TextEncoder().encode(JSON.stringify(validated));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  return `${prefix}${encoded}`;
}

export function parseAccountQrPayload(value: string): AccountQrProfile | null {
  const input = value.trim();
  if (!input.startsWith(prefix)) return null;
  try {
    const encoded = input.slice(prefix.length).replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(encoded + "=".repeat((4 - encoded.length % 4) % 4));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return profileSchema(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

export function accountQrLookupId(value: string) {
  return parseAccountQrPayload(value)?.gyvora_id ?? normalizeAccountLookup(value);
}
