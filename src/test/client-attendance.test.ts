import { describe, expect, it } from 'vitest';
import { getState } from '@/lib/store';
import { recordMemberCheckIn } from '@/lib/client-attendance';

describe('limited membership attendance', () => {
  const member = {
    ...getState().members[0]!,
    id: 'limited-member',
    type: 'Limited' as const,
    start: '2026-01-01',
    expiry: '2026-12-31',
    sessionsTotal: 20,
    sessionsLeft: 3,
  };
  const today = '2026-10-27';
  const now = new Date(2026, 9, 27, 14, 3);

  it('records a visit and consumes exactly one session', () => {
    const result = recordMemberCheckIn([], [member], member.id, 'QR', today, now);
    expect(result.members[0]?.sessionsLeft).toBe(2);
    expect(result.attendance[0]).toMatchObject({ memberId: member.id, method: 'QR', date: today, time: '14:03' });
  });

  it('marks a fully used limited membership expired and prevents attendance', () => {
    const spent = { ...member, sessionsLeft: 0 };
    expect(() => recordMemberCheckIn([], [spent], spent.id, 'Manual', today, now)).toThrow('Membership has expired');
  });

  it('rejects attendance at midnight on the exclusive expiry date', () => {
    const expiresToday = { ...member, start: '2026-10-01', expiry: today, sessionsLeft: 3 };
    expect(() => recordMemberCheckIn([], [expiresToday], expiresToday.id, 'QR', today, now)).toThrow('Membership has expired');
  });

  it('does not consume another session when the client checks in twice on one day', () => {
    const first = recordMemberCheckIn([], [member], member.id, 'Manual', today, now);
    expect(() => recordMemberCheckIn(first.attendance, first.members, member.id, 'Manual', today, now)).toThrow('Already checked in today');
    expect(first.members[0]?.sessionsLeft).toBe(2);
  });
});
