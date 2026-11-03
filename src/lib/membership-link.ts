import type { Member } from './store';

export function isClientPortalPath(path: string) {
  return path === '/member' || path.startsWith('/member/');
}

export function assertUniqueClientMembership(rows: Member[], clientId: string | undefined, recordId?: string) {
  if (clientId && rows.some(row => row.clientId === clientId && row.id !== recordId)) {
    throw new Error('This client already has a membership at this gym. Edit their existing membership instead.');
  }
}

// Validate creation/relinking only. Legacy duplicates must not block edits,
// renewals or deletion of an existing record (including unrelated records).
export function validateMembershipChanges(previous: Member[], next: Member[]) {
  for (const row of next) {
    const existing = previous.find(old => old.id === row.id);
    if (!existing || existing.clientId !== row.clientId) {
      assertUniqueClientMembership(next, row.clientId, row.id);
    }
  }
}

export function membershipDaysRemaining(expiry: string, today: string): number {
  const end = Date.parse(`${expiry}T00:00:00Z`);
  const current = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(end) || !Number.isFinite(current)) return 0;
  return Math.max(0, Math.floor((end - current) / 86400000));
}

export function membershipSessionsUsed(m: Pick<Member, 'type' | 'sessionsTotal' | 'sessionsLeft'>): number {
  if (m.type !== 'Limited') return 0;
  const total = Math.max(0, m.sessionsTotal);
  return Math.min(total, Math.max(0, total - m.sessionsLeft));
}

export function membershipStatus(m: Pick<Member, 'start' | 'expiry'> & Partial<Pick<Member, 'type' | 'sessionsLeft'>>, today: string): Member['status'] | 'Upcoming' {
  if (m.start > today) return 'Upcoming';
  if (m.expiry <= today) return 'Expired';
  if (m.type === 'Limited' && (m.sessionsLeft ?? 0) <= 0) return 'Expired';
  const days = membershipDaysRemaining(m.expiry, today);
  return days <= 14 ? 'Expiring' : 'Active';
}