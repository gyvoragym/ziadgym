import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { invoiceSchema, scheduleSchema } from './gym-updates';
import { productSchema, validateProductChanges } from './product-sales';
import { membershipEmailSchema, planSchema, programSchema, recurringSchema, sessionSchema, text } from './validation';
import { isGyvoraId } from './gyvora-id';
import { accountQrLookupId } from './account-qr-payload';
import { requireLookupSession } from './session-middleware';

const areas: Record<string,string> = {gym:'Profile', members:'Members',plans:'Members',workouts:'Workout programs',sessions:'Sessions',attendance:'Attendance',staffAttendance:'Attendance',products:'Products',trainers:'Workout programs',recurring:'Finance',transactions:'Finance'};
const memberSchema = z.object({id:text,name:text,email:membershipEmailSchema,phone:z.string().max(30),plan:text,type:z.enum(['Limited','Unlimited']),start:z.string().date(),expiry:z.string().date(),sessionsTotal:z.number().int().min(0).max(999),sessionsLeft:z.number().int().min(0).max(999),trainer:z.string().max(100),notes:z.string().max(1000),clientId:z.string().uuid().optional(),memberQrId:z.string().uuid().optional(),planPrice:z.number().min(0).optional(),createdByName:z.string().max(100).optional()}).passthrough().refine(m=>m.expiry>m.start,'End date must be after start date');
const attendanceSchema = z.object({id:text,name:text,role:z.string().max(100).optional(),date:z.string().date(),time:z.string().regex(/^\d{2}:\d{2}$/),memberId:z.string().optional(),staffId:z.string().uuid().optional(),method:z.enum(['QR','Manual'])});
const schemas: Record<string,z.ZodTypeAny> = {products:productSchema,transactions:invoiceSchema,trainers:z.object({id:text,name:text,schedule:scheduleSchema.optional()}).passthrough(),plans:planSchema,workouts:programSchema,sessions:sessionSchema,recurring:recurringSchema,members:memberSchema,attendance:attendanceSchema,staffAttendance:attendanceSchema};

export const saveRecords = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator(input=>z.object({gymId:z.string().uuid(),changes:z.array(z.object({kind:z.enum(['gym','members','products','trainers','plans','workouts','sessions','attendance','staffAttendance','recurring','transactions']),rows:z.array(z.record(z.unknown())).max(10000),expected:z.array(z.record(z.unknown())).max(10000)})).min(1)}).parse(input))
 .handler(async({data,context})=>{
  for(const c of data.changes) { const area=areas[c.kind]; if(!area)throw new Error('Invalid record type'); const {data: allowed,error}=await context.supabase.rpc('gym_access',{g:data.gymId,area}); if(error||!allowed) throw new Error('You do not have permission to change this gym data.'); const schema=schemas[c.kind]; c.rows=c.rows.map(r=>schema ? schema.parse(r) : r); if(c.kind==='products')validateProductChanges(c.expected.map(r=>productSchema.parse(r)),c.rows.map(r=>productSchema.parse(r))); if(c.kind==='gym')for(const row of c.rows){const zone=(row['preferences'] as {timeZone?:string}|undefined)?.timeZone;if(zone)try{new Intl.DateTimeFormat('en',{timeZone:zone});}catch{throw new Error('Choose a valid gym time zone');}} }
  const {error}=await context.supabase.rpc('save_gym_records',{g:data.gymId,changes:data.changes as never}); if(error) throw new Error(error.message); const {data:records,error:readError}=await context.supabase.from('gym_records').select('kind,data').eq('gym_id',data.gymId);if(readError)throw new Error(readError.message);return {saved:true,records};
 });

export const getReportingEvents = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator(input => z.object({gymId:z.string().uuid()}).parse(input))
 .handler(async ({data,context}) => { const {data:events,error}=await context.supabase.rpc('gym_reporting_events',{g:data.gymId}); if(error)throw new Error(error.message); return events as unknown as import('./gym-reporting').MembershipEvent[]; });

