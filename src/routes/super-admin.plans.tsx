import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, DataTable, td, Field, selectCls } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDemoStore, savePlatformPlan, deletePlatformPlan } from '@/lib/demo';
import { defaultPlatformPlans, type PlatformPlan } from '@/lib/platform-subscriptions';
import { egp } from '@/lib/mock';
import { seo } from '@/lib/seo';
import { generateId } from "@/lib/utils";
import { getDemoSession } from '@/lib/demo';
import { useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { listAdminSubscriptionPlans, saveAdminSubscriptionPlan, setAdminSubscriptionPlanActive } from '@/lib/platform-admin.functions';

export const Route=createFileRoute('/super-admin/plans')({head:()=>seo('Project subscription plans','Manage IronHaus platform monthly and annual gym subscription plans without changing existing agreements.'),component:SubscriptionPlans});
function SubscriptionPlans(){
  return getDemoSession() ? <DemoSubscriptionPlans/> : <CloudSubscriptionPlans/>;
}
function DemoSubscriptionPlans(){
  const plans=useDemoStore(s=>s.platformPlans??defaultPlatformPlans);
  const [editing,setEditing]=useState<PlatformPlan|null>(null);const [isNew,setIsNew]=useState(false);
  const [name,setName]=useState('');const [billing,setBilling]=useState<'Monthly'|'Annual'>('Monthly');const [price,setPrice]=useState('');const [days,setDays]=useState('30');
  function open(plan?:PlatformPlan){setIsNew(!plan);setEditing(plan??{id:generateId(),name:'',billingType:'Monthly',price:0,durationDays:30});setName(plan?.name??'');setBilling(plan?.billingType??'Monthly');setPrice(plan?String(plan.price):'');setDays(String(plan?.durationDays??30));}
  return <div><PageHeader title="Subscription Plans" subtitle={`Project plans: ${plans.length} · fictional demo data.`} actions={<Button onClick={()=>open()}><Plus className="h-4 w-4"/>Add Plan</Button>}/>
    <DataTable head={['Plan Name','Billing Type','Price','Duration in Days','Actions']}>{plans.map(plan=><tr key={plan.id}><td className={td}>{plan.name}</td><td className={td}>{plan.billingType}</td><td className={td}>{egp(plan.price)}</td><td className={td}>{plan.durationDays}</td><td className={td}><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>open(plan)}><Pencil className="h-3 w-3"/>Edit</Button><Button size="sm" variant="destructive" onClick={()=>{if(!window.confirm(`Delete ${plan.name}?`))return;try{deletePlatformPlan(plan.id);toast.success('Plan deleted (demo).');}catch(err){toast.error(err instanceof Error?err.message:'Could not delete plan');}}}><Trash2 className="h-3 w-3"/>Delete</Button></div></td></tr>)}</DataTable>
    {!plans.length&&<p className="py-6 text-muted-foreground">No subscription plans.</p>}
    <Dialog open={!!editing} onOpenChange={open=>{if(!open)setEditing(null);}}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{isNew?'Add Plan':'Edit Plan'}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={e=>{e.preventDefault();if(!editing)return;try{savePlatformPlan({id:editing.id,name,billingType:billing,price:Number(price),durationDays:Number(days)});setEditing(null);toast.success('Plan saved (demo).');}catch{toast.error('Enter a plan name, positive price and positive whole-day duration.');}}}>
      <Field label="Plan name"><Input required value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></Field>
      <Field label="Billing type"><select aria-label="Billing type" className={selectCls} value={billing} onChange={e=>{setBilling(e.target.value==='Annual'?'Annual':'Monthly');}}><option>Monthly</option><option>Annual</option></select></Field>
      <Field label="Price (EGP)"><Input type="number" min="0.01" step="0.01" required value={price} onChange={e=>setPrice(e.target.value)}/></Field>
      <Field label="Duration in days"><Input type="number" min="1" max="36500" step="1" required value={days} onChange={e=>setDays(e.target.value)}/></Field>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setEditing(null)}>Cancel</Button><Button>Save Plan</Button></div>
    </form></DialogContent></Dialog>
  </div>;
}

