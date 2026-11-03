import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Check, MessageCircle, RotateCcw } from 'lucide-react';
import { useCloud } from './CloudProvider';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Field } from './kit';
import { makeSampleRequest, prototypeTrialActive, readSampleRequest, resetSampleRequest, sampleEntryStep, saveSampleRequest, startSampleTrial, type SampleRequest } from '@/lib/prototype-scenario';
import { localDate } from '@/lib/gym-period';
import logo from '@/assets/gyvora-logo.png';
import { DEFAULT_PLATFORM_WHATSAPP, useDemoStore, whatsappLink } from '@/lib/demo';
import { readPreviewSession } from '@/lib/preview-session';

const plans = [
  { value: 'Monthly Plan', label: 'Monthly Subscription', detail: 'Subscription renewed every month' },
  { value: 'Annual Plan', label: 'Annual Subscription', detail: 'Subscription renewed every year' },
] as const;
const steps = ['Plan selection', 'Request sent', 'Pending approval'];

export function PrototypeSubscriptionRequest() {
  const c = useCloud();
  const navigate = useNavigate();
  const [request, setRequest] = useState<SampleRequest | null>(readSampleRequest);
  const [step, setStep] = useState<number>(() => sampleEntryStep(readSampleRequest()));
  const [name, setName] = useState(request?.gymName ?? '');
  const [plan, setPlan] = useState(request?.plan ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const activeTrial = prototypeTrialActive(request, now);
  const expiredTrial = request?.trialExpiresAt !== undefined && !activeTrial;
  const platform = useDemoStore(s => s);
  const gym = platform.gyms.find(g => g.email === readPreviewSession()?.scenarioKey);
  const contact = platform.platformWhatsapp || DEFAULT_PLATFORM_WHATSAPP;
  const blocked = request?.status === 'Rejected' || gym?.status === 'Frozen' || !!gym?.deletedAt;

  async function send() {
    setBusy(true);
    try {
      const row = readSampleRequest() ?? makeSampleRequest(name, plan, false, localDate());
      saveSampleRequest(row); setRequest(row); setError(''); setStep(1);
      await c.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the fictional request.'); }
    finally { setBusy(false); }
  }
  async function skip() {
    if (!request) return;
    setBusy(true);
    try {
      const row = startSampleTrial(readSampleRequest() ?? request);
      saveSampleRequest(row); setRequest(row); setError('');
      await c.refresh(); await navigate({ to: '/dashboard' });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open the prototype dashboard.'); }
    finally { setBusy(false); }
  }
  function reset() {
    resetSampleRequest(); setRequest(null); setName(''); setPlan(''); setStep(0); setError(''); void c.refresh();
  }

  return <main className="subscription-wizard min-h-screen bg-background px-4 py-6 sm:px-8">
    <div className="mx-auto w-full max-w-[780px]">
      <nav aria-label="Subscription progress" className="mb-3">
        <div className="mb-3 flex justify-between gap-3 text-xs"><span className="font-semibold">{step + 1} of 3 · {steps[step]}</span><span className="text-muted-foreground">{steps[step]}</span></div>
        <div role="progressbar" aria-label="Subscription steps" aria-valuemin={0} aria-valuemax={3} aria-valuenow={step + 1} className="h-1 overflow-hidden rounded-full bg-secondary"><div className={`h-full bg-primary transition-all motion-reduce:transition-none ${step === 0 ? 'w-1/3' : step === 1 ? 'w-2/3' : 'w-full'}`} /></div>
      </nav>
      <section className="overflow-hidden rounded-2xl border bg-card" aria-label="Gym subscription request">
        <header className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <div className="flex min-w-0 items-center gap-2"><img src={logo} alt="GYVORA logo" width={28} height={28} className="h-7 w-7 shrink-0 rounded-lg object-contain" /><p className="min-w-0 break-words text-sm"><strong>GYVORA</strong><span className="text-muted-foreground"> · Gym Account</span></p></div>
        </header>
        <div className="mx-auto max-w-[616px] px-5 py-7 sm:px-0">
          {step === 0 ? <form onSubmit={e => { e.preventDefault(); void send(); }} noValidate>
            <h1 className="text-xl font-semibold tracking-normal">Choose your gym subscription</h1><p className="mt-1 text-sm text-muted-foreground">Select a plan to send your request to the administrator.</p>
            <div className="mt-4"><Field label="Gym name"><Input aria-label="Gym name" placeholder="Enter your gym name" value={name} maxLength={100} onChange={e => { setName(e.target.value); setError(''); }} className={`h-9 bg-surface ${name.trim() ? 'border-primary' : ''}`} /></Field></div>
            <fieldset className="mt-5 grid gap-3 sm:grid-cols-2"><legend className="sr-only">Subscription plan</legend>
              {plans.map(p => <label key={p.value} className={`relative cursor-pointer rounded-xl border bg-surface px-4 py-6 transition-colors ${plan === p.value ? 'border-primary' : 'border-input hover:border-primary/50'}`}>
                <input aria-label={p.label} type="radio" name="plan" value={p.value} checked={plan === p.value} onChange={() => { setPlan(p.value); setError(''); }} className="peer sr-only" />
                <span className="block text-sm font-semibold peer-focus-visible:outline peer-focus-visible:outline-primary">{p.label}</span><span className="mt-1 block text-xs text-muted-foreground">{p.detail}</span>
                {plan === p.value && <Check className="absolute right-3 top-3 h-4 w-4 text-primary" />}
              </label>)}
            </fieldset>
            <p className="mt-3 text-xs font-semibold text-primary">{plan ? `${plans.find(p => p.value === plan)?.label} selected` : 'Choose a plan to continue'}</p>
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-surface px-4 py-3 text-xs text-muted-foreground"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-success/50 text-success"><MessageCircle className="h-3 w-3" /></span><a href={whatsappLink(contact, 'Hello, I have a question about my gym subscription request.')} target="_blank" rel="noopener noreferrer" className="hover:text-primary">Questions about your request? Contact us on WhatsApp.</a></div>
            {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
            <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} className="h-10" onClick={() => void navigate({ to: '/' })}>Cancel</Button><Button type="submit" variant={plan && name.trim() ? 'default' : 'secondary'} disabled={busy || !plan || !name.trim()} className="h-10">{busy ? 'Sending…' : 'Send Request'}</Button></div>
          </form> : step === 1 ? <div className="mx-auto my-2 max-w-[510px] rounded-2xl border bg-surface px-5 py-6 text-center sm:px-10">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success"><Check className="h-7 w-7" /></span>
            <h1 className="text-xl font-semibold tracking-normal">Request sent</h1>
            <p role="status" className="mt-2 text-sm leading-relaxed text-muted-foreground">Your request has been sent and is waiting for administrator approval.</p>
            <p className="mt-3 break-words text-xs text-muted-foreground">{request?.gymName} · {plans.find(p => p.value === request?.plan)?.label}</p>
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row"><Button variant="secondary" disabled={busy} className="h-10" onClick={() => setStep(2)}>Done</Button><Button disabled={busy} className="h-auto min-h-10 whitespace-normal py-2" onClick={() => void skip()}>Skip — Enter Dashboard</Button></div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Skip starts a one-hour prototype trial once. It does not approve or mark the subscription as paid. The request remains Pending.</p>
          </div> : <div>
            <h1 className="text-xl font-semibold tracking-normal">{gym?.deletedAt ? 'Gym account deleted or banned' : gym?.status === 'Frozen' ? 'Gym account frozen' : request?.status === 'Rejected' ? 'Request rejected' : request?.status === 'Approved' ? 'Subscription approved' : 'Subscription approval pending'}</h1><p role="status" className="mt-1 text-sm text-muted-foreground">{gym?.deletedAt ? 'This gym has been deleted or banned by the prototype administrator. Its data is retained, but gym access is blocked.' : gym?.status === 'Frozen' ? 'This gym account is frozen. Dashboard access is blocked until the administrator unfreezes it.' : 'Your subscription request has been saved.'}</p>
            <div className="mt-6 rounded-xl border bg-surface p-4"><h2 className="text-sm font-semibold tracking-normal">Request status</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{blocked ? 'Gym dashboard access is unavailable. Contact the prototype administrator.' : request?.status === 'Approved' ? 'Your prototype request has been approved.' : 'An administrator will review your gym request. Dashboard access remains unavailable until approval unless the temporary prototype access from Skip is active.'}</p><span className="mt-2 inline-block rounded-full bg-primary/20 px-2.5 py-1 text-xs font-semibold text-primary">{request?.status ?? 'Pending'}{request?.status === 'Pending' ? ' · Awaiting approval' : ''}</span><p className="mt-3 break-words text-xs text-muted-foreground">{request?.gymName} · {plans.find(p => p.value === request?.plan)?.label} · {request?.requestDate}</p>{(gym?.deletionNote || gym?.freezeNote || request?.decisionNote) && <p role="status" className="mt-3 whitespace-pre-wrap break-words text-sm">Reason: {gym?.deletedAt ? gym.deletionNote : gym?.status === 'Frozen' ? gym.freezeNote : request?.decisionNote}</p>}</div>
            {expiredTrial && <p role="status" className="mt-4 text-sm text-muted-foreground">Your trial period has ended. Your request is awaiting administrator approval.</p>}
            {blocked && <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><MessageCircle className="h-4 w-4 shrink-0 text-success"/><a className="text-primary" href={whatsappLink(contact,'Hello, my gym account is suspended.')} target="_blank" rel="noopener noreferrer">Contact us on WhatsApp</a></p>}
            <div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => void c.logout()}>Back to login</Button>{!blocked && (request?.status === 'Approved' ? <Button onClick={() => void navigate({to:'/dashboard'})}>Continue to Dashboard</Button> : !expiredTrial && <Button disabled={busy} onClick={() => void skip()}>{activeTrial ? 'Continue to Dashboard' : 'Skip — Enter Dashboard'}</Button>)}</div>
            {activeTrial && <p role="status" className="mt-3 text-sm text-muted-foreground">Prototype trial · {Math.ceil(((request?.trialExpiresAt ?? now) - now) / 60000)} minutes remaining. The saved expiry does not restart on login.</p>}
          </div>}
          {step !== 0 && error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t px-5 py-3 text-[11px] text-muted-foreground"><span>GYVORA · Gym subscription request</span><span className="shrink-0">Screen {step + 1} / 3</span></footer>
      </section>

      {request && !gym && <div className="mt-4 flex justify-end"><Button variant="ghost" size="sm" onClick={reset}><RotateCcw />Reset flow</Button></div>}
    </div>
  </main>;
}
