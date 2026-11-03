import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { reauthenticateAdminChange } from './platform-admin-auth';
export const changeGymCredentials = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ current: z.string().min(1).max(128), change: z.union([z.object({ email: z.string().trim().email().max(255) }).strict(), z.object({ password: z.string().min(8).max(128) }).strict()]) }).parse(input)).handler(async ({ data, context }) => {
 const { data: roles, error } = await context.supabase.from('user_roles').select('id').eq('user_id', context.userId).eq('role', 'Owner').limit(1);
 if (error || !roles?.length) throw new Error('Gym owner account required');
 await reauthenticateAdminChange(context.supabase.auth, context.userId, data.current, data.change);
 return true;
});