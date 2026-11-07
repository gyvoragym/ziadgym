import { useQuery } from '@tanstack/react-query';
import { getDemoSession } from './demo';
import { isSupabaseClientConfigured } from './supabase-availability';
import { readPreviewSession } from './preview-session';
import { supabase } from '@/integrations/supabase/client';

export function usePlatformSettings() {
  const isPrototype = !!getDemoSession() || !!readPreviewSession();
  const query = useQuery({
    queryKey: ['platform-branding'],
    enabled: !isPrototype && isSupabaseClientConfigured(),
    queryFn: async () => {
      const { data, error } = await supabase.from('platform_settings').select('name,logo,whatsapp').eq('id', true).maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
  return { ...query, data: isPrototype ? undefined : query.data };
}
