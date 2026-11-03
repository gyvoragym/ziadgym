import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Check, MessageCircle } from 'lucide-react';
import { useCloud } from '@/components/CloudProvider';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { subscriptionEntryStep, type SubscriptionStep } from '@/lib/subscription-steps';
import { requestSubscription } from '@/lib/cloud.functions';
import { getOwnerGate, startOwnerTrial } from '@/lib/owner-gate.functions';
import { trialActive, trialExpired, type OwnerGate } from '@/lib/trial';
import { DEFAULT_PLATFORM_WHATSAPP, whatsappLink } from '@/lib/demo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/kit';
import { seo } from '@/lib/seo';
import logo from '@/assets/gyvora-logo.png';
import { readPreviewSession } from '@/lib/preview-session';
import { PrototypeSubscriptionRequest } from '@/components/PrototypeSubscriptionRequest';

export const Route = createFileRoute('/subscription-request')({
  head: () => seo('Gym subscription request', 'Choose a Monthly or Annual GYVORA subscription and request administrator approval.'),
  component: Request,
});
const plans = [
  { value: 'Monthly Plan', label: 'Monthly Subscription', detail: 'Subscription renewed every month' },
  { value: 'Annual Plan', label: 'Annual Subscription', detail: 'Subscription renewed every year' },
] as const;
type SavedRequest = Database['public']['Tables']['owner_requests']['Row'];
type Step = SubscriptionStep;

