import { useEffect, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { MessageCircle } from 'lucide-react';
import { getDemoAccount, useDemoStore, whatsappLink } from '@/lib/demo';
import { formatRemaining, TRIAL_MS } from '@/lib/trial';
import { Button } from './ui/button';

export function DemoOwnerGate({children,logout}:{children:ReactNode;logout:()=>Promise<void>}) {
  const state=useDemoStore(s=>s);
  const [,tick]=useState(0);
  useEffect(()=>{const id=window.setInterval(()=>tick(v=>v+1),1000);return()=>window.clearInterval(id);},[]);
  const acc=getDemoAccount();
  const gym=state.gyms.find(g=>g.email===acc?.email);
  const request=state.requests.find(r=>r.email===acc?.email&&r.submittedAt);
  const remaining=acc?.trialStartedAt?Math.max(0,new Date(acc.trialStartedAt).getTime()+TRIAL_MS-Date.now()):null;
  const title=acc?.deletedAt||gym?.deletedAt?'Gym account suspended':gym?.status==='Frozen'?'Gym account frozen':request?.status==='Pending'&&remaining===0?'Trial ended':null;
  if(title)return <div className="mx-auto max-w-md p-10"><h1 className="text-2xl">{title}</h1><p className="mt-2 text-muted-foreground">{acc?.deletedAt||gym?.deletedAt?'Your gym has been banned or suspended by the administrator. Gym features are unavailable until it is restored.':gym?.status==='Frozen'?'Your gym account has been frozen by the administrator.':'Your trial period has ended. Your request is awaiting administrator approval.'}</p>{gym?.deletedAt&&gym.deletionNote&&<p className="mt-4 whitespace-pre-wrap break-words text-sm">Reason: {gym.deletionNote}</p>}{gym?.status==='Frozen'&&gym.freezeNote&&<p className="mt-4 whitespace-pre-wrap break-words text-sm">Reason: {gym.freezeNote}</p>}{gym?.status==='Frozen'&&<p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><MessageCircle className="h-4 w-4 shrink-0 text-primary"/>{state.platformWhatsapp?<a className="text-primary" href={whatsappLink(state.platformWhatsapp,'Hello, my gym account is frozen.')} target="_blank" rel="noopener noreferrer">Contact us on WhatsApp.</a>:"WhatsApp contact isn't set yet — please contact the platform administrator."}</p>}<Button className="mt-6" variant="outline" onClick={()=>void logout()}>Log out</Button></div>;
  if(request?.status==='Pending'&&remaining!==null&&acc?.skipped)return <><div role="status" className="border-b bg-secondary px-4 py-2 text-center text-xs text-muted-foreground">Local demo trial · {formatRemaining(remaining)} remaining · <Link to="/subscription-request" className="text-primary">Pending approval</Link></div>{children}</>;
  return children;
}