export const lookupClient = createServerFn({method:'POST'}).middleware([requireLookupSession, requireSupabaseAuth])
 .inputValidator(input=>z.object({gymId:z.string().uuid(),memberId:z.string().trim().min(1).refine(v=>isGyvoraId(accountQrLookupId(v))||v.length<=255,'Lookup text is too long')}).parse(input))
 .handler(async({data,context})=>{
  const {data:accessible}=await context.supabase.rpc('gym_access',{g:data.gymId,area:'Members'});if(!accessible)throw new Error('Gym access unavailable');
  const {data:owner,error:roleError}=await context.supabase.from('user_roles').select('id').eq('user_id',context.userId).eq('gym_id',data.gymId).eq('role','Owner').maybeSingle();
  if(roleError||!owner)throw new Error('Only gym owners can look up existing clients');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const value=accountQrLookupId(data.memberId);
  let query=supabaseAdmin.from('profiles').select('id,member_id,gyvora_id,full_name,email,phone').in('account_type',['client','staff']).is('disabled_at',null);
  if(isGyvoraId(value)) {
    const {data:reservation,error:reservationError}=await supabaseAdmin.from('gyvora_id_registry').select('account_id').eq('gyvora_id',value).eq('kind','C').maybeSingle();
    if(reservationError)throw new Error('Client lookup failed. Please try again.');
    if(!reservation)throw new Error('No existing client found with this GYVORA ID');
    query=query.eq('id',reservation.account_id);
  }
  else if(z.string().uuid().safeParse(value).success)query=query.or(`id.eq.${value},member_id.eq.${value}`);
   else if(z.string().email().safeParse(value).success)query=query.ilike('email',value.replace(/[%_]/g,'\\$&'));
   else if(/^\+?[0-9 ()-]{6,30}$/.test(value))query=query.eq('phone',value);
   else query=query.ilike('full_name',value.replace(/[%_]/g,'\\$&'));
  const {data:matches,error}=await query.limit(20);
  if(error)throw new Error('Client lookup failed. Please try again.');
  if((matches?.length??0)>1)throw new Error('More than one account has this name. Use the intended user ID, QR code or email.');
  const p=matches?.[0];
  if(!p)throw new Error('No existing client found with this user ID, name, QR code or email');
  return p;
 });

export const lookupSessionClient = createServerFn({method:'POST'}).middleware([requireLookupSession, requireSupabaseAuth])
 .inputValidator(input=>z.object({gymId:z.string().uuid(),memberId:z.string().trim().min(1).refine(v=>isGyvoraId(accountQrLookupId(v))||v.length<=255,'Lookup text is too long')}).parse(input))
 .handler(async({data,context})=>{
  const {data:accessible}=await context.supabase.rpc('gym_access',{g:data.gymId,area:'Sessions'});if(!accessible)throw new Error('Gym access unavailable');
  const {data:owner,error:roleError}=await context.supabase.from('user_roles').select('id').eq('user_id',context.userId).eq('gym_id',data.gymId).eq('role','Owner').maybeSingle();
  if(roleError||!owner)throw new Error('Only gym owners can look up existing clients');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const value=accountQrLookupId(data.memberId);
  let query=supabaseAdmin.from('profiles').select('id,member_id,gyvora_id,full_name,email,phone').eq('account_type','client').is('disabled_at',null);
  if(isGyvoraId(value)) {
    const {data:reservation,error:reservationError}=await supabaseAdmin.from('gyvora_id_registry').select('account_id').eq('gyvora_id',value).eq('kind','C').maybeSingle();
    if(reservationError)throw new Error('Client lookup failed. Please try again.');
    if(!reservation)throw new Error('No existing client found with this GYVORA ID');
    query=query.eq('id',reservation.account_id);
  }
  else if(z.string().uuid().safeParse(value).success)query=query.or(`id.eq.${value},member_id.eq.${value}`);
  else if(z.string().email().safeParse(value).success)query=query.ilike('email',value.replace(/[%_]/g,'\\$&'));
  else if(/^\+?[0-9 ()-]{6,30}$/.test(value))query=query.eq('phone',value);
  else query=query.ilike('full_name',value.replace(/[%_]/g,'\\$&'));
  const {data:matches,error}=await query.limit(20);
  if(error)throw new Error('Client lookup failed. Please try again.');
  if((matches?.length??0)>1)throw new Error('More than one account has this name. Use the intended user ID, QR code or email.');
  const profile=matches?.[0];
  if(!profile)throw new Error('No existing client found with this user ID, name, QR code or email');
  return profile;
 });