function Request() {
  return readPreviewSession()?.type === 'gym' ? <PrototypeSubscriptionRequest/> : <SavedSubscriptionRequest/>;
}
function SavedSubscriptionRequest() {
  const c = useCloud();
  const navigate = useNavigate();
  const submit = useServerFn(requestSubscription);
  const fetchGate = useServerFn(getOwnerGate);
  const startTrial = useServerFn(startOwnerTrial);
  const [request, setRequest] = useState<SavedRequest | null>(null);
  const [step, setStep] = useState<Step>('selection');
  const stepRef = useRef<Step>('selection');
  const [loaded,setLoaded] = useState(false);
  const [name,setName] = useState('');
  const [phone,setPhone] = useState('');
  const [plan,setPlan] = useState('');
  const [whatsapp,setWhatsapp] = useState('');
  const [gate,setGate] = useState<OwnerGate | null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  function go(next:Step) { stepRef.current=next; setStep(next); }
  useEffect(() => {
    if (!c.profile) return;
    let alive=true;
    async function load(initial=false) {
      const {data,error:readError} = await supabase.from('owner_requests').select('*').eq('user_id',c.profile?.id ?? '').maybeSingle();
      if (!alive) return;
      if(readError) { setError('Could not load your saved request. Please reload.'); return; }
      setRequest(data);
      if(initial) {setName(data?.gym_name ?? '');setPhone(data?.phone || c.profile?.phone || '');setPlan(data?.plan ?? '');go(subscriptionEntryStep(data));setLoaded(true);}
      try {const next=await fetchGate({});if(alive)setGate(next);} catch {if(alive)setError('Could not verify saved gym access. Please reload.');}
    }
    void load(true);
    void supabase.from('platform_settings').select('whatsapp').eq('id',true).maybeSingle().then(({data})=>{if(alive)setWhatsapp(data?.whatsapp || DEFAULT_PLATFORM_WHATSAPP);});
    const timer=window.setInterval(()=>{if(stepRef.current==='status')void load();},10000);
    const focus=()=>{if(stepRef.current==='status')void load();};window.addEventListener('focus',focus);
    return ()=>{alive=false;window.clearInterval(timer);window.removeEventListener('focus',focus);};
  },[c.profile?.id]);
  async function send() {
    setBusy(true);setError('');
    try {
      const saved=await submit({data:{name,phone,plan:plan as 'Monthly Plan' | 'Annual Plan'}});
      setRequest(saved);go('sent');
    } catch(e){setError(e instanceof Error?e.message:'Could not save the request.');}
    finally{setBusy(false);}
  }
  async function skip() {
    setBusy(true);setError('');
    try {await startTrial({});await c.refresh();await navigate({to:'/dashboard'});}
    catch(e){setError(e instanceof Error?e.message:'Could not start the trial.');}
    finally{setBusy(false);}
  }
  if (!loaded) return <p role="status" className="p-8 text-muted-foreground">{error || 'Loading your saved request…'}</p>;
  const index=step==='selection'?0:step==='sent'?1:2;
  const contact=<div className="mt-5 flex items-center gap-3 rounded-lg bg-surface px-4 py-3 text-xs text-muted-foreground"><MessageCircle className="h-4 w-4 shrink-0 text-success"/><p><a href={whatsappLink(whatsapp || DEFAULT_PLATFORM_WHATSAPP,'Hello, I have a question about my gym subscription request.')} target="_blank" rel="noopener noreferrer" className="text-primary">Contact us on WhatsApp.</a></p></div>;
  return <main className="subscription-wizard min-h-screen bg-background px-4 py-6 sm:px-8"><div className="mx-auto w-full max-w-[780px]">
    <nav aria-label="Subscription progress" className="mb-3"><p className="mb-3 text-xs font-semibold">{index+1} of 3 · {['Plan selection','Request sent','Pending approval'][index]}</p><div role="progressbar" aria-label="Subscription steps" aria-valuemin={0} aria-valuemax={3} aria-valuenow={index+1} className="h-1 overflow-hidden rounded-full bg-secondary"><div className={`h-full bg-primary ${index===0?'w-1/3':index===1?'w-2/3':'w-full'}`}/></div></nav>
    <section className="overflow-hidden rounded-lg border bg-card" aria-label="Gym subscription request">
      <header className="flex items-center gap-2 border-b px-5 py-3"><img src={logo} alt="GYVORA logo" width={28} height={28} className="h-7 w-7 rounded-lg object-contain"/><p className="text-sm"><strong>GYVORA</strong><span className="text-muted-foreground"> · Gym Account</span></p></header>
      <div className="mx-auto max-w-[616px] px-5 py-7 sm:px-0">
        {step==='selection'?<form onSubmit={e=>{e.preventDefault();void send();}}>
          <h1 className="text-xl font-semibold">Choose your gym subscription</h1>
          <div className="mt-4 space-y-3"><Field label="Gym name"><Input aria-label="Gym name" placeholder="Enter your gym name" value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></Field><Field label="Phone number"><Input aria-label="Phone number" type="tel" value={phone} maxLength={30} onChange={e=>setPhone(e.target.value)}/></Field></div>
          <fieldset className="mt-5 grid gap-3 sm:grid-cols-2"><legend className="sr-only">Subscription plan</legend>{plans.map(p=><label key={p.value} className={`relative cursor-pointer rounded-lg border px-4 py-6 ${plan===p.value?'border-primary bg-accent':'border-input bg-surface'}`}><input type="radio" name="plan" aria-label={p.label} value={p.value} checked={plan===p.value} onChange={()=>setPlan(p.value)} className="peer sr-only"/><span className="block text-sm font-semibold peer-focus-visible:outline">{p.label}</span><span className="mt-1 block text-xs text-muted-foreground">{p.detail}</span>{plan===p.value&&<Check className="absolute right-3 top-3 h-4 w-4 text-primary"/>}</label>)}</fieldset>
          {contact}<div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={()=>void c.logout()}>Cancel</Button><Button type="submit" disabled={busy||!plan||!name.trim()||!phone.trim()}>{busy?'Saving…':'Send Request'}</Button></div>
        </form>:step==='sent'?<div className="py-6 text-center"><Check className="mx-auto mb-4 h-12 w-12 text-success"/><h1 className="text-xl font-semibold">Request sent</h1><p role="status" className="mt-2 text-sm text-muted-foreground">Your request has been saved and is waiting for administrator approval.</p><p className="mt-3 text-sm">{request?.gym_name} · {request?.plan}</p><div className="mt-5 flex flex-wrap justify-center gap-2"><Button variant="secondary" onClick={()=>go('status')}>Done</Button><Button disabled={busy} onClick={()=>void skip()}>Skip — Enter Dashboard</Button></div><p className="mt-3 text-xs text-muted-foreground">Skip starts the saved one-hour trial once. It does not approve the request or mark it as paid.</p></div>:<div>
          <h1 className="text-xl font-semibold">{request?.status==='Approved'?'Subscription approved':request?.status==='Rejected'?'Request rejected':'Subscription approval pending'}</h1>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border bg-surface p-4 text-sm"><dt>Status</dt><dd>{request?.status}</dd><dt>Gym</dt><dd className="break-words">{request?.gym_name}</dd><dt>Phone</dt><dd>{request?.phone}</dd><dt>Plan</dt><dd>{request?.plan}</dd><dt>Submitted</dt><dd>{request?.created_at.slice(0,10)}</dd></dl>
          {request?.status==='Rejected'&&<p role="status" className="mt-4 text-sm text-muted-foreground">Your request was rejected. Edit your details and resubmit for review.</p>}
          {request?.status==='Rejected'&&request.decision_note?.trim()&&<p className="mt-2 whitespace-pre-wrap break-words rounded-md border bg-card p-3 text-sm"><span className="font-medium">Reason: </span>{request.decision_note}</p>}
          {gate&&trialExpired(gate)&&<p role="status" className="mt-4 text-sm text-muted-foreground">Your trial period has ended. Your request is awaiting administrator approval.</p>}
          {contact}<div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={()=>void c.logout()}>Back to login</Button>{request?.status==='Rejected'&&<Button onClick={()=>go('selection')}>Edit</Button>}{request?.status==='Approved'&&<Button asChild><Link to="/dashboard">Open your gym</Link></Button>}{gate&&trialActive(gate)&&<Button disabled={busy} onClick={()=>void skip()}>Continue to Dashboard</Button>}</div>
        </div>}
        {error&&<p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      </div><footer className="flex justify-between gap-3 border-t px-5 py-3 text-xs text-muted-foreground"><span>GYVORA · Gym subscription request</span><span>Screen {index+1} / 3</span></footer>
    </section>
  </div></main>;
}
