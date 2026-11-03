import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

/** Super Admin → account in-app messages and reversible client freeze. */
export const sendAccountMessage = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ target: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).strict().parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc('is_super_admin');
    if (!allowed) throw new Error('Administrator access required');
    const { error } = await context.supabase.rpc('send_account_message', { target: data.target, body: data.body });
    if (error) throw new Error(error.message);
    return true;
  });

export const listAccountMessages = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('account_messages')
      .select('id, body, created_at, read_at')
      .eq('recipient_id', context.userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error('Could not load messages');
    return data ?? [];
  });

export const setClientFrozen = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ target: z.string().uuid(), frozen: z.boolean(), note: z.string().trim().max(1000).default('') }).strict().parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc('is_super_admin');
    if (!allowed) throw new Error('Administrator access required');
    const { error } = await context.supabase.rpc('set_client_frozen', { target: data.target, frozen: data.frozen, note: data.note });
    if (error) throw new Error(error.message);
    return true;
  });

export const markAccountMessagesRead = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ ids: z.array(z.string().uuid()).max(500) }).strict().parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('mark_account_messages_read', { ids: data.ids });
    if (error) throw new Error('Could not update messages');
    return true;
  });
