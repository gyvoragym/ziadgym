import { describe, it, expect } from 'vitest';
import { enterPrototype } from '@/lib/prototype-login';
import { submitDemoGymRequest, rejectRequest, approveRequest, getDemoState, setGymStatus, demoOwnerHasAccess, getDemoAccount, deleteGym, restoreGym, setDemoSession } from '@/lib/demo';

describe('local gym lifecycle',()=>{
 it('reapproves the same rejected request without duplicating its gym',()=>{
  enterPrototype({destination:'gym',name:'Fictional lifecycle',email:'fictional-lifecycle@example.invalid'},false);
  const req=submitDemoGymRequest('Fictional lifecycle gym','Monthly Plan');
  rejectRequest(req.id);approveRequest(req.id);approveRequest(req.id);
  expect(getDemoState().requests.find(r=>r.id===req.id)?.status).toBe('Approved');
  expect(getDemoState().gyms.filter(g=>g.email===req.email)).toHaveLength(1);
 });
 it('freeze saves optional reason and unfreeze restores access',()=>{
  const gym=getDemoState().gyms.find(g=>g.email==='fictional-lifecycle@example.invalid');if(!gym)throw new Error('Test gym missing');
  const account=getDemoAccount();if(!account)throw new Error('Test account missing');
  setGymStatus(gym.id,'Frozen','Fictional reason');expect(demoOwnerHasAccess(account)).toBe(false);
  expect(getDemoState().gyms.find(g=>g.id===gym.id)?.freezeNote).toBe('Fictional reason');
  setGymStatus(gym.id,'Active');expect(demoOwnerHasAccess(account)).toBe(true);
 });
  it('soft deletion retains gym and account, blocks access, permits sign-in and restores with history',()=>{
  const gym=getDemoState().gyms.find(g=>g.email==='fictional-lifecycle@example.invalid');if(!gym)throw new Error('Test gym missing');
   const acc=getDemoAccount();if(!acc)throw new Error('Test account missing');
   setDemoSession('super');deleteGym(gym.id,'Fictional suspension reason');
   expect(getDemoState().gyms.find(g=>g.id===gym.id)?.deletionNote).toBe('Fictional suspension reason');
   expect(demoOwnerHasAccess(acc)).toBe(false);
   expect(()=>enterPrototype({destination:'gym',name:'Fictional lifecycle',email:acc.email},false)).not.toThrow();
   expect(getDemoAccount()?.deletedAt).toBeUndefined();
   expect(()=>restoreGym(gym.id)).toThrow('Administrator');
   setDemoSession('super');restoreGym(gym.id);
   expect(demoOwnerHasAccess(acc)).toBe(true);
   expect(getDemoState().gyms.find(g=>g.id===gym.id)?.deletedAt).toBeUndefined();
   expect(getDemoState().gyms.find(g=>g.id===gym.id)?.deletionHistory?.map(h=>h.action)).toEqual(['deleted','restored']);
   expect(getDemoState().gyms.find(g=>g.id===gym.id)?.deletionNote).toBe('Fictional suspension reason');
 });
  it('restoration does not remove a separate Freeze restriction',()=>{
   const gym=getDemoState().gyms.find(g=>g.email==='fictional-lifecycle@example.invalid');if(!gym)throw new Error('Test gym missing');
   setDemoSession('super');setGymStatus(gym.id,'Frozen','Separate freeze reason');deleteGym(gym.id);restoreGym(gym.id);
   expect(getDemoState().gyms.find(g=>g.id===gym.id)?.status).toBe('Frozen');
   expect(getDemoState().gyms.find(g=>g.id===gym.id)?.freezeNote).toBe('Separate freeze reason');
   expect(getDemoState().gyms.find(g=>g.id===gym.id)?.deletionHistory).toHaveLength(4);
   setGymStatus(gym.id,'Active');
  });
});