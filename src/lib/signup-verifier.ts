/** Build-time DEV plus server runtime guard: neither request origin nor client flags can enable this. */
export function temporaryVerificationEnabled(
  developmentBuild: boolean,
  runtimeMode: string | undefined,
) {
  return developmentBuild && runtimeMode !== "production";
}
export function normalizeContact(channel: "email" | "phone", value: string) {
  const contact = value.trim();
  if (channel === "email") return contact.toLowerCase();
  const normalized = contact.replace(/[\s()-]/g, "");
  if (!/^(?:\+[1-9]\d{6,14}|[1-9]\d{10,14})$/.test(normalized))
    throw new Error("Use a phone number with country code, such as +20…");
  return normalized.startsWith("+") ? normalized : `+${normalized}`;
}

export function normalizeEgyptianMobile(value: string) {
  const contact = value.trim();
  if (!/^\+?[\d\s()-]+$/.test(contact)) {
    throw new Error("Enter a valid Egyptian mobile number.");
  }

  let compact = contact.replace(/[\s()-]/g, "");
  if (compact.startsWith("0020")) compact = `0${compact.slice(4)}`;
  else if (compact.startsWith("+20")) compact = `0${compact.slice(3)}`;
  else if (compact.startsWith("20")) compact = `0${compact.slice(2)}`;

  if (!/^01[0125]\d{8}$/.test(compact)) {
    throw new Error("Use an Egyptian mobile number starting with 010, 011, 012 or 015.");
  }
  return `+20${compact.slice(1)}`;
}

export function internalAuthEmail(userId: string) {
  return `user-${userId}@accounts.gyvora.invalid`;
}

export function phoneAuthEmail(value: string) {
  const normalized = normalizeEgyptianMobile(value);
  return `phone-${normalized.replace(/\D/g, "")}@accounts.gyvora.invalid`;
}

export function verifyTemporaryCode(code: string, enabled: boolean) {
  if (!enabled)
    throw new Error(
      "Code delivery and verification are not configured. Account creation is unavailable until a verification provider is connected.",
    );
  if (!code.trim()) throw new Error("Enter the verification code.");
}
export function matchesAccountType(
  selected: "gym" | "individual" | "dashboard",
  type: string,
  admin: boolean,
) {
  return selected === "dashboard"
    ? admin
    : !admin && type === (selected === "gym" ? "owner" : "client");
}
