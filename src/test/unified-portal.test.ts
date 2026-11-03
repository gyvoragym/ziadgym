import {describe,it,expect} from 'vitest';
import {createDemoInvitation,respondDemoInvitation,pendingDemoInvitations,setDemoSession,getDemoState,demoUserId,changeDemoStaff,readDemoGym,writeDemoGym,saveDemoProgram,changeDemoProgram} from '@/lib/demo';
import {editAttendanceRecord} from '@/lib/staff-attendance';
import {initialState,type AttendanceEvent} from '@/lib/store';
import {members} from '@/lib/mock';
import {prototypeStorage} from '@/lib/prototype-storage';
import {resetDemoTestState} from './demo-fixtures';
import {beforeEach} from 'vitest';
beforeEach(()=>resetDemoTestState());
describe('unified member invitations',()=>{
 it('scopes notifications and rejects another invitee response',()=>{
  const invite=createDemoInvitation('scope-g','Scope gym','Target','target@scope.test','Trainer');
  setDemoSession('individual','other@scope.test');
  expect(pendingDemoInvitations('other@scope.test')).toHaveLength(0);
  expect(()=>respondDemoInvitation(invite.id,true)).toThrow();
  expect(getDemoState().invitations.find(i=>i.id===invite.id)?.status).toBe('Pending');
 });
 it('accepts into one existing identity with exactly the invited permissions and persists the status',()=>{
  const invite=createDemoInvitation('accept-g','Accept gym','Target','target@accept.test','Reception');
  setDemoSession('individual','target@accept.test');respondDemoInvitation(invite.id,true);
  const role=getDemoState().staffRoles.find(r=>r.id===invite.id);
  expect(role?.userId).toBe(demoUserId('target@accept.test'));
  expect(role?.permissions).toEqual(['Members','Attendance','Sessions','Payments']);
  expect(pendingDemoInvitations('target@accept.test')).toHaveLength(0);
  expect(JSON.parse(prototypeStorage().getItem('ironhaus-demo-data-v1')??'{}').invitations.find((i:{id:string})=>i.id===invite.id).status).toBe('Accepted');
 });
 it('declining adds no gym association',()=>{
  const invite=createDemoInvitation('decline-g','Decline gym','Target','target@decline.test','Admin');
  setDemoSession('individual','target@decline.test');respondDemoInvitation(invite.id,false);
  expect(getDemoState().staffRoles.some(r=>r.id===invite.id)).toBe(false);
  expect(getDemoState().invitations.find(i=>i.id===invite.id)?.status).toBe('Declined');
 });
 it('owner removal affects only one gym role and leaves membership and other associations',()=>{
  const email='multi@roles.test';
  const one=createDemoInvitation('remove-one','One','Multi',email,'Trainer');
  const two=createDemoInvitation('remove-two','Two','Multi',email,'Admin');
  setDemoSession('individual',email);respondDemoInvitation(one.id,true);respondDemoInvitation(two.id,true);
  const member=members[0];if(!member)throw new Error('Missing seed member');const state={...structuredClone(initialState),members:[{...member,clientId:demoUserId(email)}]};writeDemoGym('remove-one',state);
  expect(()=>changeDemoStaff('remove-one',one.id,null)).toThrow('Only gym owners');
  setDemoSession('owner');changeDemoStaff('remove-one',one.id,null);
  expect(readDemoGym('remove-one').staff.some(s=>s.id===one.id)).toBe(false);
  expect(getDemoState().staffRoles.some(r=>r.id===two.id)).toBe(true);
  expect(readDemoGym('remove-one').members[0]?.clientId).toBe(demoUserId(email));
 });
 it('personal program changes cannot modify another user’s library',()=>{
  setDemoSession('individual','workout@own.test');saveDemoProgram(demoUserId('workout@own.test'),{name:'Own',trainer:'',notes:'',exercises:[]});
  const row=getDemoState().programs.find(p=>p.user_id===demoUserId('workout@own.test'));
  if(!row)throw new Error('Missing program');
  setDemoSession('individual','other@own.test');expect(()=>changeDemoProgram(row.id,null)).toThrow();
 });
});
describe('single attendance record changes',()=>{
 const rows:AttendanceEvent[]=[{id:'a',name:'A',date:'2026-10-18',time:'09:00',method:'Manual'},{id:'b',name:'B',date:'2026-10-18',time:'10:00',method:'QR'}];
 it('edits only the selected record including a different employee',()=>{
  const next=editAttendanceRecord(rows,'a',{name:'C',date:'2026-10-17',time:'11:30',staffId:'c',role:'Trainer'});
  expect(next[0]).toEqual({...rows[0],name:'C',date:'2026-10-17',time:'11:30',staffId:'c',role:'Trainer'});expect(next[1]).toEqual(rows[1]);
 });
 it('deletes only the selected attendance record',()=>expect(editAttendanceRecord(rows,'a',null)).toEqual([rows[1]]));
});