import { describe,it,expect,vi } from 'vitest';
import { reauthenticateAdminChange } from '@/lib/platform-admin-auth';
describe('secure admin credential changes',()=>{
 function api(id='admin',valid=true){return {getUser:vi.fn(async()=>({data:{user:{id:'admin',email:'admin@test.com'}},error:null})),signInWithPassword:vi.fn(async()=>({data:{user:valid?{id}:null},error:valid?null:new Error('Wrong password')})),updateUser:vi.fn(async()=>({error:null}))};}
 it('wrong current password cannot change credentials',async()=>{const auth=api('admin',false);await expect(reauthenticateAdminChange(auth,'admin','wrong',{password:'new-secret'})).rejects.toThrow('could not be verified');expect(auth.updateUser).not.toHaveBeenCalled();});
 it('mismatched reauthenticated identity cannot change credentials',async()=>{const auth=api('other');await expect(reauthenticateAdminChange(auth,'admin','current',{email:'new@test.com'})).rejects.toThrow();expect(auth.updateUser).not.toHaveBeenCalled();});
 it('verified password updates only through provider',async()=>{const auth=api();await reauthenticateAdminChange(auth,'admin','current-secret',{password:'new-secret'});expect(auth.signInWithPassword).toHaveBeenCalledWith({email:'admin@test.com',password:'current-secret'});expect(auth.updateUser).toHaveBeenCalledWith({password:'new-secret'});});
});