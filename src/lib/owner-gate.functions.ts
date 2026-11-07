import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { OwnerGate } from './trial';

/** Server-side gate state for a gym owner: request status, freeze state and trial times (server clock). */
export const getOwnerGate = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc('owner_gate_state');
  if (error) throw new Error('Could not load your gym access state.');
  return data as unknown as OwnerGate;
});

/** Starts the one-hour pending-approval trial exactly once; later calls return the existing times. */
export const startOwnerTrial = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc('start_owner_trial');
  if (error) throw new Error('Could not start the trial. Please try again.');
  return data as unknown as OwnerGate;
});
