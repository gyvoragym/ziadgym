import { describe, it, expect, vi } from 'vitest';
import { deactivateDedicatedOwner } from '@/lib/gym-deactivation';

describe('gym account deletion', () => {
  it('bans the dedicated owner using the authentication provider', async () => {
    const update = vi.fn().mockResolvedValue({ error: null });
    await deactivateDedicatedOwner({ownerId:'fictional-owner',disableOwner:true}, update);
    expect(update).toHaveBeenCalledWith('fictional-owner', {ban_duration:'876000h'});
  });
  it('never bans an owner with unrelated account access', async () => {
    const update = vi.fn();
    await deactivateDedicatedOwner({ownerId:'shared-owner',disableOwner:false}, update);
    expect(update).not.toHaveBeenCalled();
  });
  it('reports provider failure rather than claiming deletion completed', async () => {
    await expect(deactivateDedicatedOwner({ownerId:'fictional-owner',disableOwner:true},async()=>({error:new Error('unavailable')}))).rejects.toThrow('sign-in deactivation failed');
  });
});