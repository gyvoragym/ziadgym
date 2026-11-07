import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeSampleRequest, prototypeTrialActive, readSampleRequest, resetSampleRequest, sampleEntryStep, saveSampleRequest, startSampleTrial } from '@/lib/prototype-scenario';
import { createPreviewSession, createStablePreviewSession, prototypeContactKey, savePreviewSession } from '@/lib/preview-session';
import { approveRequest, rejectRequest, setGymStatus, editGym, deleteGym, getDemoState, resetPrototypeData, savePlatformPlan } from '@/lib/demo';
import { planEndDate } from '@/lib/platform-subscriptions';

afterEach(()=>{resetSampleRequest();savePreviewSession(null);resetPrototypeData();localStorage.clear();});
const requestPlans=[
  {id:'test-monthly',name:'Monthly Plan',billingType:'Monthly' as const,durationDays:30,price:800},
  {id:'test-annual',name:'Annual Plan',billingType:'Annual' as const,durationDays:365,price:7200},
];
describe('fictional subscription and ID review',()=>{
  it('creates the configured admin session without Web Crypto support', async () => {
    vi.stubGlobal('crypto', undefined);
    try {
      await expect(createStablePreviewSession('dashboard', 'GYVORA', 'admin@example.test', 'password', true))
        .resolves.toMatchObject({ id: 'preview-dashboard-platform-admin', scenarioKey: 'platform-admin' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  for(const plan of ['Monthly Plan','Annual Plan']) it(`keeps ${plan} Pending across prototype account switches without real storage`,()=>{
    const row=makeSampleRequest('Fictional Review Gym',plan,false,'2026-10-25',requestPlans);
    localStorage.setItem('ironhaus-demo-data-v1','unchanged');
    savePreviewSession({...createPreviewSession('gym','sample','sample','sample',true),scenarioKey:'fictional-test'});
    saveSampleRequest(row);savePreviewSession(createPreviewSession('dashboard','sample','sample','sample',true));resetPrototypeData();
    expect(getDemoState().requests.filter(r=>r.id==='prototype-fictional-test')).toHaveLength(1);
    expect(getDemoState().requests.find(r=>r.id==='prototype-fictional-test')).toMatchObject({gymName:'Fictional Review Gym',plan,requestDate:'2026-10-25',status:'Pending'});
    expect(localStorage.getItem('ironhaus-demo-data-v1')).toBe('unchanged');
  });
  it('Skip demonstrates Pending, never approval, and reset removes the example',()=>{
    saveSampleRequest(makeSampleRequest('Sample Gym','Monthly Plan',true,'2026-10-25',requestPlans));
    expect(readSampleRequest()).toMatchObject({skipped:true,status:'Pending'});
    resetSampleRequest();expect(readSampleRequest()).toBeNull();
  });
  it('requires a gym name and an administrator-configured plan when sending',()=>{
    expect(()=>makeSampleRequest(' ','Monthly Plan',false,'2026-10-25',requestPlans)).toThrow();
    expect(()=>makeSampleRequest('Gym','VIP',false,'2026-10-25',requestPlans)).toThrow();
    expect(()=>makeSampleRequest('Gym','Monthly Plan',false,'2026-10-25',[])).toThrow('Select an available subscription plan');
  });
  it('uses the selected subscription catalog plan and preserves its terms through approval', async()=>{
    const admin=await createStablePreviewSession('dashboard','Admin','reviewer','any',true);
    const owner=await createStablePreviewSession('gym','Plan Gym','plan@example.test','anything',true);
    const plan={id:'platform-custom',name:'Quarterly Plus',billingType:'Monthly' as const,price:1200,durationDays:90};
    savePreviewSession(admin);resetPrototypeData();savePlatformPlan(plan);
    savePreviewSession(owner);
    saveSampleRequest(makeSampleRequest('Plan Gym',plan.id,false,'2026-10-25',[plan]));
    resetPrototypeData();
    savePreviewSession(admin);resetPrototypeData();
    savePlatformPlan({...plan,price:9999,durationDays:120});
    approveRequest(`prototype-${owner.scenarioKey}`);
    const gym=getDemoState().gyms.find(row=>row.email===owner.scenarioKey);
    expect(gym).toMatchObject({plan:'Quarterly Plus',planId:plan.id,billingType:'Monthly',durationDays:90,monthlyPrice:1200,annualPrice:14400});
    expect(gym?.end).toBe(planEndDate(new Date().toISOString().slice(0,10),90));
  });
  it('starts new phone numbers at selection and returning pending numbers at pending approval', async () => {
    const first = await prototypeContactKey('+20 100 000 0123');
    const same = await prototypeContactKey(' +201000000123 ');
    const other = await prototypeContactKey('+201000000124');
    expect(same).toBe(first);
    savePreviewSession({...createPreviewSession('gym','Fictional','phone','password',true),scenarioKey:first});
    expect(sampleEntryStep(readSampleRequest())).toBe(0);
    saveSampleRequest(makeSampleRequest('Fictional Phone Gym','Annual Plan',false,'2026-10-25',requestPlans));
    savePreviewSession({...createPreviewSession('gym','Fictional','phone','password',true),scenarioKey:other});
    expect(readSampleRequest()).toBeNull();
    expect(sampleEntryStep(readSampleRequest())).toBe(0);
    savePreviewSession({...createPreviewSession('gym','Fictional','phone','password',true),scenarioKey:same});
    expect(sampleEntryStep(readSampleRequest())).toBe(2);
    expect(readSampleRequest()?.plan).toBe('Annual Plan');
    resetSampleRequest();
  });
  it('Skip saves exactly one hour and returning access never restarts the timer', () => {
    const started = startSampleTrial(makeSampleRequest('Trial Gym','Monthly Plan',false,'2026-10-25',requestPlans),1000);
    expect(started.trialStartedAt).toBe(1000);
    expect(started.trialExpiresAt).toBe(3601000);
    expect(started.status).toBe('Pending');
    saveSampleRequest(started);
    const returning = readSampleRequest();
    if (!returning) throw new Error('Missing saved trial');
    expect(startSampleTrial(returning,2000).trialExpiresAt).toBe(3601000);
    expect(prototypeTrialActive(returning,3600999)).toBe(true);
    expect(prototypeTrialActive(returning,3601000)).toBe(false);
    expect(() => startSampleTrial(returning,3601000)).toThrow('Your trial period has ended');
    expect(sampleEntryStep(returning)).toBe(2);
  });
  it('returns to the same fictional identity with any password and separates account types', async () => {
    const a=await createStablePreviewSession('gym','A','Owner@Example.test','first',true);
    const b=await createStablePreviewSession('gym','B',' owner@example.test ','different',true);
    const client=await createStablePreviewSession('individual','B','owner@example.test','different',true);
    expect(a.id).toBe(b.id);
    expect(a.id).not.toBe(client.id);
    expect(JSON.stringify(a)).not.toContain('first');
    await expect(createStablePreviewSession('gym','A','owner@example.test','any',false)).rejects.toThrow();
  });
  it('persists rejection notes, approval and freeze across role switches without touching legacy data', async () => {
    const gym=await createStablePreviewSession('gym','Owner','+201000000987','anything',true);
    localStorage.setItem('ironhaus-demo-data-v1','legacy untouched');
    savePreviewSession(gym);
    saveSampleRequest(makeSampleRequest('Persistent Fictional Gym','Monthly Plan',false,'2026-10-25',requestPlans));
    resetPrototypeData();
    const id=`prototype-${gym.scenarioKey}`;
    savePreviewSession(await createStablePreviewSession('dashboard','Admin','reviewer','any',true));resetPrototypeData();
    rejectRequest(id,'Missing fictional details');
    savePreviewSession(null);
    savePreviewSession(await createStablePreviewSession('gym','Owner','+20 100 000 0987','new password',true));resetPrototypeData();
    expect(readSampleRequest()).toMatchObject({status:'Rejected',decisionNote:'Missing fictional details'});
    expect(() => startSampleTrial(readSampleRequest() as NonNullable<ReturnType<typeof readSampleRequest>>)).toThrow();
    savePreviewSession(await createStablePreviewSession('dashboard','Admin','reviewer','any',true));resetPrototypeData();
    approveRequest(id);
    const approved=getDemoState().gyms.find(g=>g.email===gym.scenarioKey);
    if(!approved)throw new Error('Missing approved gym');
    setGymStatus(approved.id,'Frozen','Fictional freeze reason');
    savePreviewSession(gym);resetPrototypeData();
    expect(readSampleRequest()?.status).toBe('Approved');
    expect(getDemoState().gyms.find(g=>g.id===approved.id)).toMatchObject({status:'Frozen',freezeNote:'Fictional freeze reason'});
    savePreviewSession(await createStablePreviewSession('dashboard','Admin','reviewer','any',true));resetPrototypeData();
    setGymStatus(approved.id,'Active');resetPrototypeData();
    expect(getDemoState().gyms.find(g=>g.id===approved.id)?.status).toBe('Active');
    expect(localStorage.getItem('ironhaus-demo-data-v1')).toBe('legacy untouched');
  });
  it('links saved admin edits and retained deletion to the same approved owner', async () => {
    const owner=await createStablePreviewSession('gym','Owner','actions@example.test','anything',true);
    savePreviewSession(owner);
    saveSampleRequest(makeSampleRequest('Before edit','Monthly Plan',false,'2026-10-25',requestPlans));resetPrototypeData();
    savePreviewSession(await createStablePreviewSession('dashboard','Admin','reviewer','any',true));resetPrototypeData();
    const requestId=`prototype-${owner.scenarioKey}`;
    approveRequest(requestId);
    const gym=getDemoState().gyms.find(g=>g.email===owner.scenarioKey);
    if(!gym)throw new Error('Missing gym');
    editGym(gym.id,{name:'Saved edited gym',plan:'Annual Plan',notes:'Saved gym details'});
    resetPrototypeData();
    expect(getDemoState().requests.find(r=>r.id===requestId)).toMatchObject({gymName:'Saved edited gym',plan:'Annual Plan',status:'Approved'});
    savePreviewSession(owner);resetPrototypeData();
    expect(readSampleRequest()).toMatchObject({gymName:'Saved edited gym',plan:'Annual Plan'});
    expect(()=>setGymStatus(gym.id,'Frozen','owner attempt')).toThrow('Administrator');
    savePreviewSession(await createStablePreviewSession('dashboard','Admin','reviewer','any',true));resetPrototypeData();
    deleteGym(gym.id,'Fictional ban reason');
    savePreviewSession(owner);resetPrototypeData();
    expect(getDemoState().gyms.find(g=>g.id===gym.id)).toMatchObject({name:'Saved edited gym',deletionNote:'Fictional ban reason',notes:'Saved gym details'});
    expect(getDemoState().gyms.find(g=>g.id===gym.id)?.deletedAt).toBeTruthy();
    expect(getDemoState().requests.find(r=>r.id===requestId)?.status).toBe('Approved');
  });
});