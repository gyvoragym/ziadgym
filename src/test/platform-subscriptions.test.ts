import { beforeEach, describe, expect, it } from 'vitest';
import { gymPrices, savePrices, projectedSubscriptions } from '@/lib/platform-subscriptions';
import { approveRequest, deleteGym, getDemoState, editGym, savePlatformBranding, savePlatformWhatsapp, setDemoSession } from '@/lib/demo';
import type { ApprovedGym } from '@/lib/demo';
import { prototypeStorage } from '@/lib/prototype-storage';
import { resetDemoTestState } from './demo-fixtures';

const gym: ApprovedGym={id:'test',name:'Test Gym',phone:'',email:'',plan:'Basic',start:'2026-01-01',end:'2026-12-31',status:'Active',monthlyPrice:100,annualPrice:1200,annualPriceManual:false};
const from=new Date(2026,0,1),to=new Date(2026,11,31);
describe('Super Admin subscription rules',()=>{
  beforeEach(()=>resetDemoTestState());
  it('defaults annual price to monthly times 12',()=>expect(savePrices({monthlyPrice:250,annualPrice:0,annualPriceManual:false}).annualPrice).toBe(3000));
  it('preserves a manually overridden annual price',()=>expect(savePrices({monthlyPrice:250,annualPrice:2400,annualPriceManual:true}).annualPrice).toBe(2400));
  it('resetting automatic mode recalculates annual price',()=>expect(savePrices({monthlyPrice:300,annualPrice:2400,annualPriceManual:false}).annualPrice).toBe(3600));
  it('rejects negative prices',()=>expect(()=>savePrices({monthlyPrice:-1,annualPrice:1200,annualPriceManual:false})).toThrow());
  it('counts only monthly billings for monthly plans',()=>expect(projectedSubscriptions([gym],from,to).reduce((s,r)=>s+r.amount,0)).toBe(1200));
  it('counts only annual price once for annual plans',()=>expect(projectedSubscriptions([{...gym,plan:'VIP',annualPrice:900}],from,to).map(r=>r.amount)).toEqual([900]));
  it('uses monthly price times three for quarterly plans',()=>expect(projectedSubscriptions([{...gym,plan:'Premium'}],from,to).map(r=>r.amount)).toEqual([300,300,300,300]));
  it('excludes frozen gyms',()=>expect(projectedSubscriptions([{...gym,status:'Frozen'}],from,to)).toEqual([]));
  it('excludes deleted gyms without changing saved billing data',()=>expect(projectedSubscriptions([{...gym,deletedAt:'2026-01-01T00:00:00Z'}],from,to)).toEqual([]));
  it('filters scheduled billing by the selected reporting dates',()=>expect(projectedSubscriptions([gym],new Date(2026,1,1),new Date(2026,1,28)).map(r=>r.date)).toEqual(['2026-02-01']));
  it('does not project beyond saved subscription dates',()=>expect(projectedSubscriptions([{...gym,end:'2026-02-28'}],from,to)).toHaveLength(2));
  it('has an empty result with no gyms or no prices',()=>{expect(projectedSubscriptions([],from,to)).toEqual([]);expect(projectedSubscriptions([{...gym,monthlyPrice:0}],from,to)).toEqual([]);});
  it('keeps legacy prices compatible',()=>expect(gymPrices({plan:'VIP'})).toEqual({monthlyPrice:600,annualPrice:7200,annualPriceManual:false}));
  it('approval updates saved gym and pending counts, removal updates gym count',()=>{
    const before=getDemoState();const pending=before.requests.find(r=>r.status==='Pending');if(!pending)throw new Error('Pending fixture required');
    approveRequest(pending.id);const after=getDemoState();expect(after.gyms.length).toBe(before.gyms.length+1);expect(after.requests.filter(r=>r.status==='Pending').length).toBe(before.requests.filter(r=>r.status==='Pending').length-1);
    const added=after.gyms.find(g=>!before.gyms.some(old=>old.id===g.id));if(!added)throw new Error('Approved gym required');setDemoSession('super');deleteGym(added.id);expect(getDemoState().gyms.filter(g=>!g.deletedAt).length).toBe(before.gyms.length);expect(getDemoState().gyms.length).toBe(after.gyms.length);
  });
  it('persists prices without changing gym contact, dates or identity',()=>{
    const current=getDemoState().gyms[0];if(!current)throw new Error('Gym fixture required');
    editGym(current.id,{name:current.name,plan:current.plan,monthlyPrice:200,annualPrice:1800,annualPriceManual:true});
    expect(getDemoState().gyms.find(g=>g.id===current.id)).toMatchObject({...current,monthlyPrice:200,annualPrice:1800,annualPriceManual:true});
    const saved=JSON.parse(prototypeStorage().getItem('ironhaus-demo-data-v1')??'{}');expect(saved.gyms.find((g:ApprovedGym)=>g.id===current.id).annualPrice).toBe(1800);
  });
  it('platform branding stays separate from gyms and is persisted',()=>{setDemoSession('super');const gyms=getDemoState().gyms;savePlatformBranding({name:'Test Platform',logo:'demo-image:test'});expect(getDemoState().gyms).toEqual(gyms);expect(JSON.parse(prototypeStorage().getItem('ironhaus-demo-data-v1')??'{}').platformBranding).toEqual({name:'Test Platform',logo:'demo-image:test'});});
  it('saves the platform WhatsApp number separately',()=>{setDemoSession('super');savePlatformWhatsapp('+201001234567');expect(getDemoState().platformWhatsapp).toBe('+201001234567');expect(JSON.parse(prototypeStorage().getItem('ironhaus-demo-data-v1')??'{}').platformWhatsapp).toBe('+201001234567');});
  it('rejects invalid platform WhatsApp numbers',()=>{setDemoSession('super');expect(()=>savePlatformWhatsapp('not a phone')).toThrow('Enter a WhatsApp number');});
  it('owners and clients cannot change prototype platform branding',()=>{setDemoSession('owner');expect(()=>savePlatformBranding({name:'Wrong',logo:''})).toThrow('Administrator');setDemoSession('individual');expect(()=>savePlatformBranding({name:'Wrong',logo:''})).toThrow('Administrator');});
});