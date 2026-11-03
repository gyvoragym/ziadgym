import { useState } from 'react';
import { addMonths, format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Field, selectCls } from './kit';
import { formatGymDate } from '@/lib/approved-gym-columns';
import { editGym, PLAN_PRICES, useDemoStore, type ApprovedGym } from '@/lib/demo';
import { billingMonths, defaultPlatformPlans, gymPrices, planDefaults, planEndDate } from '@/lib/platform-subscriptions';

export function PlatformGymEdit({gym,onClose}:{gym:ApprovedGym;onClose:()=>void}) {
  const plans=useDemoStore(s=>s.platformPlans??defaultPlatformPlans);
  const [name,setName]=useState(gym.name);const [plan,setPlan]=useState(gym.plan);
  const [planId,setPlanId]=useState(gym.planId??'');const [applyPlan,setApplyPlan]=useState(false);
  const prices=gymPrices(gym);
  const [monthly,setMonthly]=useState(String(prices.monthlyPrice));const [annual,setAnnual]=useState(String(prices.annualPrice));const [manual,setManual]=useState(prices.annualPriceManual);
  const [start,setStart]=useState(gym.start);const [end,setEnd]=useState(gym.end);const [notes,setNotes]=useState(gym.notes??'');
  const [duration,setDuration]=useState<number|undefined>(gym.durationDays);const [autoDates,setAutoDates]=useState(false);
  const selectedValue=planId?`id:${planId}`:`legacy:${plan}`;
  function selectPlan(value:string) {
    const offered=plans.find(p=>`id:${p.id}`===value);
    setApplyPlan(true);setAutoDates(true);
    if(offered){
      const defaults=planDefaults(offered,start);setPlan(defaults.plan);setPlanId(offered.id);setDuration(offered.durationDays);setMonthly(String(defaults.monthlyPrice));setAnnual(String(defaults.annualPrice));setManual(defaults.annualPriceManual);setEnd(defaults.end);
    }else{
      const legacy=value.slice(7);const defaults=gymPrices({plan:legacy});setPlan(legacy);setPlanId('');setDuration(undefined);setMonthly(String(defaults.monthlyPrice));setAnnual(String(defaults.annualPrice));setManual(false);setEnd(format(addMonths(parseISO(start),billingMonths(legacy)),'yyyy-MM-dd'));
    }
  }
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Edit gym</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={e=>{e.preventDefault();try{editGym(gym.id,{name,plan,planId:planId||undefined,applyPlan,start,end,notes,monthlyPrice:monthly===''?NaN:Number(monthly),annualPrice:annual===''?NaN:Number(annual),annualPriceManual:manual});toast.success('Gym updated (demo).');onClose();}catch(err){toast.error(err instanceof Error?err.message:'Could not save gym');}}}>
      <Field label="Gym name"><Input value={name} onChange={e=>setName(e.target.value)} required maxLength={100}/></Field>
      <Field label="Subscription plan"><select aria-label="Subscription plan" className={selectCls} value={selectedValue} onChange={e=>{try{selectPlan(e.target.value);}catch{toast.error('Enter a valid start date before applying a plan.');}}}>
        {planId&&!plans.some(p=>p.id===planId)&&<option value={selectedValue}>{plan} (saved agreement)</option>}
        {!planId&&!Object.keys(PLAN_PRICES).includes(plan)&&<option value={selectedValue}>{plan} (saved agreement)</option>}
        {Object.keys(PLAN_PRICES).map(p=><option key={p} value={`legacy:${p}`}>{p} (legacy)</option>)}
        {plans.map(p=><option key={p.id} value={`id:${p.id}`}>{p.name} · {p.billingType}</option>)}
      </select></Field>
      {planId&&plans.some(p=>p.id===planId)&&<Button type="button" variant="outline" size="sm" onClick={()=>{try{selectPlan(selectedValue);}catch{toast.error('Enter a valid start date.');}}}>Apply current plan defaults</Button>}
      <Field label="Monthly subscription price (EGP)"><Input type="number" min="0" step="any" required value={monthly} onChange={e=>{setMonthly(e.target.value);if(!manual)setAnnual(String(Number(e.target.value)*12));}}/></Field>
      <Field label="Annual subscription price (EGP)"><Input type="number" min="0" step="any" required value={annual} onChange={e=>{setAnnual(e.target.value);setManual(true);}}/></Field>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={!manual} onCheckedChange={checked=>{setManual(!checked);if(checked)setAnnual(String(Number(monthly)*12));}}/>Calculate annual price automatically (monthly × 12)</label>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Subscription start date"><Input type="date" required value={start} onChange={e=>{setStart(e.target.value);if(autoDates&&e.target.value){try{setEnd(duration?planEndDate(e.target.value,duration):format(addMonths(parseISO(e.target.value),billingMonths(plan)),'yyyy-MM-dd'));}catch{}}}}/><span className="block text-xs text-muted-foreground">Shown as {formatGymDate(start)}</span></Field>
      <Field label="Subscription end date"><Input type="date" required min={start} value={end} onChange={e=>{setEnd(e.target.value);setAutoDates(false);}}/><span className="block text-xs text-muted-foreground">Shown as {formatGymDate(end)}</span></Field></div>
      <Field label="Gym notes"><Textarea rows={4} maxLength={4000} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button>Save</Button></div>
    </form>
  </DialogContent></Dialog>;
}