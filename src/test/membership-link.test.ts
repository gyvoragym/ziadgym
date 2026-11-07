import {describe,it,expect} from 'vitest';
import {assertUniqueClientMembership,validateMembershipChanges,membershipDaysRemaining,membershipSessionsUsed,membershipStatus,isClientPortalPath} from '@/lib/membership-link';
import {members} from '@/lib/mock';

describe('owner-added client memberships',()=>{
 it('does not allow pending owners or clients into member management through the client portal exception',()=>{
  expect(isClientPortalPath('/members')).toBe(false);
  expect(isClientPortalPath('/memberships')).toBe(false);
  expect(isClientPortalPath('/members/fictional-member')).toBe(false);
  expect(isClientPortalPath('/member/membership')).toBe(true);
 });
 const base=members[0];
 if(!base)throw new Error('Missing fixture');
 const member={...base,id:'fictional-membership',clientId:'fictional-client'};
 it('prevents a second membership for the same client in a gym',()=>{
  expect(()=>assertUniqueClientMembership([member],'fictional-client','another-record')).toThrow('already has a membership');
 });
 it('allows editing the existing linked membership',()=>{
  expect(()=>assertUniqueClientMembership([member],'fictional-client','fictional-membership')).not.toThrow();
 });
 it('allows selected edits with legacy duplicates without validating them as new links',()=>{
  const duplicate={...member,id:'fictional-legacy-duplicate'};
  expect(()=>validateMembershipChanges([member,duplicate],[{...member,notes:'Edited'},duplicate])).not.toThrow();
 });
 it('renews the selected existing record while retaining its client link',()=>{
  const duplicate={...member,id:'fictional-legacy-duplicate'};
  expect(()=>validateMembershipChanges([member,duplicate],[{...member,start:'2026-10-24',expiry:'2027-01-24'},duplicate])).not.toThrow();
 });
 it('allows deletion without creation validation on remaining legacy duplicates',()=>{
  const duplicate={...member,id:'fictional-legacy-duplicate'};
  const other={...member,id:'fictional-other',clientId:'fictional-other-client'};
  expect(()=>validateMembershipChanges([member,duplicate,other],[member,duplicate])).not.toThrow();
 });
 it('still rejects a new or relinked record for an existing client',()=>{
  expect(()=>validateMembershipChanges([member],[member,{...member,id:'fictional-new'}])).toThrow('already has a membership');
  const other={...member,id:'fictional-other',clientId:'fictional-other-client'};
  expect(()=>validateMembershipChanges([member,other],[member,{...other,clientId:member.clientId}])).toThrow('already has a membership');
 });
 it('allows another gym to add the same client independently',()=>{
  expect(()=>assertUniqueClientMembership([],'fictional-client')).not.toThrow();
 });
 it('shows expired membership from saved dates regardless of stale display status',()=>{
  expect(membershipStatus({start:'2026-09-01',expiry:'2026-10-22'},'2026-10-23')).toBe('Expired');
 });
 it('treats the end date as exclusive and expires at midnight on that date',()=>{
  expect(membershipStatus({start:'2026-10-23',expiry:'2026-11-22'},'2026-11-21')).toBe('Expiring');
  expect(membershipStatus({start:'2026-10-23',expiry:'2026-11-22'},'2026-11-22')).toBe('Expired');
  expect(membershipDaysRemaining('2026-11-22','2026-10-23')).toBe(30);
  expect(membershipDaysRemaining('2026-11-22','2026-11-21')).toBe(1);
  expect(membershipDaysRemaining('2026-11-22','2026-11-22')).toBe(0);
 });
 it('shows active membership before its exclusive expiry date',()=>{
  expect(membershipStatus({start:'2026-10-23',expiry:'2026-12-01'},'2026-10-23')).toBe('Active');
 });
 it('expires limited memberships as soon as the session allowance is used up',()=>{
  expect(membershipStatus({start:'2026-10-23',expiry:'2026-12-01',type:'Limited',sessionsLeft:1},'2026-10-23')).toBe('Active');
  expect(membershipStatus({start:'2026-10-23',expiry:'2026-12-01',type:'Limited',sessionsLeft:0},'2026-10-23')).toBe('Expired');
 });
 it('shows limited sessions as used out of total',()=>{
  expect(membershipSessionsUsed({type:'Limited',sessionsLeft:12,sessionsTotal:12})).toBe(0);
  expect(membershipSessionsUsed({type:'Limited',sessionsLeft:11,sessionsTotal:12})).toBe(1);
 });
});