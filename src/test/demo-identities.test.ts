import { describe, it, expect, beforeEach } from 'vitest';
import { demoIdentity, ensureDemoIdentity, ensureOfflineDemoIdentity, syncDemoIdentities } from '@/lib/demo-identities';
import { lookupDemoClient, prepareDemoIdentities, rememberDemoClient, setDemoSession, demoUserId, readDemoGym, writeDemoGym } from '@/lib/demo';
import { demoMemberships } from '@/lib/client-portal';
import {resetDemoTestState,seedDemoGymFixture} from './demo-fixtures';

async function reserve(input: {data:{identities:{kind:'G'|'C';key:string}[]}}) {
  return input.data.identities.map((e,i)=>({...e,id:`GYVORA-${e.kind}-${String(100+i)}`}));
}
describe('demo permanent identity and membership',()=>{
  beforeEach(()=>{resetDemoTestState();});
  it('replaces a legacy cached ID exactly once, retaining its account key and QR alias',async()=>{
    localStorage.setItem('gyvora-demo-permanent-identities-v1',JSON.stringify({installation:'fictional-installation',entries:[{kind:'C',localId:'fictional-client',key:'fictional-key',id:'GYVORA-C-123456789012345'}]}));
    await syncDemoIdentities(reserve);
    expect(demoIdentity('C','fictional-client')).toBe('GYVORA-C-100');
    const cached=JSON.parse(localStorage.getItem('gyvora-isolated-prototype:gyvora-demo-permanent-identities-v1') ?? '{}');
    expect(cached.entries[0]).toMatchObject({localId:'fictional-client',key:'fictional-key',version:2,aliases:['GYVORA-C-123456789012345']});
    await syncDemoIdentities(async()=>{throw new Error('Replacement IDs must stay permanent');});
    expect(demoIdentity('C','fictional-client')).toBe('GYVORA-C-100');
  });
  it('migrates legacy demo-user-f, keeps its account key and permanent QR after sign out',async()=>{
    localStorage.setItem('ironhaus-demo-member-identities',JSON.stringify({'demo-user-f':'demo-user-f'}));
    setDemoSession('individual','f',{name:'Fictional local F'});
    prepareDemoIdentities();await syncDemoIdentities(reserve);
    const id=demoIdentity('C','demo-user-f');
    expect(id).toMatch(/^GYVORA-C-[1-9][0-9]{2,}$/);
    setDemoSession(null);setDemoSession('individual','f');
    expect(demoIdentity('C','demo-user-f')).toBe(id);
  });
  it('reserves both gym and client IDs together, preserving assigned numbers',async()=>{
    ensureDemoIdentity('G','gym');ensureDemoIdentity('C','client');
    await syncDemoIdentities(reserve);
    expect(demoIdentity('G','gym')).toBe('GYVORA-G-100');
    expect(demoIdentity('C','client')).toBe('GYVORA-C-101');
    await syncDemoIdentities(async()=>{throw new Error('Already assigned IDs must not be regenerated');});
    expect(demoIdentity('G','gym')).toBe('GYVORA-G-100');
  });
  it('creates stable, different three-digit IDs for offline clients and gyms',()=>{
    const first=ensureOfflineDemoIdentity('C','client-one');
    const second=ensureOfflineDemoIdentity('C','client-two');
    const gym=ensureOfflineDemoIdentity('G','gym-one');
    expect(first).toMatch(/^GYVORA-C-[1-9][0-9]{2}$/);
    expect(second).toMatch(/^GYVORA-C-[1-9][0-9]{2}$/);
    expect(second).not.toBe(first);
    expect(gym).toMatch(/^GYVORA-G-[1-9][0-9]{2}$/);
    expect(ensureOfflineDemoIdentity('C','client-one')).toBe(first);
  });
  it('fills contacts by QR, name and email into the same account and exact-client membership',async()=>{
    const email='fictional-local-qr@example.invalid';const userId=demoUserId(email);
    rememberDemoClient(userId,'Fictional Local QR',email,'0000000000');
    await syncDemoIdentities(reserve);setDemoSession('owner');
    const code=demoIdentity('C',userId);if(!code)throw new Error('Missing ID');
    const p=lookupDemoClient('demo-gym',code);
    expect(p).toMatchObject({id:userId,full_name:'Fictional Local QR',email,phone:'0000000000',gyvora_id:code});
    expect(lookupDemoClient('demo-gym',email).id).toBe(userId);
    expect(lookupDemoClient('demo-gym','Fictional Local QR').id).toBe(userId);
    const gym=seedDemoGymFixture();const fixture=gym.members[0];if(!fixture)throw new Error('Missing fixture');
    const member={...fixture,id:'fictional-link',clientId:p.id,gyvoraId:code,name:p.full_name,email:p.email,phone:p.phone};
    writeDemoGym('demo-gym',{...gym,members:[member]});
    setDemoSession('individual',email);
    expect(demoMemberships(userId).map(m=>m.id)).toContain('fictional-link');
    expect(demoMemberships(demoUserId('other@example.invalid'))).toHaveLength(0);
    setDemoSession('owner');
    expect(()=>writeDemoGym('demo-gym',{...gym,members:[member,{...member,id:'duplicate'}]})).toThrow('already has a membership');
  });
  it('never returns contacts for non-owner demo sessions or unknown saved clients',async()=>{
    rememberDemoClient('local','Fictional','fictional@example.invalid','');await syncDemoIdentities(reserve);
    setDemoSession('individual','fictional@example.invalid');expect(()=>lookupDemoClient('demo-gym','Fictional')).toThrow('Only');
    setDemoSession('owner');expect(()=>lookupDemoClient('demo-gym','GYVORA-C-999999999999999')).toThrow('No existing Local demo');
    expect(()=>lookupDemoClient('another-gym','Fictional')).toThrow('Only');
  });
});