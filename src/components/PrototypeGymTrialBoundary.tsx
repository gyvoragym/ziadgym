import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { MessageCircle } from 'lucide-react';
import { Button } from './ui/button';
import { useCloud } from './CloudProvider';
import { prototypeTrialActive, readSampleRequest } from '@/lib/prototype-scenario';
import { DEFAULT_PLATFORM_WHATSAPP, useDemoStore, whatsappLink } from '@/lib/demo';
import { readPreviewSession } from '@/lib/preview-session';

export function PrototypeGymTrialBoundary({ children }: { children: ReactNode }) {
  const c = useCloud();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now);
  const request = readSampleRequest();
  const gyms = useDemoStore(s => s.gyms);
  const requests = useDemoStore(s => s.requests);
  const platformWhatsapp = useDemoStore(s => s.platformWhatsapp);
  const gym = gyms.find(g => g.email === readPreviewSession()?.scenarioKey);
  const subscriptionExpired = request?.status === 'Approved' && !!gym?.end && gym.end <= new Date(now).toISOString().slice(0, 10);
  const blocked = request?.status === 'Rejected' || gym?.status === 'Frozen' || !!gym?.deletedAt;
  const active = !blocked && !subscriptionExpired && (request?.status === 'Approved' || prototypeTrialActive(request, now));
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 1000);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick); };
  }, []);
  useEffect(() => {
    if (subscriptionExpired) return;
    if (active) return;
    if (!blocked && request?.status === 'Pending' && request?.trialExpiresAt !== undefined) void c.logout();
    else void navigate({ to:'/subscription-request', replace:true });
  }, [active, request?.trialExpiresAt, blocked, requests, subscriptionExpired]);
  if (subscriptionExpired) return <div className="mx-auto max-w-md p-10"><h1 className="text-2xl">Subscription expired</h1><p className="mt-2 text-muted-foreground">Your gym subscription ended on {gym?.end}. Dashboard access is unavailable until the subscription is renewed.</p><p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><MessageCircle className="h-4 w-4 shrink-0 text-primary"/><a className="text-primary" href={whatsappLink(platformWhatsapp||DEFAULT_PLATFORM_WHATSAPP,'Hello, I need help renewing my gym subscription.')} target="_blank" rel="noopener noreferrer">Contact us on WhatsApp.</a></p><Button className="mt-6" variant="outline" onClick={()=>void c.logout()}>Log out</Button></div>;
  if (!active) return <p role="status" className="p-8 text-muted-foreground">{request?.trialExpiresAt !== undefined ? 'Your trial period has ended. Returning to login…' : 'Opening subscription request…'}</p>;
  const seconds = Math.max(0, Math.ceil(((request?.trialExpiresAt ?? now) - now) / 1000));
  if (request?.status === 'Approved') return children;
  return <><p role="status" className="border-b bg-secondary px-4 py-2 text-center text-sm text-muted-foreground">Prototype trial · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} remaining · Request Pending</p>{children}</>;
}