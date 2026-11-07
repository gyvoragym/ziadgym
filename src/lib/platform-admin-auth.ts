type AuthApi = {
 getUser:()=>Promise<{data:{user:{id:string;email?:string}|null};error:unknown}>;
 signInWithPassword:(details:{email:string;password:string})=>Promise<{data:{user:{id:string}|null};error:unknown}>;
 updateUser:(details:{email?:string;password?:string})=>Promise<{error:unknown}>;
};
/** The caller supplies an isolated server auth client, never the persisted browser client. */
export async function reauthenticateAdminChange(auth:AuthApi,userId:string,current:string,change:{email?:string;password?:string}){
 const {data:{user},error}=await auth.getUser();if(error||user?.id!==userId||!user.email)throw new Error('Please sign in again.');
 const result=await auth.signInWithPassword({email:user.email,password:current});
 if(result.error||result.data.user?.id!==userId)throw new Error('Your current password could not be verified.');
 const updated=await auth.updateUser(change);if(updated.error)throw updated.error;
 return true;
}