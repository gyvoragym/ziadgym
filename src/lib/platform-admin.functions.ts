import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { reauthenticateAdminChange } from './platform-admin-auth';
import { deactivateDedicatedOwner } from './gym-deactivation';

export const changePlatformCredentials=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(input=>z.object({current:z.string().min(1).max(128),change:z.union([z.object({email:z.string().trim().email().max(255).transform(v=>v.toLowerCase())}).strict(),z.object({password:z.string().min(8).max(128)}).strict()])}).parse(input)).handler(async({data,context})=>{
 const {data:allowed}=await context.supabase.rpc('is_super_admin');if(!allowed)throw new Error('Administrator access required');
 if('email' in data.change){const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const {data:existing,error}=await supabaseAdmin.from('profiles').select('id').ilike('email',data.change.email).neq('id',context.userId).limit(1);if(error)throw new Error('Could not validate the email.');if(existing?.length)throw new Error('This email is already used by another account.');}
 await reauthenticateAdminChange(context.supabase.auth,context.userId,data.current,data.change);return true;
});

export const getPlatformNotifications = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
  const {data:allowed,error:roleError}=await context.supabase.rpc('is_super_admin');
  if(roleError || !allowed)throw new Error('Administrator access required');
  const {data:rows,error}=await context.supabase.from('platform_request_notifications').select('id,request_id,created_at,read_at').eq('recipient_id',context.userId).order('created_at',{ascending:false});
  if(error)throw new Error('Could not load notifications.');
  const {data:requests,error:requestError}=await context.supabase.from('owner_requests').select('*');
  if(requestError)throw new Error('Could not load gym requests.');
  const ids=[...new Set((requests??[]).map(r=>r.user_id))];
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {data:profiles,error:profileError}=ids.length ? await supabaseAdmin.from('profiles').select('id,full_name').in('id',ids) : {data:[],error:null};
  if(profileError)throw new Error('Could not load request owner names.');
  return (rows??[]).flatMap(n=>{const r=requests?.find(r=>r.id===n.request_id);return r ? [{id:n.id,requestId:r.id,gymName:r.gym_name,ownerName:profiles?.find(p=>p.id===r.user_id)?.full_name || 'Name not recorded',plan:r.plan,date:r.created_at,status:r.status,read:!!n.read_at}] : [];});
});
export const listAdminGyms=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {data:allowed}=await context.supabase.rpc('is_super_admin');if(!allowed)throw new Error('Administrator access required');
  const {data:gyms,error}=await context.supabase.from('gyms').select('id,name,owner_id,created_at,frozen_at,freeze_note,deleted_at,deletion_note,admin_note').order('created_at',{ascending:true});
  if(error)throw new Error('Could not load gyms.');
  const ids=[...new Set((gyms??[]).map(g=>g.owner_id))];
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {data:profiles}=ids.length?await supabaseAdmin.from('profiles').select('id,full_name,email,phone').in('id',ids):{data:[] as {id:string;full_name:string;email:string;phone:string}[]};
  const {data:requests}=await context.supabase.from('owner_requests').select('gym_id,plan,status,phone,decided_at');
  return (gyms??[]).filter(g=>g.deleted_at || requests?.some(r=>r.gym_id===g.id&&r.status==='Approved')).map(g=>({id:g.id,name:g.name,ownerId:g.owner_id,ownerName:profiles?.find(p=>p.id===g.owner_id)?.full_name||'',ownerEmail:profiles?.find(p=>p.id===g.owner_id)?.email||'',ownerPhone:profiles?.find(p=>p.id===g.owner_id)?.phone||requests?.find(r=>r.gym_id===g.id)?.phone||'',plan:requests?.find(r=>r.gym_id===g.id)?.plan??'',subscriptionStart:requests?.find(r=>r.gym_id===g.id&&r.status==='Approved')?.decided_at?.slice(0,10)??'',subscriptionEnd:'',deleted:!!g.deleted_at,deletedAt:g.deleted_at,deletionNote:g.deletion_note,frozen:!!g.frozen_at,freezeNote:g.freeze_note??'',adminNote:g.admin_note??''}));
});

