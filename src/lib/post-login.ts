import { supabase } from '@/integrations/supabase/client';

export type Destination = '/super-admin' | '/member' | '/gyms' | '/dashboard' | '/subscription-request';

/** Pure routing rule after a successful provider sign-in. */
export function destinationFor(accountType: string | null | undefined, roles: Array<{ role: string; gym_id: string | null }>): Destination {
  if (roles.some(r => r.role === 'super_admin')) return '/super-admin';
  const gymRoles = roles.filter(r => r.gym_id);
  if (accountType === 'client') return '/member';
  if (accountType === 'owner') {
    const owned = gymRoles.filter(r => r.role === 'Owner');
    if (owned.length === 0) return '/subscription-request';
    return gymRoles.length > 1 ? '/gyms' : '/dashboard';
  }
  // Staff and clients share the member-facing portal; gym roles remain unchanged.
  return '/member';
}

export async function resolveDestination(): Promise<Destination> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return '/member';
  const [{ data: roles }, { data: p }] = await Promise.all([
    supabase.from('user_roles').select('role,gym_id').eq('user_id', user.id),
    supabase.from('profiles').select('account_type').eq('id', user.id).single(),
  ]);
  return destinationFor(p?.account_type, roles ?? []);
}
