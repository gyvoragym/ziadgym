import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft } from "lucide-react";
import { Avatar, Panel, StatusPill } from "@/components/kit";
import {seo} from "@/lib/seo";
import { useStore } from "@/lib/store";
import { membershipDaysRemaining, membershipSessionsUsed, membershipStatus } from "@/lib/membership-link";
import { gymToday } from "@/lib/gym-reporting";

export const Route = createFileRoute("/_gym/members/$id")({
  head: ()=>seo("Member profile","Gym member subscription details and history."),
  component: MemberProfile,
});

function MemberProfile() {
  const {id}=Route.useParams();
  const m=useStore(s=>s.members.find(x=>x.id===id));
  const gym=useStore(s=>s.gym);
  const [today,setToday]=useState(()=>gymToday(gym));
  useEffect(()=>{
    const refresh=()=>setToday(gymToday(gym));
    refresh();
    const timer=window.setInterval(refresh,30_000);
    return ()=>window.clearInterval(timer);
  },[gym]);
  const visits=useStore(s=>s.attendance);const sessions=useStore(s=>s.sessions);
  const w=useStore(s=>s.workouts[0]);
  if(!m)return <div className="py-10"><h1 className="text-2xl">Member unavailable</h1><Link to="/members" className="mt-5 block text-primary">Back to members</Link></div>;
  return (
    <div className="space-y-6">
      <Link to="/members" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Members</Link>
      <div className="panel flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        <Avatar initials={m.initials} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold">{m.name}</h1><StatusPill status={m.status} /></div>
          <div className="mt-1 text-sm text-muted-foreground">{m.id} · {m.phone} · {m.email}</div>
        </div>
        <div className="w-fit rounded-xl bg-foreground p-3"><QRCodeSVG value={m.gyvoraId??`ironhaus:member:${m.id}`} size={96} bgColor="transparent" fgColor="currentColor" className="text-background" /></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Membership">
          <dl className="space-y-3 text-sm">
            {[["Current plan", m.plan], ["Start date", m.start], ["Expiry date", m.expiry], ["Days remaining", `${membershipDaysRemaining(m.expiry,today)} days`], ["Sessions used", m.type === "Limited" ? `${membershipSessionsUsed(m)} / ${m.sessionsTotal}` : "Unlimited"], ["Status", membershipStatus(m,today)]].map(([k, v]) => (
              <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
        </Panel>
        <Panel title="Body measurements">
          <div className="grid grid-cols-2 gap-3">
            {[["Weight", "72 kg"], ["Height", "176 cm"], ["Body fat", "18%"], ["BMI", "23.2"]].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-surface p-3"><div className="eyebrow">{k}</div><div className="mt-1 font-display text-lg">{v}</div></div>
            ))}
          </div>
        </Panel>
        <Panel title="Notes"><p className="text-sm text-muted-foreground">{m.notes||"No notes recorded."}</p></Panel>
        <Panel title="Attendance history"><ul className="space-y-2 text-sm">{visits.filter(v=>v.memberId===m.id).map(v=><li key={v.id}>{v.date} · {v.time}</li>)}</ul></Panel>
        <Panel title="Session history"><ul className="space-y-2 text-sm">{sessions.filter(v=>v.memberId===m.id).map(v=><li key={v.id}>{v.date} · {v.type} · {v.trainer}</li>)}</ul></Panel>
        {w&&<Panel title={`Workout program · ${w.name}`} className="lg:col-span-3">
          <div className="grid gap-2 sm:grid-cols-4">{w.exercises.map((e) => <div key={e.name} className="rounded-lg bg-surface p-3"><div className="text-sm font-medium">{e.name}</div><div className="text-xs text-muted-foreground">{e.sets} × {e.reps}</div></div>)}</div>
        </Panel>}
      </div>
    </div>
  );
}
