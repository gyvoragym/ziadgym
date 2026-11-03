import { describe, expect, it } from 'vitest';
import { matchesLoginType } from '@/lib/saved-login';

describe('persisted account-type login', () => {
  it('Dashboard requires an authorized administrator', () => {
    expect(matchesLoginType('dashboard', 'owner', false)).toBe(false);
    expect(matchesLoginType('dashboard', 'owner', true)).toBe(true);
  });
  it('Gym Account accepts owners but rejects clients', () => {
    expect(matchesLoginType('gym', 'owner', false)).toBe(true);
    expect(matchesLoginType('gym', 'client', false)).toBe(false);
  });
  it('Client accepts client accounts but rejects owners', () => {
    expect(matchesLoginType('individual', 'client', false)).toBe(true);
    expect(matchesLoginType('individual', 'owner', false)).toBe(false);
  });
});