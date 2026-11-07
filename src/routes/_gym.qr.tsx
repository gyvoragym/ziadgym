import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, PageHeader, Panel, StatusPill } from "@/components/kit";
import { useStore } from "@/lib/store";
import { useCloud } from "@/components/CloudProvider";
import { seo } from "@/lib/seo";
import { AppBrand } from '@/components/AppBrand';
import { readPreviewSession } from '@/lib/preview-session';
import { SampleAccountQR } from '@/components/SampleAccountQR';
import { createAccountQrPayload } from '@/lib/account-qr-payload';

export const Route = createFileRoute("/_gym/qr")({
  head: () => seo("QR management", "Generate the gym registration QR and member QR cards."),
  component: QR,
});

function QR() {
  const gym=useStore(s=>s.gym);const members=useStore(s=>s.members);const cloud=useCloud();
  const [q, setQ] = useState("");
  const gymId=cloud.gyms.find(g=>g.id===cloud.gymId)?.gyvora_id;
  const gymProfile=cloud.profile;
  const gymQr=gymId&&gymProfile?createAccountQrPayload({type:'gym',gyvora_id:gymId,full_name:gymProfile.full_name,email:gymProfile.email??'',phone:gymProfile.phone??''}):'';
  const [selected, setSelected] = useState("");const m=members.find(x=>x.id===selected)??members[0];
  const list = members.filter((x) => x.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  return (
    <>
      <PageHeader title="QR management" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Gym registration QR" className="min-w-0">
          {readPreviewSession() ? <SampleAccountQR kind="gym"/> : <><div className="mx-auto w-fit rounded-2xl bg-foreground p-5">{gymQr?<QRCodeSVG value={gymQr} size={180} bgColor="transparent" fgColor="currentColor" className="text-background" />:<p className="text-background">Permanent QR unavailable</p>}</div>
          <div className="mt-4 text-center text-sm">GYVORA ID <span className="break-all font-display font-semibold text-primary">{gymId||'Unavailable'}</span></div>
          <Button variant="secondary" className="mt-4 w-full"><Download className="h-4 w-4" />Download</Button></>}
        </Panel>
        <Panel title="Find member" className="min-w-0">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search member" className="bg-surface" />
          <ul className="mt-3 space-y-1">{list.map((x) => <li key={x.id}><Button variant="ghost" onClick={() => setSelected(x.id)} className={`flex w-full justify-start gap-3 p-2 text-left text-sm ${m?.id === x.id ? "bg-secondary" : ""}`}><Avatar initials={x.initials} size="sm" />{x.name}</Button></li>)}</ul>
        </Panel>
        <Panel title="Membership card" className="min-w-0">
          {m?<>
          <div className="rounded-2xl border border-primary/40 bg-accent p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><AppBrand /><StatusPill status={m.status} /></div>
            <div className="mt-5 flex items-end justify-between gap-3">
              <div className="min-w-0"><div className="truncate font-display text-lg font-semibold">{m.name}</div><div className="break-all text-xs text-muted-foreground">{m.gyvoraId??'Permanent ID unavailable'} · {m.plan}</div><div className="text-xs text-muted-foreground">Exp. {m.expiry}</div></div>
              <div className="rounded-lg bg-foreground p-2">{m.gyvoraId&&<QRCodeSVG value={m.gyvoraId} size={72} bgColor="transparent" fgColor="currentColor" className="text-background" />}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="secondary"><Download className="h-4 w-4" />Download</Button><Button onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button></div>
          </>:<p className="text-sm text-muted-foreground">No members in this gym.</p>}
        </Panel>
      </div>
    </>
  );
}
