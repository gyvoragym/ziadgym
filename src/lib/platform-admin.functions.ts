import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { reauthenticateAdminChange } from './platform-admin-auth';
import { deactivateDedicatedOwner } from './gym-deactivation';
import { platformPlanSchema, planEndDate } from './platform-subscriptions';

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
export const getPlatformOverview=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {data:allowed,error:roleError}=await context.supabase.rpc('is_super_admin');
  if(roleError||!allowed)throw new Error('Administrator access required.');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const [{data:requests,error:requestError},{data:gyms,error:gymError},{count:clients,error:clientError}]=await Promise.all([
    supabaseAdmin.from('owner_requests').select('status,gym_id'),
    supabaseAdmin.from('gyms').select('id,deleted_at,frozen_at'),
    supabaseAdmin.from('profiles').select('id',{count:'exact',head:true}).eq('account_type','client').is('disabled_at',null),
  ]);
  if(requestError||gymError||clientError)throw new Error('Could not load platform statistics.');
  const approvedGymIds=new Set((requests??[]).filter(request=>request.status==='Approved'&&request.gym_id).map(request=>request.gym_id as string));
  const approvedGyms=(gyms??[]).filter(gym=>approvedGymIds.has(gym.id)&&!gym.deleted_at);
  return {
    approvedGyms:approvedGyms.length,
    activeGyms:approvedGyms.filter(gym=>!gym.frozen_at).length,
    frozenGyms:approvedGyms.filter(gym=>!!gym.frozen_at).length,
    clients:clients??0,
    pendingRequests:(requests??[]).filter(request=>request.status==='Pending').length,
  };
});
export const listAdminGyms=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {data:allowed}=await context.supabase.rpc('is_super_admin');if(!allowed)throw new Error('Administrator access required');
  const {data:gyms,error}=await context.supabase.from('gyms').select('id,name,owner_id,created_at,frozen_at,freeze_note,deleted_at,deletion_note,admin_note').order('created_at',{ascending:true});
  if(error)throw new Error('Could not load gyms.');
  const ids=[...new Set((gyms??[]).map(g=>g.owner_id))];
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {data:profiles}=ids.length?await supabaseAdmin.from('profiles').select('id,full_name,email,phone').in('id',ids):{data:[] as {id:string;full_name:string;email:string;phone:string}[]};
  const {data:requests,error:requestError}=await supabaseAdmin.from('owner_requests').select('gym_id,plan,status,phone,decided_at,request_plan_id,request_billing_type,request_duration_days,request_price,subscription_start,subscription_end,monthly_price,annual_price,annual_price_manual');
  if(requestError)throw new Error('Could not load approved gym subscriptions.');
  return (gyms??[]).filter(g=>g.deleted_at || requests?.some(r=>r.gym_id===g.id&&r.status==='Approved')).map(g=>{
    const request=requests?.find(r=>r.gym_id===g.id&&r.status==='Approved');
    const start=request?.subscription_start??request?.decided_at?.slice(0,10)??'';
    const duration=request?.request_duration_days??null;
    const price=request?.request_price??null;
    let end=request?.subscription_end??'';
    if(!end&&start&&duration)try{end=planEndDate(start,duration);}catch{end='';}
    const monthlyPrice=request?.monthly_price!=null?Number(request.monthly_price):price===null?null:request?.request_billing_type==='Annual'?price/12:price;
    const annualPrice=request?.annual_price!=null?Number(request.annual_price):price===null?null:request?.request_billing_type==='Annual'?price:price*12;
    return {
      id:g.id,name:g.name,ownerId:g.owner_id,ownerName:profiles?.find(p=>p.id===g.owner_id)?.full_name||'',ownerEmail:profiles?.find(p=>p.id===g.owner_id)?.email||'',ownerPhone:profiles?.find(p=>p.id===g.owner_id)?.phone||requests?.find(r=>r.gym_id===g.id)?.phone||'',
      plan:request?.plan??'',planId:request?.request_plan_id??'',billingType:request?.request_billing_type??'',durationDays:duration,
      monthlyPrice,annualPrice,annualPriceManual:request?.annual_price_manual??request?.request_billing_type==='Annual',
      subscriptionStart:start,subscriptionEnd:end,deleted:!!g.deleted_at,deletedAt:g.deleted_at,deletionNote:g.deletion_note,frozen:!!g.frozen_at,freezeNote:g.freeze_note??'',adminNote:g.admin_note??'',
    };
  });
});

export const changeGymDeletion=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(input=>z.object({gymId:z.string().uuid(),deleted:z.boolean(),note:z.string().trim().max(1000).default('')}).strict().parse(input)).handler(async({data,context})=>{
  const {error}=await context.supabase.rpc('set_gym_deleted',{g:data.gymId,deleted:data.deleted,note:data.note});
  if(error)throw new Error(error.message);
  return true;
});

