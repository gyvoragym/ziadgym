import { createMiddleware } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { currentSessionToken } from './session-token';
import { readPreviewSession } from './preview-session';
import { isSupabaseClientConfigured } from './supabase-availability';

export const attachCurrentSession = createMiddleware({ type: 'function' }).client(async ({ next }) => {
  if (readPreviewSession()) return next({ headers: {} });
  if (!isSupabaseClientConfigured()) return next({ headers: {} });
  const token = await currentSessionToken(supabase.auth);
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});

// Fail before sending a private lookup when the owner has no provider session.
export const requireLookupSession = createMiddleware({ type: 'function' }).client(async ({ next }) => {
  if (readPreviewSession()) throw new Error('Private account lookup is unavailable in preview.');
  const token = await currentSessionToken(supabase.auth, true);
  return next({ headers: { Authorization: `Bearer ${token}` } });
});