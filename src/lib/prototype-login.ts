import { setDemoSession, sessionKindFor, getDemoAccounts, demoDestination, registerDemoAccount, type DemoAccountType } from "@/lib/demo";

export type PrototypeLoginDetails = { destination: DemoAccountType; name: string; email: string };
const PREFERENCE_KEY = "ironhaus-prototype-login-preference";

export function prototypeDestination(destination: DemoAccountType): "/dashboard" | "/member" | "/super-admin" {
  return destination === "gym" ? "/dashboard" : destination === "individual" ? "/member" : "/super-admin";
}

/** Display preferences only; never persist passwords or create accounts. */
export function savePrototypePreference(details: PrototypeLoginDetails, remember: boolean) {
  try {
    if (remember) localStorage.setItem(PREFERENCE_KEY, JSON.stringify(details));
    else localStorage.removeItem(PREFERENCE_KEY);
  } catch { /* Storage may be unavailable. */ }
}

export function getPrototypePreference(): PrototypeLoginDetails | null {
  try {
    const raw = localStorage.getItem(PREFERENCE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!["gym", "individual", "dashboard"].includes(value?.destination) || typeof value.name !== "string" || typeof value.email !== "string") return null;
    return { destination: value.destination, name: value.name, email: value.email };
  } catch { return null; }
}

/** Stable key for a Gym Account entered from Login; blank details share one demo key. */
export function gymAccountKey(details: Pick<PrototypeLoginDetails, "name" | "email">) {
  const email = details.email.trim().toLowerCase();
  if (email) return email;
  const name = details.name.trim().toLowerCase().replace(/\s+/g, "-");
  return `gym:${name || "demo"}`;
}

/** Client and Super Admin go straight to their destinations; Gym Accounts follow their subscription request status. */
export function enterPrototype(details: PrototypeLoginDetails, remember: boolean) {
  savePrototypePreference(details, remember);
  if (details.destination === "gym") {
    const key = gymAccountKey(details);
    const existing = getDemoAccounts().find((a) => a.email === key);
    // No password is stored: prototype Gym Accounts are display details only.
    const acc = existing ?? registerDemoAccount(details.name.trim() || "Gym owner", key, "", "gym");
    if(acc.deletedAt){setDemoSession(null);throw new Error('This gym account has been deleted by the administrator.');}
    setDemoSession("owner", acc.email, { name: details.name.trim() || acc.name });
    return demoDestination(acc);
  }
  setDemoSession(sessionKindFor(details.destination), details.email, { name: details.name, directAccess: true });
  return prototypeDestination(details.destination);
}