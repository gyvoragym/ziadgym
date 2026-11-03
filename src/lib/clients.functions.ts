import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { clientDetailsSchema } from './client-management';

const scope = z.object({gymId: z.string().uuid().optional()});
export const listClients = createServerFn({method: 'POST'}).middleware([requireSupabaseAuth])
  .inputValidator(input => scope.parse(input)).handler(async ({data, context}) => {
    const {data: enabled} = await context.supabase.rpc('otp_verified');
    if (!enabled) throw new Error('Account unavailable');
    const {data: admin} = await context.supabase.rpc('is_super_admin');
    if (data.gymId) {
      const {data: allowed} = await context.supabase.rpc('gym_access', {g: data.gymId, area: 'Members'});
      const {data: owner} = await context.supabase.from('user_roles').select('id').eq('gym_id', data.gymId).eq('user_id', context.userId).eq('role','Owner').maybeSingle();
      if (!allowed || !owner) throw new Error('Gym owner access required');
    } else if (!admin) throw new Error('Administrator access required');
    const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
    let query = supabaseAdmin.from('gym_records').select('client_id,gym_id').eq('kind','members').not('client_id','is',null);
    if (data.gymId) query = query.eq('gym_id', data.gymId);
    const {data: memberships, error: memberError} = await query;
    if (memberError) throw new Error('Could not load client memberships');
    const ids = [...new Set((memberships ?? []).flatMap(m => m.client_id ? [m.client_id] : []))];
    if (data.gymId && !ids.length) return [];
    let profiles = supabaseAdmin.from('profiles').select('id,gyvora_id,full_name,email,phone,photo,disabled_at,frozen_at,freeze_note').in('account_type',['client','staff']);
    if (data.gymId) profiles = profiles.in('id',ids);
    const {data: people,error} = await profiles.order('full_name');
    if (error) throw new Error('Could not load clients');
    const gymIds = [...new Set((memberships ?? []).map(m => m.gym_id))];
    const {data: gyms} = gymIds.length ? await supabaseAdmin.from('gyms').select('id,name').in('id',gymIds) : {data: []};
    return (people ?? []).map(p => ({...p, gyms: (memberships ?? []).filter(m => m.client_id === p.id).map(m => ({id: m.gym_id, name: gyms?.find(g => g.id === m.gym_id)?.name ?? 'Gym'}))}));
  });

export const updateClient = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator(input => scope.extend({id:z.string().uuid(),details:clientDetailsSchema}).parse(input))
  .handler(async ({data,context}) => {
    const {data: enabled} = await context.supabase.rpc('otp_verified');
    if (!enabled) throw new Error('Account unavailable');
    const {data: admin} = await context.supabase.rpc('is_super_admin');
    if (data.gymId) {
      const {data: allowed} = await context.supabase.rpc('gym_access',{g:data.gymId,area:'Members'});
      const {data: owner} = await context.supabase.from('user_roles').select('id').eq('gym_id',data.gymId).eq('user_id',context.userId).eq('role','Owner').maybeSingle();
      const {data: member} = await context.supabase.from('gym_records').select('id').eq('gym_id',data.gymId).eq('kind','members').eq('client_id',data.id).maybeSingle();
      if (!allowed || !owner || !member) throw new Error('Only clients of your gym can be edited');
    } else if (!admin) throw new Error('Administrator access required');
    const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
    const {data: profile,error: readError} = await supabaseAdmin.from('profiles').select('id,disabled_at').eq('id',data.id).in('account_type',['client','staff']).single();
    if (readError || !profile || profile.disabled_at) throw new Error('Client account unavailable');
    const {data: roles} = await supabaseAdmin.from('user_roles').select('id').eq('user_id',data.id).in('role',['Owner','super_admin']);
    if (roles?.length) throw new Error('Owner or administrator identities cannot be edited here');
    const {error: identityError} = await supabaseAdmin.auth.admin.updateUserById(data.id,{email:data.details.email});
    if (identityError) throw new Error('Could not update registered email. It may already be in use.');
    const {error} = await supabaseAdmin.from('profiles').update({full_name:data.details.name,phone:data.details.phone,photo:data.details.photo}).eq('id',data.id);
    if (error) throw new Error('Email updated, but profile details could not be saved. Please retry.');
    return true;
  });

export const deleteClientAccount = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator(input => scope.extend({id:z.string().uuid()}).parse(input)).handler(async ({data,context}) => {
    const {error} = await context.supabase.rpc('manage_client_lifecycle',{target:data.id,...(data.gymId ? {g:data.gymId} : {})});
    if (error) throw new Error(error.message);
    if (!data.gymId) {
      const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
      const {error: banError} = await supabaseAdmin.auth.admin.updateUserById(data.id,{ban_duration:'876000h'});
      if (banError) throw new Error('App access is blocked, but sign-in deactivation failed. Please retry Delete.');
      const {data: user} = await supabaseAdmin.auth.admin.getUserById(data.id);
      if (user.user) await supabaseAdmin.auth.admin.updateUserById(data.id,{user_metadata:{...user.user.user_metadata,account_disabled:true}});
    }
    return {accountDisabled:!data.gymId};
  });