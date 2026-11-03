import { beforeEach, describe, expect, it } from 'vitest';
import { readDemoGym, setDemoSession, writeDemoGym } from '@/lib/demo';
import { bindPersistence, getState, hydrateState, saveState } from '@/lib/store';
import { prototypeStorage } from '@/lib/prototype-storage';
import { resetDemoTestState, seedDemoGymFixture } from './demo-fixtures';

describe('gym pricing plans are independent from client memberships', () => {
  beforeEach(() => {
    resetDemoTestState();
    seedDemoGymFixture();
    setDemoSession('owner');
    bindPersistence(undefined);
  });

  it('saves only pricing plans despite legacy duplicate client links and retains them after reload', async () => {
    const gym = readDemoGym('demo-gym', true);
    const fixture = gym.members[0];
    if (!fixture) throw new Error('Membership fixture required');
    const member = { ...fixture, id: 'fictional-membership', name: 'Fictional Client', email: 'fictional@example.invalid', clientId: 'fictional-client' };
    prototypeStorage().setItem('ironhaus-demo-gym:demo-gym', JSON.stringify({ ...gym, members: [member, { ...member, id: 'legacy-duplicate' }] }));
    hydrateState(readDemoGym('demo-gym', true));
    const before = structuredClone(getState().members);
    const history = prototypeStorage().getItem('ironhaus-demo-membership-history');
    bindPersistence(async changes => {
      const next = { ...getState(), ...changes };
      writeDemoGym('demo-gym', next);
      hydrateState(next);
    });
    const plan = { id: 'fictional-pricing-plan', name: 'Fictional Monthly', price: 350, duration: '30 days', features: ['Gym access'] };
    await saveState(s => ({ plans: [...s.plans, plan] }));
    const reloaded = readDemoGym('demo-gym', true);
    expect(reloaded.plans.find(p => p.id === plan.id)).toEqual(plan);
    expect(reloaded.members).toEqual(before);
    expect(prototypeStorage().getItem('ironhaus-demo-membership-history')).toBe(history);
    bindPersistence(undefined);
  });

  it('renews the existing membership independently without creating a membership or changing plans', () => {
    const gym = readDemoGym('demo-gym', true);
    const fixture = gym.members[0];
    if (!fixture) throw new Error('Membership fixture required');
    const member = { ...fixture, id: 'fictional-renewal', name: 'Fictional Renewal', email: 'renewal@example.invalid', clientId: 'fictional-renewal-client', start: '2026-01-01', expiry: '2026-02-01', status: 'Expired' as const };
    writeDemoGym('demo-gym', { ...gym, members: [member] });
    const saved = readDemoGym('demo-gym', true);
    const renewed = { ...saved.members[0], ...member, start: '2026-10-24', expiry: '2026-11-24', status: 'Active' as const };
    writeDemoGym('demo-gym', { ...saved, members: [renewed] });
    const reloaded = readDemoGym('demo-gym', true);
    expect(reloaded.members).toHaveLength(1);
    expect(reloaded.members[0]).toMatchObject({ id: 'fictional-renewal', clientId: 'fictional-renewal-client', start: '2026-10-24', expiry: '2026-11-24' });
    expect(reloaded.plans).toEqual(saved.plans);
    expect(() => writeDemoGym('demo-gym', { ...reloaded, members: [renewed, { ...renewed, id: 'duplicate' }] })).toThrow('already has a membership');
  });
  it('persists selected edit, renewal and deletion despite unrelated legacy duplicate links', () => {
    const gym=readDemoGym('demo-gym',true), fixture=gym.members[0];
    if(!fixture)throw new Error('Membership fixture required');
    const selected={...fixture,id:'fictional-selected',clientId:'fictional-selected-client',name:'Fictional Selected'};
    const a={...fixture,id:'fictional-legacy-a',clientId:'fictional-legacy-client'};
    const b={...a,id:'fictional-legacy-b'};
    prototypeStorage().setItem('ironhaus-demo-gym:demo-gym',JSON.stringify({...gym,members:[selected,a,b]}));
    let saved=readDemoGym('demo-gym',true);
    const others=saved.members.filter(m=>m.id!==selected.id);
    writeDemoGym('demo-gym',{...saved,members:saved.members.map(m=>m.id===selected.id?{...m,notes:'Selected edit'}:m)});
    saved=readDemoGym('demo-gym',true);
    expect(saved.members.find(m=>m.id===selected.id)?.notes).toBe('Selected edit');
    writeDemoGym('demo-gym',{...saved,members:saved.members.map(m=>m.id===selected.id?{...m,start:'2026-10-24',expiry:'2027-01-24'}:m)});
    saved=readDemoGym('demo-gym',true);
    expect(saved.members.find(m=>m.id===selected.id)).toMatchObject({clientId:selected.clientId,start:'2026-10-24',expiry:'2027-01-24'});
    expect(saved.members.filter(m=>m.id!==selected.id)).toEqual(others);
    expect(()=>writeDemoGym('demo-gym',{...saved,members:[...saved.members,{...selected,id:'fictional-second'}]})).toThrow('already has a membership');
    writeDemoGym('demo-gym',{...saved,members:saved.members.filter(m=>m.id!==selected.id)});
    const after=readDemoGym('demo-gym',true);
    expect(after.members).toEqual(others);
    expect(after.plans).toEqual(gym.plans);
  });
});