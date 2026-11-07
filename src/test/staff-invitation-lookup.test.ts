import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDemoInvitation,
  pendingDemoInvitations,
  respondDemoInvitation,
  setDemoSession,
  demoUserId,
  getDemoState,
  readDemoGym,
} from '@/lib/demo';

describe('staff invitations resolved by client account ID', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setDemoSession(null);
  });

  it('delivers an email-less invitation to the resolved account and applies role and permissions on accept', () => {
    const userId = demoUserId('staff-target@test.com');
    const invite = createDemoInvitation('gym-1', 'Gym One', 'Target Person', '', 'Trainer', {
      userId,
      permissions: ['Members', 'Members:edit'],
    });
    expect(invite.email).toBe('');
    expect(invite.invited_user_id).toBe(userId);
    setDemoSession('individual', 'staff-target@test.com');
    expect(pendingDemoInvitations('staff-target@test.com').map((i) => i.id)).toContain(invite.id);
    respondDemoInvitation(invite.id, true);
    const role = getDemoState().staffRoles.find((r) => r.gymId === 'gym-1' && r.userId === userId);
    expect(role?.role).toBe('Trainer');
    expect(role?.permissions).toEqual(['Members', 'Members:edit']);
    expect(readDemoGym('gym-1').staff).toContainEqual(
      expect.objectContaining({
        id: invite.id,
        userId,
        role: 'Trainer',
        permissions: ['Members', 'Members:edit'],
      }),
    );
  });

  it('requires a resolved account and blocks duplicate pending invitations for it', () => {
    expect(() => createDemoInvitation('gym-2', 'Gym Two', 'Nobody', '', 'Admin')).toThrow(
      /Resolve an existing client account/,
    );
    const userId = demoUserId('dup-staff@test.com');
    createDemoInvitation('gym-2', 'Gym Two', 'Dup', '', 'Admin', { userId });
    expect(() => createDemoInvitation('gym-2', 'Gym Two', 'Dup', '', 'Admin', { userId })).toThrow(
      /active invitation already exists/,
    );
  });

  it('does not deliver the invitation to a different account', () => {
    const userId = demoUserId('right@test.com');
    const invite = createDemoInvitation('gym-3', 'Gym Three', 'Right', '', 'Reception', { userId });
    setDemoSession('individual', 'wrong@test.com');
    expect(pendingDemoInvitations('wrong@test.com').map((i) => i.id)).not.toContain(invite.id);
    expect(() => respondDemoInvitation(invite.id, true)).toThrow();
  });
});
