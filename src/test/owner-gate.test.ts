import { describe, expect, it } from 'vitest';
import { trialActive, trialExpired, trialRemainingMs, formatRemaining, TRIAL_MS, type OwnerGate } from '@/lib/trial';

const base: OwnerGate = {
  gymId: null,
  frozen: false,
  freezeNote: '',
  requestStatus: 'Pending',
  plan: 'Monthly Plan',
  gymName: 'Test Gym',
  trialStartedAt: null,
  trialEndsAt: null,
  now: '2026-10-23T12:00:00.000Z',
};

const started: OwnerGate = {
  ...base,
  trialStartedAt: '2026-10-23T12:00:00.000Z',
  trialEndsAt: '2026-10-23T13:00:00.000Z',
};

describe('one-hour pending-approval trial', () => {
  it('lasts exactly one hour from the server-recorded start', () => {
    expect(new Date(started.trialEndsAt!).getTime() - new Date(started.trialStartedAt!).getTime()).toBe(TRIAL_MS);
  });
  it('is active while time remains and reports the remaining milliseconds', () => {
    expect(trialActive(started)).toBe(true);
    expect(trialExpired(started)).toBe(false);
    expect(trialRemainingMs(started)).toBe(TRIAL_MS);
  });
  it('counts down against the server clock so refresh cannot restart it', () => {
    const later = { ...started, now: '2026-10-23T12:30:00.000Z' };
    expect(trialRemainingMs(later)).toBe(TRIAL_MS / 2);
    expect(trialActive(later)).toBe(true);
  });
  it('expires after the hour and blocks access', () => {
    const after = { ...started, now: '2026-10-23T13:00:01.000Z' };
    expect(trialRemainingMs(after)).toBe(0);
    expect(trialActive(after)).toBe(false);
    expect(trialExpired(after)).toBe(true);
  });
  it('never starts without a server-recorded start time', () => {
    expect(trialActive(base)).toBe(false);
    expect(trialExpired(base)).toBe(false);
  });
  it('does not apply to approved or rejected requests', () => {
    expect(trialActive({ ...started, requestStatus: 'Approved' })).toBe(false);
    expect(trialExpired({ ...started, requestStatus: 'Rejected' })).toBe(false);
  });
  it('formats the remaining time as m:ss', () => {
    expect(formatRemaining(TRIAL_MS)).toBe('60:00');
    expect(formatRemaining(59_000)).toBe('0:59');
    expect(formatRemaining(0)).toBe('0:00');
  });
});
