import { describe,it,expect } from 'vitest';
import { clientDeleteScope,joinedProgramGyms,clientDetailsSchema } from '@/lib/client-management';
describe('saved client rules',()=>{
  it('gym owner deletion is scoped to the gym, not the full account',()=>{expect(clientDeleteScope('fictional-gym')).toBe('gym');});
  it('platform deletion targets account deactivation',()=>{expect(clientDeleteScope()).toBe('account');});
  it('joined workout browsing excludes unrelated and staff-only gyms',()=>{expect(joinedProgramGyms([{id:'joined'},{id:'approved-member'},{id:'staff-only'},{id:'unrelated'}],[{gymId:'joined'}],[{gymId:'approved-member'}])).toEqual([{id:'joined'},{id:'approved-member'}]);});
  it('registered email is required and normalized',()=>{expect(clientDetailsSchema.parse({name:'Fictional Client',email:'FICTIONAL@example.test',phone:'',photo:''}).email).toBe('fictional@example.test');expect(clientDetailsSchema.safeParse({name:'Fictional Client',email:'',phone:'',photo:''}).success).toBe(false);});
});