export const manageInvitation = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator(input=>z.object({gymId:z.string().uuid(),action:z.enum(['create','resend','cancel']),id:z.string().uuid().optional(),name:text.optional(),email:z.string().trim().email().max(255).optional(),userId:z.string().uuid().optional(),permissions:z.array(z.string().max(50)).optional(),role:z.enum(['Admin','Reception','Trainer']).optional()}).parse(input))
 .handler(async({data,context})=>{const {data:allowed}=await context.supabase.rpc('gym_access',{g:data.gymId,area:'Settings'}); const {data:owner}=await context.supabase.from('user_roles').select('id').eq('user_id',context.userId).eq('gym_id',data.gymId).eq('role','Owner').maybeSingle(); if(!allowed||!owner)throw new Error('Only gym owners can manage invitations'); const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  if(data.action==='create'){
   if(!data.userId||!data.role)throw new Error('Look up and confirm an existing user');
   const {data:person,error:personError}=await supabaseAdmin.from('profiles').select('id,full_name,email').eq('id',data.userId).in('account_type',['client','staff']).is('disabled_at',null).single();
   if(personError||!person)throw new Error('Existing user unavailable');
   const {data:existing}=await supabaseAdmin.from('user_roles').select('id').eq('gym_id',data.gymId).eq('user_id',person.id).maybeSingle();
   if(existing)throw new Error('This user already has a role at this gym');
   const pages=['Members','Attendance','Sessions','Finance','Workout programs','Settings','Products','Profile'];
   const permissions=data.permissions??[];
   if(permissions.some(p=>!pages.includes(p)&&!pages.some(a=>['create','edit','delete'].some(x=>p===`${a}:${x}`))))throw new Error('Invalid permission');
   if(permissions.some(p=>p.includes(':')&&!permissions.includes(p.split(':')[0]??'')))throw new Error('Select page access before its actions');
   const {error}=await supabaseAdmin.from('staff_invitations').insert({gym_id:data.gymId,full_name:person.full_name,email:person.email.toLowerCase(),invited_user_id:person.id,role:data.role,permissions});if(error)throw new Error(error.code==='23505'?'An active invitation already exists for this user.':error.message);
  }
  else {if(!data.id)throw new Error('Invitation required');const {error}=await supabaseAdmin.from('staff_invitations').update(data.action==='cancel'?{status:'Cancelled'}:{expires_at:new Date(Date.now()+7*86400000).toISOString()}).eq('id',data.id).eq('gym_id',data.gymId).eq('status','Pending');if(error)throw new Error(error.message);}
  return {emailSent:false};
 });

export const manageStaff = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator(input=>z.object({gymId:z.string().uuid(),id:z.string().uuid(),remove:z.boolean(),role:z.enum(['Admin','Reception','Trainer']),permissions:z.array(z.string().refine(p=>['Members','Attendance','Sessions','Finance','Workout programs','Settings','Products','Profile'].some(a=>p===a||['create','edit','delete'].some(x=>p===`${a}:${x}`)))),name:text,phone:z.string().max(30)}).parse(input))
 .handler(async({data,context})=>{const {data:allowed}=await context.supabase.rpc('gym_access',{g:data.gymId,area:'Settings'});const {data:owner}=await context.supabase.from('user_roles').select('id').eq('user_id',context.userId).eq('gym_id',data.gymId).eq('role','Owner').maybeSingle(); if(!allowed||!owner)throw new Error('Only gym owners can manage staff');const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const {error}=data.remove?await supabaseAdmin.from('user_roles').delete().eq('id',data.id).eq('gym_id',data.gymId).in('role',['Admin','Reception','Trainer']):await supabaseAdmin.from('user_roles').update({role:data.role,permissions:data.permissions,display_name:data.name,phone:data.phone}).eq('id',data.id).eq('gym_id',data.gymId).in('role',['Admin','Reception','Trainer']);if(error)throw new Error(error.message);return true;});

export const getStaff = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(input=>z.object({gymId:z.string().uuid()}).parse(input)).handler(async({data,context})=>{const {data:ok}=await context.supabase.rpc('gym_access',{g:data.gymId,area:'Attendance'});const {data:owner}=await context.supabase.rpc('gym_access',{g:data.gymId,area:'Settings'});if(!ok&&!owner)throw new Error('Staff access required');const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const {data:roles,error}=await supabaseAdmin.from('user_roles').select('*').eq('gym_id',data.gymId).neq('role','Client');if(error)throw new Error(error.message); const ids=(roles??[]).map(r=>r.user_id);if(!ids.length)return [];const {data:profiles}=await supabaseAdmin.from('profiles').select('id,full_name,email,phone').in('id',ids);return (roles??[]).map(r=>({id:r.id,userId:r.user_id,role:r.role,permissions:r.permissions,name:r.display_name||profiles?.find(p=>p.id===r.user_id)?.full_name||'',email:profiles?.find(p=>p.id===r.user_id)?.email??'',phone:r.phone||profiles?.find(p=>p.id===r.user_id)?.phone||''}));});

export const requestSubscription=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator(input=>z.object({name:text,phone:z.string().trim().min(6).max(30).regex(/^\+?[0-9 ()-]+$/),planId:z.string().min(1).max(100)}).strict().parse(input))
 .handler(async({data,context})=>{
   const {data:request,error}=await context.supabase.rpc('submit_owner_request',{request_name:data.name,request_phone:data.phone,request_plan:data.planId});
   if(error)throw new Error(error.message);
   return request;
 });