export const changeGymDeletion=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(input=>z.object({gymId:z.string().uuid(),deleted:z.boolean(),note:z.string().trim().max(1000).default('')}).strict().parse(input)).handler(async({data,context})=>{
  const {error}=await context.supabase.rpc('set_gym_deleted',{g:data.gymId,deleted:data.deleted,note:data.note});
  if(error)throw new Error(error.message);
  return true;
});

export const editAdminGym = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({gymId:z.string().uuid(),name:z.string().trim().min(1).max(100)}).strict().parse(input))
  .handler(async ({data,context}) => {
    const {data:allowed,error:roleError}=await context.supabase.rpc('is_super_admin');
    if(roleError || !allowed) throw new Error('Administrator access required');
    const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
    const {data:gym,error}=await supabaseAdmin.from('gyms').select('id').eq('id',data.gymId).maybeSingle();
    if(error || !gym) throw new Error('Gym not found.');
    const {error:updateError}=await supabaseAdmin.from('gyms').update({name:data.name}).eq('id',gym.id);
    if(updateError) throw new Error('Could not save gym details.');
    return true;
  });

export const deleteGymAccount=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(input=>z.object({gymId:z.string().uuid()}).parse(input)).handler(async({data,context})=>{
  const {data:allowed,error:roleError}=await context.supabase.rpc('is_super_admin');
  if(roleError||!allowed)throw new Error('Administrator access required');
  const {data:target,error}=await context.supabase.rpc('disable_gym_account',{g:data.gymId});
  if(error)throw new Error(error.message);
  const parsed=z.object({ownerId:z.string().uuid(),disableOwner:z.boolean()}).parse(target);
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  await deactivateDedicatedOwner(parsed,(id,attributes)=>supabaseAdmin.auth.admin.updateUserById(id,attributes));
  return {ownerDisabled:parsed.disableOwner};
});

export const savePlatformContact=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(input=>z.object({whatsapp:z.string().trim().max(20).refine(v=>!v||/^\+?[0-9 ()-]{6,20}$/.test(v),'Enter a valid contact number')}).parse(input)).handler(async({data,context})=>{
  const {data:allowed}=await context.supabase.rpc('is_super_admin');if(!allowed)throw new Error('Administrator access required');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {error}=await supabaseAdmin.from('platform_settings').upsert({id:true,whatsapp:data.whatsapp});if(error)throw new Error('Could not save the contact number.');return true;
});

export const setGymFrozen=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(input=>z.object({gymId:z.string().uuid(),frozen:z.boolean(),note:z.string().max(1000).optional()}).parse(input)).handler(async({data,context})=>{
  const {data:allowed}=await context.supabase.rpc('is_super_admin');if(!allowed)throw new Error('Administrator access required');
  const {error}=await context.supabase.rpc('set_gym_frozen',{g:data.gymId,frozen:data.frozen,note:data.note??''});
  if(error)throw new Error(error.message);return true;
});

export const markPlatformNotificationsRead=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(input=>z.object({ids:z.array(z.string().uuid()).max(1000)}).parse(input)).handler(async({data,context})=>{
  const {data:allowed}=await context.supabase.rpc('is_super_admin');if(!allowed)throw new Error('Administrator access required');
  if(!data.ids.length)return true;
  const {error}=await context.supabase.from('platform_request_notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',context.userId).in('id',data.ids);if(error)throw new Error('Could not mark notifications as read.');return true;
});
export const setGymAdminNote=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(input=>z.object({gymId:z.string().uuid(),note:z.string().trim().max(2000)}).strict().parse(input)).handler(async({data,context})=>{
  const {data:allowed}=await context.supabase.rpc('is_super_admin');if(!allowed)throw new Error('Administrator access required');
  const {error}=await context.supabase.rpc('set_gym_admin_note',{g:data.gymId,note:data.note});
  if(error)throw new Error('Could not save note.');
  return {ok:true};
});

export const setGymDeletionNote=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(input=>z.object({gymId:z.string().uuid(),note:z.string().trim().max(1000)}).strict().parse(input)).handler(async({data,context})=>{
  const {data:allowed}=await context.supabase.rpc('is_super_admin');if(!allowed)throw new Error('Administrator access required');
  const {error}=await context.supabase.rpc('set_gym_deletion_note',{g:data.gymId,note:data.note});
  if(error)throw new Error('Could not save deletion reason.');
  return {ok:true};
});
