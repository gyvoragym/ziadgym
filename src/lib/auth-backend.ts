export type AuthBackend = "sqlite" | "supabase";

export function authBackendForRuntime(isPrototypePreview: boolean): AuthBackend {
  return isPrototypePreview ? "sqlite" : "supabase";
}
