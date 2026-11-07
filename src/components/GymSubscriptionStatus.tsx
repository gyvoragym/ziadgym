import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDemoSession } from '@/lib/demo';
import { useCloud } from './CloudProvider';

export function GymSubscriptionStatus({ gymId }: { gymId: string }) {
  const c = useCloud();
  const [summary, setSummary] = useState<{status: string; plan: string} | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setSummary(null); setError('');
    if (!gymId || getDemoSession() || !c.profile) return;
    let active = true;
    void supabase.rpc('gym_subscription_summary', { g: gymId }).then(({ data, error }) => {
      if (!active) return;
      if (error) setError('Could not load gym subscription status. Please reload to try again.');
      else if (data && typeof data === 'object' && !Array.isArray(data)) {
        setSummary({status: String(data['status'] ?? 'Not recorded'), plan: String(data['plan'] ?? 'Not recorded')});
      }
    });
    return () => { active = false; };
  }, [gymId, c.profile?.id]);
  if (getDemoSession()) return null;
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  return <div className="space-y-1 text-sm"><p>Gym subscription: <span className="font-medium text-primary">{summary?.status ?? 'Loading…'}</span>{summary && ` · ${summary.plan}`}</p><p className="text-xs text-muted-foreground">Approval status only · No payment collected.</p></div>;
}