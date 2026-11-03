import { describe, expect, it, vi } from 'vitest';
import { currentSessionToken, signInRequired } from '@/lib/session-token';

const now = 1_000_000;
const result = (access_token: string, expires_at: number) => ({ data: { session: { access_token, expires_at } }, error: null });
describe('private QR lookup session', () => {
  it('uses the currently signed-in owner token', async () => {
    const auth = { getSession: vi.fn().mockResolvedValue(result('owner-token', 2000)), refreshSession: vi.fn() };
    expect(await currentSessionToken(auth, true, now)).toBe('owner-token');
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });
  it('refreshes an expired token before sending the lookup', async () => {
    const auth = { getSession: vi.fn().mockResolvedValue(result('expired-token', 999)), refreshSession: vi.fn().mockResolvedValue(result('refreshed-owner-token', 2000)) };
    expect(await currentSessionToken(auth, true, now)).toBe('refreshed-owner-token');
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });
  it('refreshes tokens expiring within one minute', async () => {
    const auth = { getSession: vi.fn().mockResolvedValue(result('near-expiry-token', 1059)), refreshSession: vi.fn().mockResolvedValue(result('new-token', 2000)) };
    expect(await currentSessionToken(auth, true, now)).toBe('new-token');
  });
  it('blocks private lookup without a signed-in session', async () => {
    const auth = { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }), refreshSession: vi.fn() };
    await expect(currentSessionToken(auth, true, now)).rejects.toThrow(signInRequired);
    expect(auth.refreshSession).not.toHaveBeenCalled();
    expect(await currentSessionToken(auth, false, now)).toBeUndefined();
  });
  it('never sends the expired token when refresh fails', async () => {
    const auth = { getSession: vi.fn().mockResolvedValue(result('expired-token', 999)), refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: new Error('Refresh failed') }) };
    await expect(currentSessionToken(auth, true, now)).rejects.toThrow(signInRequired);
  });
});