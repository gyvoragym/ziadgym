import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, QrCode, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { useCloud } from './CloudProvider';
import { accountQrValue } from '@/lib/gyvora-id';
import { createAccountQrPayload } from '@/lib/account-qr-payload';

export function SampleAccountQR({kind}: {kind: 'gym' | 'client'}) {
  const { profile } = useCloud();
  const id = profile?.gyvora_id ?? '';
  const qrValue = id && profile
    ? createAccountQrPayload({
        type: kind === 'gym' ? 'gym' : 'individual',
        gyvora_id: id,
        full_name: profile.full_name,
        email: profile.email ?? '',
        phone: profile.phone ?? '',
      })
    : '';
  const ref = useRef<HTMLDivElement>(null);
  const [expanded,setExpanded] = useState(false);
  function download() {
    if (!id) { toast.error('Permanent GYVORA ID unavailable.'); return; }
    const svg = ref.current?.querySelector('svg');
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
    const link = document.createElement('a');link.href=url;link.download=`sample-${id}-qr.svg`;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function share() {
    if (!id) { toast.error('Permanent GYVORA ID unavailable.'); return; }
    try {if (navigator.share) await navigator.share({title:`GYVORA ${kind === 'gym' ? 'Gym' : 'Client'} QR`,text:qrValue});else {await navigator.clipboard.writeText(qrValue);toast.success('Profile QR data copied');}}
    catch(e) {if(e instanceof Error && e.name==='AbortError')return;toast.error('Sharing unavailable; use Download.');}
  }
  if (!id) return <p role="status" className="border-y py-5 text-sm text-muted-foreground">Permanent GYVORA ID is being prepared.</p>;
  return <section aria-label={`${kind === 'gym' ? 'Gym' : 'Client'} ID and QR`} className="border-y py-5">
    <div className="flex flex-wrap items-center gap-5">
      <div ref={ref} className="w-fit shrink-0 rounded-lg bg-foreground p-3"><QRCodeSVG value={qrValue || accountQrValue(id)} size={expanded ? 260 : 200} marginSize={4} bgColor="transparent" fgColor="currentColor" className="text-background" title={`${kind === 'gym' ? 'Gym' : 'Client'} QR for ${id}`} /></div>
      <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{kind === 'gym' ? 'Gym' : 'Client'} ID</p><p className="mt-1 break-all text-lg font-semibold text-primary">{id}</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={()=>setExpanded(v=>!v)}><QrCode className="h-4 w-4"/>{expanded ? 'Reduce QR' : 'View QR'}</Button><Button type="button" variant="outline" size="sm" onClick={()=>void share()}><Share2 className="h-4 w-4"/>Share</Button><Button type="button" variant="outline" size="sm" onClick={download}><Download className="h-4 w-4"/>Download</Button></div></div>
    </div>
    <p className="mt-3 text-xs text-muted-foreground">This QR contains the profile name and contact details so it can be scanned from another device. Share it only with people you trust.</p>
  </section>;
}