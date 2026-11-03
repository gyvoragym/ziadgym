import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
export const getGymNotices = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ gymId: z.string().uuid(), day: z.string().date() }).parse(input)).handler(async ({ data, context }) => {
 const { error: expiryError } = await context.supabase.rpc('refresh_gym_expiration_events', { g: data.gymId, day: data.day }); if (expiryError) throw new Error('Could not load gym notifications.');
 const { data: events, error } = await context.supabase.from('gym_owner_events').select('*').eq('gym_id', data.gymId).order('created_at', { ascending: false }); if (error) throw new Error('Could not load gym notifications.');
 const { data: statuses, error: statusError } = await context.supabase.from('gym_owner_event_status').select('*').eq('user_id', context.userId); if (statusError) throw new Error('Could not load notification status.');
 return (events ?? []).map(e => ({ id: e.id, type: e.type, description: e.description, page: e.page, createdAt: e.created_at, read: !!statuses?.find(s => s.event_id === e.id)?.read_at, dismissed: !!statuses?.find(s => s.event_id === e.id)?.dismissed_at }));
});
export const changeGymNotices = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ gymId: z.string().uuid(), ids: z.array(z.string().uuid()).max(1000), dismiss: z.boolean() }).parse(input)).handler(async ({ data, context }) => {
 if (!data.ids.length) return true;
 const { data: rows, error } = await context.supabase.from('gym_owner_events').select('id').eq('gym_id', data.gymId).in('id', data.ids);
 if (error || rows?.length !== data.ids.length) throw new Error('Gym owner access required');
 const now = new Date().toISOString();
 const { error: saveError } = await context.supabase.from('gym_owner_event_status').upsert(data.ids.map(id => ({ event_id: id, user_id: context.userId, read_at: now, ...(data.dismiss ? { dismissed_at: now } : {}) }))); if (saveError) throw new Error('Could not update notifications.'); return true;
});