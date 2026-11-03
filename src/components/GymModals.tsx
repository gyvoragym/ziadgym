import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Plus, Trash2, MessageCircle, Facebook, Mail, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/kit";
import { getState, readFile, saveState, defaultGymHours, type Gym, type Plan } from "@/lib/store";
import { generateId } from "@/lib/utils";
import { MonthDurationInput } from './MonthDurationInput';
import { monthLabel, planMonths } from '@/lib/membership-dates';
import { planSchema } from '@/lib/validation';
import { gymContactUrl } from '@/lib/gym-contact';

function withWorkingHours(gym: Gym): Gym {
  return gym.hoursByDay.length ? gym : { ...gym, hoursByDay: defaultGymHours() };
}

export function EditGymDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [g, setG] = useState<Gym>(() => withWorkingHours(getState().gym));
  const [plans, setPlans] = useState<Plan[]>(getState().plans);
  const [svc, setSvc] = useState("");
  const [facility, setFacility] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setG(withWorkingHours(getState().gym)); setPlans(getState().plans); } }, [open]);
  const up = (p: Partial<Gym>) => setG((x) => ({ ...x, ...p }));
  const addFacility = () => {
    const value = facility.trim();
    if (!value) return;
    if (g.facilities.some((item) => item.toLowerCase() === value.toLowerCase())) {
      toast.error("This facility is already listed.");
      return;
    }
    up({ facilities: [...g.facilities, value] });
    setFacility("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) { setG(withWorkingHours(getState().gym)); setPlans(getState().plans); } onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Edit gym profile</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Gym name" className="sm:col-span-2"><Input value={g.name} maxLength={80} onChange={(e) => up({ name: e.target.value })} /></Field>
          <Field label="Logo"><Input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) up({ logo: await readFile(f) }); }} /></Field>
          <Field label="Cover image"><Input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) up({ cover: await readFile(f) }); }} /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea value={g.description} maxLength={800} onChange={(e) => up({ description: e.target.value })} /></Field>
          <Field label="Phone number"><Input value={g.phone} maxLength={30} onChange={(e) => up({ phone: e.target.value })} /></Field>
          <Field label="Address"><Input value={g.location} maxLength={160} onChange={(e) => up({ location: e.target.value })} /></Field>
          <Field label="WhatsApp number or link"><Input value={g.whatsapp} maxLength={255} placeholder="01012345678 or https://wa.me/201012345678" onChange={(e) => up({ whatsapp: e.target.value })} /></Field>
          <Field label="Instagram link"><Input value={g.instagram ?? ""} maxLength={255} placeholder="https://instagram.com/yourgym" onChange={(e) => up({ instagram: e.target.value })} /></Field>
          <Field label="Facebook link"><Input value={g.facebook ?? ""} maxLength={255} placeholder="https://facebook.com/yourgym" onChange={(e) => up({ facebook: e.target.value })} /></Field>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Working hours</div>
          {g.hoursByDay.map((d, i) => (
            <div key={d.day} className="grid grid-cols-[6rem_1fr_1fr_auto] items-center gap-2 text-sm">
              <span>{d.day}</span>
              <Input type="time" disabled={d.closed} value={d.open} onChange={(e) => up({ hoursByDay: g.hoursByDay.map((x, j) => j === i ? { ...x, open: e.target.value } : x) })} />
              <Input type="time" disabled={d.closed} value={d.close} onChange={(e) => up({ hoursByDay: g.hoursByDay.map((x, j) => j === i ? { ...x, close: e.target.value } : x) })} />
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={d.closed} onCheckedChange={(c) => up({ hoursByDay: g.hoursByDay.map((x, j) => j === i ? { ...x, closed: c } : x) })} />Closed</label>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Facilities</div>
          <div className="flex flex-wrap gap-2">{g.facilities.map((item) => <span key={item} className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs">{item}<button type="button" aria-label={`Remove ${item}`} onClick={() => up({ facilities: g.facilities.filter((x) => x !== item) })}><X className="h-3 w-3" /></button></span>)}</div>
          <div className="flex gap-2"><Input value={facility} maxLength={60} placeholder="Add facility" onChange={(e) => setFacility(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFacility(); } }} /><Button type="button" variant="secondary" disabled={!facility.trim()} onClick={addFacility}>Add facility</Button></div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Services</div>
          <div className="flex flex-wrap gap-2">{g.services.map((s) => <span key={s} className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs">{s}<button aria-label={`Remove ${s}`} onClick={() => up({ services: g.services.filter((x) => x !== s) })}><X className="h-3 w-3" /></button></span>)}</div>
          <div className="flex gap-2"><Input value={svc} maxLength={40} placeholder="Add service" onChange={(e) => setSvc(e.target.value)} /><Button type="button" variant="secondary" onClick={() => { if (svc.trim()) { up({ services: [...g.services, svc.trim()] }); setSvc(""); } }}>Add</Button></div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Membership plans</div>
          {plans.map((p, i) => (
            <div key={p.id} className="grid grid-cols-[1fr_1fr_7rem_auto] gap-2">
              <Input value={p.name} onChange={(e) => setPlans(plans.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              <MonthDurationInput value={p.durationMonths === 0 ? '' : String(planMonths(p) ?? 1)} onChange={value => setPlans(plans.map((x,j) => j === i ? { ...x, durationMonths: Number(value), duration: monthLabel(Number(value)) } : x))} />
              <Input type="number" min={0} value={p.price} onChange={(e) => setPlans(plans.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))} />
              <Button size="icon" variant="ghost" aria-label="Remove plan" onClick={() => setPlans(plans.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setPlans([...plans, { id: generateId(), name: "New plan", duration: "1 month", durationMonths: 1, price: 0, features: [] }])}><Plus className="h-4 w-4" />Add plan</Button>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy} onClick={async () => { if (!g.name.trim()) { toast.error('Gym name is required'); return; } if ((g.whatsapp && !gymContactUrl('whatsapp', g.whatsapp)) || (g.instagram && !gymContactUrl('social', g.instagram)) || (g.facebook && !gymContactUrl('social', g.facebook))) { toast.error('Enter a valid WhatsApp number or social media link.'); return; } setBusy(true); try { plans.forEach(p => planSchema.parse(p)); await saveState(() => ({ gym: { ...g, name: g.name.trim(), gallery: getState().gym.gallery }, plans })); toast.success("Profile saved"); onOpenChange(false); } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not save profile'); } finally { setBusy(false); } }}>{busy ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ShareGymDialog({ open, onOpenChange, code, gyvoraId }: { open: boolean; onOpenChange: (o: boolean) => void; code: string; gyvoraId?: string | undefined }) {
  const link = gyvoraId || `https://ironhaus.gym/g/${(code||'').toLowerCase()}`;
  const copy = () => { navigator.clipboard?.writeText(link); toast.success("Link copied"); };
  const enc = encodeURIComponent(link);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Share public profile</DialogTitle></DialogHeader>
        <div className="mx-auto w-fit rounded-2xl bg-foreground p-4"><QRCodeSVG value={link} size={180} bgColor="transparent" fgColor="currentColor" className="text-background" /></div>
        <div className="flex gap-2"><Input readOnly value={link} /><Button variant="secondary" size="icon" aria-label="Copy link" onClick={copy}><Copy className="h-4 w-4" /></Button></div>
        <div className="grid grid-cols-3 gap-2">
          <Button asChild variant="secondary"><a href={`https://wa.me/?text=${enc}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a></Button>
          <Button asChild variant="secondary"><a href={`https://www.facebook.com/sharer/sharer.php?u=${enc}`} target="_blank" rel="noreferrer"><Facebook className="h-4 w-4" />Facebook</a></Button>
          <Button asChild variant="secondary"><a href={`mailto:?body=${enc}`}><Mail className="h-4 w-4" />Email</a></Button>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={copy}>Copy link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