export const editAdminGym = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({
    gymId:z.string().uuid(),
    name:z.string().trim().min(1).max(100),
    subscription:z.object({
      plan:z.string().trim().min(1).max(100),
      planId:z.string().max(100),
      billingType:z.enum(['Monthly','Annual']).nullable(),
      durationDays:z.number().int().positive().max(36500).nullable(),
      monthlyPrice:z.number().finite().min(0).max(100000000),
      annualPrice:z.number().finite().min(0).max(1200000000),
      annualPriceManual:z.boolean(),
      start:z.string().date(),
      end:z.string().date(),
      notes:z.string().trim().max(2000),
    }).refine(d=>d.end>=d.start,{message:'Subscription end date must not be before the start date.'}).optional(),
  }).strict().parse(input))
  .handler(async ({data,context}) => {
    const {data:allowed,error:roleError}=await context.supabase.rpc('is_super_admin');
    if(roleError || !allowed) throw new Error('Administrator access required');
    const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
    const {data:gym,error}=await supabaseAdmin.from('gyms').select('id').eq('id',data.gymId).maybeSingle();
    if(error || !gym) throw new Error('Gym not found.');
    const sub=data.subscription;
    const {error:updateError}=await supabaseAdmin.from('gyms').update(sub?{name:data.name,admin_note:sub.notes}:{name:data.name}).eq('id',gym.id);
    if(updateError) throw new Error('Could not save gym details.');
    if(sub){
      const {data:request,error:requestError}=await supabaseAdmin.from('owner_requests').select('id').eq('gym_id',gym.id).eq('status','Approved').maybeSingle();
      if(requestError||!request) throw new Error('This gym has no approved subscription to edit.');
      const {error:subError}=await supabaseAdmin.from('owner_requests').update({
        plan:sub.plan,request_plan_id:sub.planId||null,request_billing_type:sub.billingType,request_duration_days:sub.durationDays,
        request_price:sub.billingType==='Annual'?sub.annualPrice:sub.monthlyPrice,
        subscription_start:sub.start,subscription_end:sub.end,
        monthly_price:sub.monthlyPrice,annual_price:sub.annualPriceManual?sub.annualPrice:sub.monthlyPrice*12,annual_price_manual:sub.annualPriceManual,
      }).eq('id',request.id);
      if(subError) throw new Error('Could not save the subscription details.');
    }
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

export const savePlatformContact=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(input=>z.object({
  whatsapp:z.string().trim().max(20).refine(v=>!v||/^\+?[0-9 ()-]{6,20}$/.test(v),'Enter a valid contact number'),
  name:z.string().trim().min(1).max(100),
  logo:z.string().max(8000),
}).strict().parse(input)).handler(async({data,context})=>{
  const {data:allowed}=await context.supabase.rpc('is_super_admin');if(!allowed)throw new Error('Administrator access required');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {error}=await supabaseAdmin.from('platform_settings').upsert({id:true,whatsapp:data.whatsapp,name:data.name,logo:data.logo});if(error)throw new Error('Could not save platform settings.');return true;
});

export const getAvailableSubscriptionPlans=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {data:plans,error}=await context.supabase.from('platform_subscription_plans').select('id,name,billing_type,price,duration_days').eq('active',true).order('name');
 if(error)throw new Error('Could not load subscription plans.');
 return (plans??[]).map(plan=>({id:plan.id,name:plan.name,billingType:plan.billing_type as 'Monthly'|'Annual',price:plan.price,durationDays:plan.duration_days}));
});

export const listAdminSubscriptionPlans=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {data:allowed,error:roleError}=await context.supabase.rpc('is_super_admin');
 if(roleError||!allowed)throw new Error('Administrator access required.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:plans,error}=await supabaseAdmin.from('platform_subscription_plans').select('*').order('created_at');
 if(error)throw new Error('Could not load subscription plans.');
 return (plans??[]).map(plan=>({id:plan.id,name:plan.name,billingType:plan.billing_type as 'Monthly'|'Annual',price:plan.price,durationDays:plan.duration_days,active:plan.active}));
});

export const saveAdminSubscriptionPlan=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator(input=>z.object({...platformPlanSchema.shape,active:z.boolean()}).strict().parse(input))
 .handler(async({data,context})=>{
  const {data:allowed,error:roleError}=await context.supabase.rpc('is_super_admin');
  if(roleError||!allowed)throw new Error('Administrator access required.');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {error}=await supabaseAdmin.from('platform_subscription_plans').upsert({
   id:data.id,name:data.name,billing_type:data.billingType,price:data.price,duration_days:data.durationDays,active:data.active,updated_at:new Date().toISOString(),
  });
  if(error)throw new Error('Could not save subscription plan.');
  return true;
 });

export const setAdminSubscriptionPlanActive=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator(input=>z.object({id:z.string().min(1),active:z.boolean()}).strict().parse(input))
 .handler(async({data,context})=>{
  const {data:allowed,error:roleError}=await context.supabase.rpc('is_super_admin');
  if(roleError||!allowed)throw new Error('Administrator access required.');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {error}=await supabaseAdmin.from('platform_subscription_plans').update({active:data.active,updated_at:new Date().toISOString()}).eq('id',data.id);
  if(error)throw new Error('Could not update subscription plan.');
  return true;
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
