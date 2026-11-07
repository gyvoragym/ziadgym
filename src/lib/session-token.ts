type Session = { access_token: string; expires_at?: number };
type SessionResult = { data: { session: Session | null }; error: unknown };
type SessionAuth = {
  getSession: () => Promise<SessionResult>;
  refreshSession: () => Promise<SessionResult>;
};

export const signInRequired = 'Your sign-in session has ended. Sign in with your gym owner account, then scan again.';

/** Use the provider's current session, never demo identity or a cached token. */
export async function currentSessionToken(auth: SessionAuth, required = false, now = Date.now()): Promise<string | undefined> {
  const result = await auth.getSession();
  if (result.error) throw new Error(signInRequired);
  let session = result.data.session;
  if (session && (session.expires_at ?? 0) * 1000 <= now + 60_000) {
    const refreshed = await auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) throw new Error(signInRequired);
    session = refreshed.data.session;
    if ((session.expires_at ?? 0) * 1000 <= now) throw new Error(signInRequired);
  }
  const token = session?.access_token;
  if (required && !token) throw new Error(signInRequired);
  return token || undefined;
}