import { useEffect, useState } from 'react';
import { Link2, Unlink, Smartphone, Chrome, Apple } from 'lucide-react';
import { Button } from './ui/button';
import { getDemoSession } from '@/lib/demo';
import { supabase } from '@/integrations/supabase/client';

export function PlatformAccountLinks({open}:{open:boolean}) {
  const demo=!!getDemoSession();
  const [linked,setLinked]=useState<string[]>([]);
  const [status,setStatus]=useState('Checking connection status…');
  useEffect(()=>{
    let active=true;
    if(!open)return;
    setLinked([]);
    if(demo){setStatus('Unavailable in demo · no authenticated account');return;}
    setStatus('Checking connection status…');
    void supabase.auth.getUser().then(({data,error})=>{
      if(!active)return;
      if(error||!data.user){setStatus('Connection status could not be verified.');return;}
      const providers=(data.user.identities??[]).filter(i=>i.provider==='google'||i.provider==='apple').map(i=>i.provider);
      if(data.user.phone&&data.user.phone_confirmed_at)providers.push('phone');
      setLinked(providers);setStatus('Not connected');
    }).catch(()=>{if(active)setStatus('Connection status could not be verified.');});
    return()=>{active=false;};
  },[open,demo]);
  return <section className="mt-4 border-t pt-4"><h2 className="font-semibold">Linked accounts</h2>
    <div className="mt-3 divide-y">{([{key:'google',name:'Google',icon:Chrome},{key:'apple',name:'Apple',icon:Apple},{key:'x',name:'X (Twitter)',icon:Link2},{key:'phone',name:'Phone Number',icon:Smartphone}] as const).map(provider=>{
      const connected=linked.includes(provider.key);
      return <div key={provider.key} className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-start gap-3"><provider.icon className="mt-1 h-4 w-4 shrink-0"/><div><div className="text-sm font-medium">{provider.name}</div><p className="text-xs text-muted-foreground">{connected?'Connected · confirmed by authentication provider':status}</p></div></div>
      <Button type="button" size="sm" variant="outline" disabled title="Secure account linking is unavailable in this prototype">{connected?<Unlink className="h-4 w-4"/>:<Link2 className="h-4 w-4"/>}{connected?'Unlink':'Link'}</Button></div>;
    })}</div>
    <p className="mt-2 text-xs text-muted-foreground">Google and Apple: sign-in works through the app's secure sign-in service, but linking a provider to an account you're already signed in to needs manual identity linking, which that service doesn't offer yet. Signing in with a provider never merges into, replaces or duplicates this account's role or gym access.</p>
    <p className="mt-2 text-xs text-muted-foreground">X (Twitter): unavailable — the app's sign-in service does not support X. It would need X added as a provider, with an X developer app key, secret and callback address.</p>
    <p className="mt-2 text-xs text-muted-foreground">Phone: a configured SMS provider and a verified phone-linking flow are required. Phone linking is unavailable; no SMS is sent and sign-in remains unchanged.</p>
  </section>;
}