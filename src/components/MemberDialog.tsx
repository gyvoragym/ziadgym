import { useServerFn } from "@tanstack/react-start";
import { lookupClient } from "@/lib/cloud.functions";
import { useCloud } from "./CloudProvider";
import { QRScanner } from "./QRScanner";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, selectCls } from "@/components/kit";
import { initials } from "@/lib/mock";
import { getState, saveState, useStore, type Member } from "@/lib/store";
import { generateId } from "@/lib/utils";
import { assertUniqueClientMembership, membershipDaysRemaining, membershipStatus } from '@/lib/membership-link';
import { getDemoSession, lookupDemoClient } from '@/lib/demo';
import { isGyvoraId } from '@/lib/gyvora-id';
import { initialMembershipDates, membershipEnd, planMonths } from '@/lib/membership-dates';
import { localDate } from '@/lib/gym-period';
import { canChange } from '@/lib/gym-permissions';
import { membershipEmailSchema } from '@/lib/validation';
import { gymToday } from '@/lib/gym-reporting';

const blank = () => ({ name: "", phone: "", email: "", plan: "Basic", type: "Unlimited" as Member["type"], sessionsTotal: 20, start: localDate(), expiry: "", trainer: "", notes: "" });

export function MemberDialog({ open, onOpenChange, member: initialMember, renew: initialRenew, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; member?: Member | null; renew?: boolean; onSaved?: (m: Member) => void }) {
  const [member,setMember]=useState(initialMember);
  const [renew,setRenew]=useState(initialRenew);
  const [duplicate,setDuplicate]=useState<Member|null>(null);
  useEffect(()=>{if(open){setMember(initialMember);setRenew(initialRenew);setDuplicate(null);}},[open,initialMember,initialRenew]);
  const c=useCloud();const lookup=useServerFn(lookupClient);const [scan,setScan]=useState(false);const [memberId,setMemberId]=useState("");const [clientId,setClientId]=useState<string|undefined>();const [lookupBusy,setLookupBusy]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [legacyQrId,setLegacyQrId]=useState<string>();
  const [mode,setMode]=useState<'registered'|'manual'>('registered');
  useEffect(()=>{if(open)setMode('registered');},[open]);
  function switchMode(m:'registered'|'manual'){setMode(m);setClientId(undefined);setLegacyQrId(undefined);setMemberId('');setDuplicate(null);setError('');up({name:'',email:'',phone:''});}
  async function findClient(value:string, fromCamera=false){const id=value.trim().replace(/^ironhaus:member:/,"");if(!id){toast.error("Enter a GYVORA ID, name, QR code or email");return false;}setLookupBusy(true);setClientId(undefined);setDuplicate(null);setError('');try{const p=getDemoSession()?lookupDemoClient(c.gymId,id):await lookup({data:{gymId:c.gymId,memberId:id}});const existing=getState().members.find(m=>m.clientId===p.id&&m.id!==member?.id);if(existing){setDuplicate(existing);setScan(false);setError('This client already has a membership at this gym. Edit their existing membership instead.');return false;}up({name:p.full_name,email:p.email,phone:p.phone});setClientId(p.id);setLegacyQrId('member_id' in p ? p.member_id : undefined);setMemberId(p.gyvora_id??('member_id' in p ? p.member_id : ''));toast.success("Client found. Confirm their details before saving.");return true;}catch(e){if(fromCamera)throw e;toast.error(e instanceof Error?e.message:"Client not found");return false;}finally{setLookupBusy(false);}}
  const plans = useStore((s) => s.plans);
  const trainers = useStore((s) => s.trainers);
  const [f, setF] = useState(blank());
  useEffect(() => {
    if(open){setClientId(member?.clientId);setLegacyQrId(member?.memberQrId);setMemberId("");setError('');}
    if (open) {
      const currentPlans = getState().plans;
      const plan = member ? currentPlans.find(p => p.name === member.plan) : currentPlans[0];
      const dates = initialMembershipDates(member ?? undefined, Boolean(renew), planMonths(plan));
      if (!member || renew) { dates.start = gymToday(getState().gym); const months = planMonths(plan); if (months) dates.expiry = membershipEnd(dates.start, months); }
      setF(member ? { name: member.name, phone: member.phone, email: member.email ?? '', plan: member.plan, type: member.type, sessionsTotal: member.sessionsTotal || 20, ...dates, trainer: member.trainer, notes: member.notes } : {...blank(), plan:plan?.name??"", ...dates});
    }
  }, [open, member, renew]);
  const up = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const changeDates = (patch: { plan?: string; start?: string }) => setF(x => {
    const next = { ...x, ...patch };
    const months = planMonths(plans.find(p => p.name === next.plan));
    return { ...next, expiry: months ? membershipEnd(next.start, months) : next.expiry };
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.expiry <= f.start) { toast.error("End date must be after start date"); return; }
    setBusy(true);setError('');
    try {
    if(!member&&mode==='registered'&&!clientId)throw new Error('Look up and confirm an existing user before saving their membership.');
    if(!f.name.trim())throw new Error('Client name is required.');
    const linkId = mode==='manual' && !member ? undefined : clientId;
    if (linkId && (!member || linkId !== member.clientId)) {
      const existing=getState().members.find(m=>m.clientId===linkId&&m.id!==member?.id);
      if(existing)setDuplicate(existing);
      assertUniqueClientMembership(getState().members,linkId,member?.id);
    }
    if(member&&!getState().members.some(m=>m.id===member.id))throw new Error('This membership is no longer available. Refresh the Members page.');
    const total = f.type === "Limited" ? Math.max(1, Math.floor(f.sessionsTotal)) : 0;
    const subscription = !member || renew ? { subscriptionEventId: generateId(), planPrice: plans.find(p => p.name === f.plan)?.price ?? 0 } : {};
    const source: Member['source'] = linkId ? 'registered' : 'manual';
    const today = gymToday(getState().gym);
    const savedStatus = (sessionsLeft: number) => {
      const status = membershipStatus({start:f.start,expiry:f.expiry,type:f.type,sessionsLeft},today);
      return status === 'Upcoming' ? 'Active' : status;
    };
    const base = { ...f, email: membershipEmailSchema.parse(f.email) ?? '', source, ...(linkId?{clientId:linkId}:{}), ...((legacyQrId||member?.memberQrId)?{memberQrId:legacyQrId||member?.memberQrId}:{}), ...(linkId&&isGyvoraId(memberId)?{gyvoraId:memberId}:{}), sessionsTotal: total, initials: initials(f.name), status: savedStatus(total), remaining: membershipDaysRemaining(f.expiry,today) };
    if (member) {
      const left = renew ? total : (f.type === "Limited" ? (member.type === "Limited" ? Math.min(member.sessionsLeft + (total - member.sessionsTotal), total) : total) : 0);
      const sessionsLeft = Math.max(0, left);
      const updated = { ...member, ...base, ...subscription, status: savedStatus(sessionsLeft), sessionsLeft };
      await saveState((s) => ({ members: s.members.map((m) => m.id === member.id ? updated : m) }));
      onSaved?.(updated);
    } else {
      const id = generateId();
      await saveState((s) => ({ members: [{ id, ...base, ...subscription, sessionsLeft: total }, ...s.members] }));
      
    }
    toast.success(renew?'Membership renewed':member?'Membership updated':'Membership saved');onOpenChange(false);
    } catch(e) {setError(e instanceof Error?e.message:'Could not save membership. Please try again.');} finally {setBusy(false);}
  };

  async function remove() {
    if(!member||!window.confirm('Delete this gym subscription?'))return;
    setBusy(true);setError('');
    try {await saveState(s=>({members:s.members.filter(m=>m.id!==member.id)}));toast.success('Membership removed; history retained');onOpenChange(false);}
    catch(e){setError(e instanceof Error?e.message:'Could not delete membership. Please try again.');}
    finally {setBusy(false);}
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{renew ? "Renew membership" : member ? "Edit member" : "Add member"}</DialogTitle></DialogHeader>
        <QRScanner open={scan} onClose={()=>setScan(false)} onScan={v=>findClient(v,true)}/>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          {!member&&<div className="space-y-3 border-b pb-4 sm:col-span-2">
            <div role="tablist" aria-label="Membership type" className="flex gap-1 rounded-lg border bg-surface p-1">
              {(['registered','manual'] as const).map(m=><button key={m} type="button" role="tab" aria-selected={mode===m} onClick={()=>switchMode(m)} className={`flex-1 rounded-md px-3 py-1.5 text-sm ${mode===m?'bg-secondary text-foreground':'text-muted-foreground'}`}>{m==='registered'?'Registered Client':'Manual Entry'}</button>)}
            </div>
            {mode==='registered'?<>
              <Button type="button" variant="secondary" onClick={()=>setScan(true)}>Scan Member QR</Button>
              <Field label="GYVORA Client ID or QR code"><div className="flex gap-2"><Input aria-label="GYVORA Client ID or QR code" value={memberId} onChange={e=>{setMemberId(e.target.value);setClientId(undefined);}}/><Button type="button" disabled={lookupBusy||busy} onClick={()=>void findClient(memberId)}>{lookupBusy?"Finding…":"Look up"}</Button></div></Field>
              {clientId?<p className="break-words text-sm text-success">Confirm existing client · {f.name} · {f.email||'Email not provided'} · {f.phone||'Phone not provided'} · {memberId}</p>:<p className="text-xs text-muted-foreground">Look up the client's website account, then confirm their details below.</p>}
            </>:<p className="text-xs text-muted-foreground">Gym-only record. No website account, GYVORA ID or QR code is created.</p>}
          </div>}
          <Field label="Full name" className="sm:col-span-2"><Input required maxLength={80} value={f.name} onChange={(e) => up({ name: e.target.value })} /></Field>
          <Field label="Phone number"><Input required={!clientId} maxLength={30} value={f.phone} onChange={(e) => up({ phone: e.target.value })} /></Field>
          <Field label="Email (optional)"><Input aria-label="Email (optional)" type="email" maxLength={120} value={f.email} onChange={(e) => up({ email: e.target.value })} /></Field>
          <Field label="Membership plan"><select aria-label="Membership plan" required className={selectCls} value={f.plan} onChange={(e) => changeDates({ plan: e.target.value })}>{!plans.some(p=>p.name===f.plan)&&f.plan&&<option>{f.plan}</option>}{plans.map((p) => <option key={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Membership type"><select className={selectCls} value={f.type} onChange={(e) => up({ type: e.target.value as Member["type"] })}><option value="Unlimited">Unlimited membership</option><option value="Limited">Limited sessions</option></select></Field>
          {f.type === "Limited" && (
            <Field label="Number of sessions" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {[10, 20, 30, 50].map((n) => <Button key={n} type="button" size="sm" variant={f.sessionsTotal === n ? "default" : "secondary"} onClick={() => up({ sessionsTotal: n })}>{n}</Button>)}
                <Input type="number" min={1} max={999} required value={f.sessionsTotal} onChange={(e) => up({ sessionsTotal: Number(e.target.value) })} className="w-24" />
              </div>
            </Field>
          )}
          <Field label="Start date"><Input aria-label="Start date" type="date" required value={f.start} onChange={(e) => changeDates({ start: e.target.value })} /></Field>
          <Field label="End date"><Input aria-label="End date" type="date" required value={f.expiry} onChange={(e) => up({ expiry: e.target.value })} /></Field>
          <Field label="Trainer" className="sm:col-span-2"><select className={selectCls} value={f.trainer} onChange={(e) => up({ trainer: e.target.value })}><option value="">No trainer</option>{trainers.map((t) => <option key={t.id}>{t.name}</option>)}</select></Field>
          <Field label="Notes" className="sm:col-span-2"><Textarea maxLength={500} value={f.notes} onChange={(e) => up({ notes: e.target.value })} /></Field>
          <DialogFooter className="gap-2 sm:col-span-2">
            {member && !renew && <Button type="button" disabled={busy} variant="destructive" className="sm:mr-auto" onClick={()=>void remove()}>Delete member</Button>}
            <Button type="button" disabled={busy} variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy||lookupBusy||!plans.length||Boolean(duplicate)}>{busy?'Saving…':renew ? "Renew" : member ? "Save changes" : "Save"}</Button>
          </DialogFooter>
          {error&&<p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
          {duplicate&&canChange(c.role,c.permissions,'Members','edit')&&<div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={()=>{setMember(duplicate);setRenew(false);setDuplicate(null);}}>Edit existing membership</Button>{membershipStatus(duplicate,gymToday(getState().gym))==='Expired'&&<Button type="button" onClick={()=>{setMember(duplicate);setRenew(true);setDuplicate(null);}}>Renew existing membership</Button>}</div>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