type CloudPlan=Awaited<ReturnType<typeof listAdminSubscriptionPlans>>[number];
function CloudSubscriptionPlans(){
  const list=useServerFn(listAdminSubscriptionPlans);
  const save=useServerFn(saveAdminSubscriptionPlan);
  const setActive=useServerFn(setAdminSubscriptionPlanActive);
  const [plans,setPlans]=useState<CloudPlan[]>([]);
  const [editing,setEditing]=useState<CloudPlan|null>(null);
  const [isNew,setIsNew]=useState(false);
  const [name,setName]=useState('');
  const [billing,setBilling]=useState<'Monthly'|'Annual'>('Monthly');
  const [price,setPrice]=useState('');
  const [days,setDays]=useState('30');
  const [busy,setBusy]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  async function load(){
    try{setPlans(await list({}));setError('');}
    catch(reason){setError(reason instanceof Error?reason.message:'Could not load subscription plans.');}
    finally{setLoaded(true);}
  }
  useEffect(()=>{void load();},[]);
  function open(plan?:CloudPlan){
    setIsNew(!plan);
    setEditing(plan??{id:generateId(),name:'',billingType:'Monthly',price:0,durationDays:30,active:true});
    setName(plan?.name??'');setBilling(plan?.billingType??'Monthly');setPrice(plan?String(plan.price):'');setDays(String(plan?.durationDays??30));
  }
  async function savePlan(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(!editing)return;
    setBusy(true);setError('');
    try{
      await save({data:{id:editing.id,name,billingType:billing,price:Number(price),durationDays:Number(days),active:editing.active}});
      setEditing(null);toast.success('Subscription plan saved.');await load();
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not save subscription plan.');}
    finally{setBusy(false);}
  }
  async function toggleActive(plan:CloudPlan){
    setBusy(true);setError('');
    try{
      await setActive({data:{id:plan.id,active:!plan.active}});
      toast.success(plan.active?'Plan removed from new requests.':'Plan is available for new requests.');
      await load();
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not update the subscription plan.');}
    finally{setBusy(false);}
  }
  return <div>
    <PageHeader title="Subscription Plans" subtitle="Plans and prices shown to gym owners when they submit a subscription request." actions={<Button onClick={()=>open()}><Plus className="h-4 w-4"/>Add Plan</Button>}/>
    {error&&<p role="alert" className="mb-4 text-sm text-destructive">{error}<Button size="sm" variant="outline" className="ml-3" onClick={()=>void load()}>Retry</Button></p>}
    {!loaded?<p role="status" className="py-6 text-sm text-muted-foreground">Loading subscription plans…</p>:<>
      <DataTable head={['Plan Name','Billing Type','Price','Duration in Days','Status','Actions']}>
        {plans.map(plan=><tr key={plan.id}>
          <td className={td}>{plan.name}</td><td className={td}>{plan.billingType}</td><td className={td}>{egp(plan.price)}</td><td className={td}>{plan.durationDays}</td><td className={td}>{plan.active?'Available':'Inactive'}</td>
          <td className={td}><div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={()=>open(plan)}><Pencil className="h-3 w-3"/>Edit</Button><Button size="sm" variant={plan.active?'destructive':'secondary'} disabled={busy} onClick={()=>void toggleActive(plan)}>{plan.active?<><Trash2 className="h-3 w-3"/>Remove</>:'Activate'}</Button></div></td>
        </tr>)}
      </DataTable>
      {!plans.length&&<p className="py-6 text-sm text-muted-foreground">No plans have been added. Create a plan to make it available in gym requests.</p>}
    </>}
    <Dialog open={!!editing} onOpenChange={openDialog=>{if(!openDialog)setEditing(null);}}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{isNew?'Add Plan':'Edit Plan'}</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={event=>void savePlan(event)}>
          <Field label="Plan name"><Input required value={name} maxLength={100} onChange={event=>setName(event.target.value)}/></Field>
          <Field label="Billing type"><select aria-label="Billing type" className={selectCls} value={billing} onChange={event=>setBilling(event.target.value==='Annual'?'Annual':'Monthly')}><option>Monthly</option><option>Annual</option></select></Field>
          <Field label="Price (EGP)"><Input type="number" min="0.01" step="0.01" required value={price} onChange={event=>setPrice(event.target.value)}/></Field>
          <Field label="Duration in days"><Input type="number" min="1" max="36500" step="1" required value={days} onChange={event=>setDays(event.target.value)}/></Field>
          {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>setEditing(null)}>Cancel</Button><Button disabled={busy}>{busy?'Saving…':'Save Plan'}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}