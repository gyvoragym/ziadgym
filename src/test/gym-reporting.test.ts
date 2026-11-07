import { describe, expect, it, beforeEach } from 'vitest';
import { dashboardTotals, gymToday, membershipPrice, sessionTotal, recordedTotals, revenueReports, reportingEvents } from '@/lib/gym-reporting';
import { initialState, type Session, type Invoice } from '@/lib/store';
import { readDemoGym, setDemoSession, writeDemoGym } from '@/lib/demo';
import { resetDemoTestState, seedDemoGymFixture } from './demo-fixtures';
describe('saved gym reporting', () => {
  beforeEach(() => { resetDemoTestState(); seedDemoGymFixture(); setDemoSession('owner'); });
  const sessions = [{id:'a',name:'Fictional',date:'2026-10-25',price:150},{id:'b',name:'Fictional',date:'2026-10-24',price:75}] as Session[];
  const events = [{id:'c',memberId:'m',date:'2026-10-25',price:350,kind:'created' as const},{id:'d',memberId:'m',date:'2026-10-24',price:600,kind:'renewed' as const}];
  it('sums only filtered daily sessions', () => { expect(sessionTotal(sessions.filter(s=>s.date==='2026-10-24'))).toBe(75); });
  it('recorded income includes session and membership once, never a duplicate income invoice', () => {
    const invoices = [{id:'duplicate-income',date:'2026-10-25',amount:350,entered:true},{id:'paid',date:'2026-10-25',amount:-100,entered:true},{id:'unpaid',date:'2026-10-25',amount:-400,entered:false}] as Invoice[];
    expect(recordedTotals(sessions,[...events,events[0] as typeof events[number]],invoices,{from:'2026-10-25',to:'2026-10-25'})).toMatchObject({income:500,expenses:100,net:400});
  });
  it('session edit and deletion update income without changing subscription history', () => {
    expect(recordedTotals([{...sessions[0] as Session,price:200}],events,[],{from:'2026-10-25',to:'2026-10-25'}).income).toBe(550);
    expect(recordedTotals([],events,[],{from:'2026-10-25',to:'2026-10-25'}).income).toBe(350);
    expect(recordedTotals(sessions,events,[],{from:'2026-10-24',to:'2026-10-24'}).income).toBe(675);
  });
  it('removed memberships are excluded from live totals while history is retained', () => {
    expect(recordedTotals(sessions,reportingEvents(events,[]),[],{from:'2026-10-25',to:'2026-10-25'}).income).toBe(150);
    expect(events).toHaveLength(2);
  });
  it('month and YTD stop at local today and subtract only same-year paid expenses', () => {
    const rows = [...sessions,{...sessions[0] as Session,id:'jan',date:'2026-01-01',price:200},{...sessions[0] as Session,id:'future',date:'2026-10-26',price:999},{...sessions[0] as Session,id:'old',date:'2025-12-31',price:900}];
    const invoices = [{id:'paid',date:'2026-01-01',amount:-100,entered:true},{id:'old',date:'2025-12-31',amount:-900,entered:true},{id:'future',date:'2026-10-26',amount:-999,entered:true},{id:'unpaid',date:'2026-10-25',amount:-400,entered:false},{id:'deleted',date:'2026-10-25',amount:-400,entered:true,deleted:true}] as Invoice[];
    const report = revenueReports(rows,events,invoices,'2026-10-25');
    expect(report.daily.income).toBe(500); expect(report.monthly.income).toBe(1175); expect(report.yearly.income).toBe(1375); expect(report.yearly.net).toBe(1275);
  });
  it('counts each subscription once on its event date and subtracts paid expenses', () => {
    const invoices=[{id:'e',date:'2026-10-25',amount:-100,entered:true},{id:'f',date:'2026-10-25',amount:-400,entered:false}] as Invoice[];
    expect(dashboardTotals(sessions,[...events,events[0] as typeof events[number]],invoices,'2026-10-25')).toMatchObject({revenue:500,expenses:100,net:400});
    expect(dashboardTotals(sessions,events,invoices,'2026-10-24').revenue).toBe(675);
    expect(dashboardTotals(sessions,events,invoices,'2026-10-26').revenue).toBe(0);
  });
  it('uses the configured local calendar date across UTC midnight', () => { expect(gymToday({...initialState.gym,preferences:{currency:'EGP',language:'English',notifications:{},timeZone:'Africa/Cairo'}},new Date('2026-10-24T22:00:00Z'))).toBe('2026-10-25'); });
  it('preserves subscribed price after catalog changes', () => { expect(membershipPrice({plan:'Fictional',planPrice:350},[{id:'p',name:'Fictional',price:999,duration:'1 month',features:[]}])).toBe(350); });
  it('persists creation and renewal snapshots but not ordinary edits or deletion events', () => {
    const gym=readDemoGym('demo-gym',true),fixture=gym.members[0]; if(!fixture)throw new Error('Fixture required');
    const plan={id:'p',name:'Fictional',price:350,duration:'1 month',features:[]};
    writeDemoGym('demo-gym',{...gym,plans:[plan],members:[{...fixture,id:'fictional',clientId:'fictional',plan:plan.name,subscriptionEventId:'create'}]});
    let saved=readDemoGym('demo-gym',true); expect(saved.membershipEvents?.at(-1)?.price).toBe(350);
    writeDemoGym('demo-gym',{...saved,plans:[{...plan,price:600}],members:saved.members.map(m=>({...m,notes:'Edit'}))});
    saved=readDemoGym('demo-gym',true); expect(saved.membershipEvents).toHaveLength(1); expect(saved.members[0]?.planPrice).toBe(350);
    writeDemoGym('demo-gym',{...saved,members:saved.members.map(m=>({...m,subscriptionEventId:'renew'}))});
    saved=readDemoGym('demo-gym',true); expect(saved.members[0]?.planPrice).toBe(600); expect(saved.membershipEvents?.map(e=>e.price)).toEqual([350,600]);
    writeDemoGym('demo-gym',{...saved,members:[]}); expect(readDemoGym('demo-gym',true).membershipEvents).toHaveLength(2);
  });
});