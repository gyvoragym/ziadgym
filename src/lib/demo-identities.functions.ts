import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

// Public allocation reserves numbers only: never contacts, sessions or gym access.
export const reserveDemoIdentities = createServerFn({ method: 'POST' })
  .inputValidator(input => z.object({ installation: z.string().uuid(), identities: z.array(z.object({ kind: z.enum(['G', 'C']), key: z.string().uuid() })).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: rows, error } = await supabaseAdmin.rpc('reserve_demo_gyvora_ids', data);
    if (error) throw new Error('Could not reserve permanent demo IDs. Please try again.');
    return z.array(z.object({ kind: z.enum(['G', 'C']), key: z.string(), id: z.string() })).parse(rows);
  });