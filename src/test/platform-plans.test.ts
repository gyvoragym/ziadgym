import { beforeEach, describe, expect, it } from 'vitest';
import { defaultPlatformPlans, platformPlanSchema, planDefaults, planEndDate, projectedSubscriptions } from '@/lib/platform-subscriptions';
import { deletePlatformPlan, savePlatformPlan, setDemoSession, getDemoState, editGym, submitDemoGymRequest } from '@/lib/demo';
import { prototypeStorage } from '@/lib/prototype-storage';
import { resetDemoTestState } from './demo-fixtures';
const plan={id:'test-catalog',name:'Negotiated Monthly',billingType:'Monthly' as const,price:250,durationDays:30};
describe('Super Admin catalog and saved agreements',()=>{
  beforeEach(()=>{resetDemoTestState();setDemoSession('super');});
  it('restores editable Monthly and Annual prototype plans',()=>expect(defaultPlatformPlans).toEqual([
    {id:'platform-monthly',name:'Monthly Plan',billingType:'Monthly',price:800,durationDays:30},
    {id:'platform-annual',name:'Annual Plan',billingType:'Annual',price:7200,durationDays:365},
  ]));
  it('rejects package names outside the administrator catalog',()=>{setDemoSession('owner','owner@test.invalid');expect(()=>submitDemoGymRequest('Gym','Unlisted Plan')).toThrow('Select an available subscription plan.');});
  it('requires a plan name',()=>expect(()=>platformPlanSchema.parse({...plan,name:''})).toThrow());
  it('requires a positive price',()=>expect(()=>platformPlanSchema.parse({...plan,price:0})).toThrow());
  it('requires positive whole days',()=>{expect(()=>platformPlanSchema.parse({...plan,durationDays:0})).toThrow();expect(()=>platformPlanSchema.parse({...plan,durationDays:1.5})).toThrow();});
  it('accepts Monthly and Annual billing only',()=>expect(()=>platformPlanSchema.parse({...plan,billingType:'Weekly'})).toThrow());
  it('sets the end date to selected start plus duration in days',()=>expect(planEndDate('2026-10-21',30)).toBe('2026-11-20'));
  it('defaults monthly and annual prices on explicit assignment',()=>expect(planDefaults(plan,'2026-10-21')).toMatchObject({monthlyPrice:250,annualPrice:3000,end:'2026-11-20',billingType:'Monthly'}));
  it('uses the annual plan price once, not plus monthly',()=>{const base=getDemoState().gyms[0];if(!base)throw new Error('Gym fixture required');const g={...base,...planDefaults({...plan,billingType:'Annual',price:2400,durationDays:365},'2026-01-01'),start:'2026-01-01',status:'Active' as const};expect(projectedSubscriptions([g],new Date(2026,0,1),new Date(2027,0,1)).map(r=>r.amount)).toEqual([2400]);});
  it('keeps negotiated prices dates and notes when the catalog is edited and blocks in-use deletion',()=>{
    savePlatformPlan(plan);const gym=getDemoState().gyms[0];if(!gym)throw new Error('Gym fixture required');
    editGym(gym.id,{name:gym.name,plan:plan.name,planId:plan.id,applyPlan:true,start:'2026-10-21',end:'2026-12-15',monthlyPrice:200,annualPrice:2100,annualPriceManual:true,notes:'Only this gym'});
    const saved=getDemoState().gyms.find(g=>g.id===gym.id);savePlatformPlan({...plan,name:'Changed',price:500,durationDays:90,billingType:'Annual'});
    expect(getDemoState().gyms.find(g=>g.id===gym.id)).toEqual(saved);expect(()=>deletePlatformPlan(plan.id)).toThrow('assigned');
    const stored=JSON.parse(prototypeStorage().getItem('ironhaus-demo-data-v1')??'{}');expect(stored.gyms.find((g:{id:string})=>g.id===gym.id)).toMatchObject({start:'2026-10-21',end:'2026-12-15',notes:'Only this gym',monthlyPrice:200,annualPrice:2100});
  });
  it('rejects reversed subscription dates',()=>{const g=getDemoState().gyms[0];if(!g)throw new Error('Gym fixture required');expect(()=>editGym(g.id,{name:g.name,plan:g.plan,start:'2026-12-01',end:'2026-11-01'})).toThrow();});
  it('deletes unused plans without changing gyms',()=>{savePlatformPlan({...plan,id:'unused'});const gyms=getDemoState().gyms;deletePlatformPlan('unused');expect(getDemoState().gyms).toEqual(gyms);expect(getDemoState().platformPlans?.some(p=>p.id==='unused')).toBe(false);});
  it('owners and clients cannot manage prototype catalog',()=>{for(const role of ['owner','individual'] as const){setDemoSession(role);expect(()=>savePlatformPlan(plan)).toThrow('Administrator');expect(()=>deletePlatformPlan(plan.id)).toThrow('Administrator');}});
});