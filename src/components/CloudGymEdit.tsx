import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { addMonths, format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Field, selectCls } from './kit';
import { formatGymDate } from '@/lib/approved-gym-columns';
import { PLAN_PRICES } from '@/lib/demo';
import { billingMonths, gymPrices, planDefaults, planEndDate, type PlatformPlan } from '@/lib/platform-subscriptions';
import { editAdminGym, listAdminGyms, listAdminSubscriptionPlans } from '@/lib/platform-admin.functions';

type AdminGym = Awaited<ReturnType<typeof listAdminGyms>>[number];

/** Saved-account version of the prototype "Edit gym" dialog: name, plan, prices, subscription dates and notes. */
export function CloudGymEdit({ gym, onClose, onSaved }: { gym: AdminGym; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const fetchPlans = useServerFn(listAdminSubscriptionPlans);
  const save = useServerFn(editAdminGym);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const today = format(new Date(), 'yyyy-MM-dd');
  const legacy = gymPrices({ plan: gym.plan, ...(gym.monthlyPrice == null ? {} : { monthlyPrice: gym.monthlyPrice }), ...(gym.annualPrice == null ? {} : { annualPrice: gym.annualPrice }), annualPriceManual: gym.annualPriceManual });
  const [name, setName] = useState(gym.name);
  const [plan, setPlan] = useState(gym.plan || 'Monthly Plan');
  const [planId, setPlanId] = useState(gym.planId ?? '');
  const [billingType, setBillingType] = useState<'Monthly' | 'Annual' | null>(gym.billingType === 'Monthly' || gym.billingType === 'Annual' ? gym.billingType : null);
  const [duration, setDuration] = useState<number | null>(gym.durationDays ?? null);
  const [monthly, setMonthly] = useState(String(legacy.monthlyPrice));
  const [annual, setAnnual] = useState(String(legacy.annualPrice));
  const [manual, setManual] = useState(legacy.annualPriceManual);
  const [start, setStart] = useState(gym.subscriptionStart || today);
  const [end, setEnd] = useState(gym.subscriptionEnd || gym.subscriptionStart || today);
  const [notes, setNotes] = useState(gym.adminNote ?? '');
  const [autoDates, setAutoDates] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchPlans().then(rows => { if (active) setPlans(rows.filter(p => p.active || p.id === gym.planId)); }).catch(() => { if (active) toast.error('Could not load subscription plans.'); });
    return () => { active = false; };
  }, [fetchPlans, gym.planId]);

  const selectedValue = planId ? `id:${planId}` : `legacy:${plan}`;
  function selectPlan(value: string) {
    const offered = plans.find(p => `id:${p.id}` === value);
    setAutoDates(true);
    if (offered) {
      const d = planDefaults(offered, start);
      setPlan(d.plan); setPlanId(offered.id); setBillingType(offered.billingType); setDuration(offered.durationDays);
      setMonthly(String(d.monthlyPrice)); setAnnual(String(d.annualPrice)); setManual(d.annualPriceManual); setEnd(d.end);
    } else {
      const name = value.slice(7); const d = gymPrices({ plan: name });
      setPlan(name); setPlanId(''); setBillingType(null); setDuration(null);
      setMonthly(String(d.monthlyPrice)); setAnnual(String(d.annualPrice)); setManual(false);
      setEnd(format(addMonths(parseISO(start), billingMonths(name)), 'yyyy-MM-dd'));
    }
  }

  async function submit() {
    const monthlyPrice = Number(monthly), annualPrice = Number(annual);
    if (monthly === '' || annual === '' || !Number.isFinite(monthlyPrice) || !Number.isFinite(annualPrice) || monthlyPrice < 0 || annualPrice < 0) { toast.error('Enter valid subscription prices.'); return; }
    if (!start || !end || end < start) { toast.error('Subscription end date must not be before the start date.'); return; }
    setBusy(true);
    try {
      await save({ data: { gymId: gym.id, name, subscription: { plan, planId, billingType, durationDays: duration, monthlyPrice, annualPrice, annualPriceManual: manual, start, end, notes } } });
      toast.success('Gym details saved.');
      await onSaved();
      onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save gym.'); }
    finally { setBusy(false); }
  }

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Edit gym</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <Field label="Gym name"><Input value={name} onChange={e => setName(e.target.value)} required maxLength={100} /></Field>
      <Field label="Subscription plan"><select aria-label="Subscription plan" className={selectCls} value={selectedValue} onChange={e => { try { selectPlan(e.target.value); } catch { toast.error('Enter a valid start date before applying a plan.'); } }}>
        {planId && !plans.some(p => p.id === planId) && <option value={selectedValue}>{plan} (saved agreement)</option>}
        {!planId && !Object.keys(PLAN_PRICES).includes(plan) && <option value={selectedValue}>{plan} (saved agreement)</option>}
        {Object.keys(PLAN_PRICES).map(p => <option key={p} value={`legacy:${p}`}>{p} (legacy)</option>)}
        {plans.map(p => <option key={p.id} value={`id:${p.id}`}>{p.name} · {p.billingType}</option>)}
      </select></Field>
      {planId && plans.some(p => p.id === planId) && <Button type="button" variant="outline" size="sm" onClick={() => { try { selectPlan(selectedValue); } catch { toast.error('Enter a valid start date.'); } }}>Apply current plan defaults</Button>}
      <Field label="Monthly subscription price (EGP)"><Input type="number" min="0" step="any" required value={monthly} onChange={e => { setMonthly(e.target.value); if (!manual) setAnnual(String(Number(e.target.value) * 12)); }} /></Field>
      <Field label="Annual subscription price (EGP)"><Input type="number" min="0" step="any" required value={annual} onChange={e => { setAnnual(e.target.value); setManual(true); }} /></Field>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={!manual} onCheckedChange={checked => { setManual(!checked); if (checked) setAnnual(String(Number(monthly) * 12)); }} />Calculate annual price automatically (monthly × 12)</label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Subscription start date"><Input type="date" required value={start} onChange={e => { setStart(e.target.value); if (autoDates && e.target.value) { try { setEnd(duration ? planEndDate(e.target.value, duration) : format(addMonths(parseISO(e.target.value), billingMonths(plan)), 'yyyy-MM-dd')); } catch { /* keep the typed end date */ } } }} /><span className="block text-xs text-muted-foreground">Shown as {formatGymDate(start)}</span></Field>
        <Field label="Subscription end date"><Input type="date" required min={start} value={end} onChange={e => { setEnd(e.target.value); setAutoDates(false); }} /><span className="block text-xs text-muted-foreground">Shown as {formatGymDate(end)}</span></Field>
      </div>
      <Field label="Gym notes"><Textarea rows={4} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></div>
    </form>
  </DialogContent></Dialog>;
}
