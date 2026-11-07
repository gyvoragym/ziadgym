import {useEffect,useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import type {Database} from '@/integrations/supabase/types';
import {Button} from './ui/button';
import {Textarea} from './ui/textarea';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from './ui/dialog';
import {DataTable,PageHeader,TableSkeleton,td} from './kit';
import {toast} from 'sonner';
import {egp} from '@/lib/mock';

type AdminRequest=Database['public']['Functions']['admin_request_list']['Returns'][number] & {
 phone?:string;note?:string;request_billing_type?:string|null;request_duration_days?:number|null;request_price?:number|null;
};
type Pending={id:string;name:string;mode:'reject'|'delete'|'revoke'};
const titles={reject:'Reject request',delete:'Delete request (rejects and blocks the gym)',revoke:'Revoke approved gym'};

export function CloudGymRequests(){
 const [rows,setRows]=useState<AdminRequest[]>([]);
 const [error,setError]=useState('');const [loaded,setLoaded]=useState(false);const [busy,setBusy]=useState(false);
 const [pending,setPending]=useState<Pending|null>(null);const [note,setNote]=useState('');
 const [reviewing,setReviewing]=useState<string|null>(null);
 async function load(){try{const [{data,error},{data:details,error:detailsError}]=await Promise.all([supabase.rpc('admin_request_list'),supabase.from('owner_requests').select('id,phone,decision_note,request_billing_type,request_duration_days,request_price')]);if(error||detailsError)throw error??detailsError;setRows((data??[]).map(r=>{const d=details?.find(d=>d.id===r.id);return {...r,phone:d?.phone??'',note:d?.decision_note??'',request_billing_type:d?.request_billing_type??null,request_duration_days:d?.request_duration_days??null,request_price:d?.request_price??null};}));setError('');}catch(e){setError(e instanceof Error?e.message:'Could not load gym requests. Please reload.');}}
 useEffect(()=>{void load().finally(()=>setLoaded(true));},[]);
 async function review(id:string,approve:boolean,reason=''){
  setBusy(true);setError('');
  try {const {error}=await supabase.rpc('review_owner_request',{request_id:id,approve,note:reason.trim()});if(error)throw error;toast.success(approve?'Gym approved — subscription active, no payment collected':'Request rejected — the gym is blocked from its dashboard');setPending(null);setNote('');await load();}
  catch(e){setError(e instanceof Error?e.message:'Could not save the decision. Please try again.');}
  finally{setBusy(false);}
 }
 function approve(id:string,name:string){if(window.confirm(`Approve ${name}?`))void review(id,true);}
 const open=(id:string,name:string,mode:Pending['mode'])=>{setNote('');setPending({id,name,mode});};
 const pendingRows=rows.filter(r=>r.status==='Pending');
 const decidedRows=rows.filter(r=>r.status!=='Pending');
 const reviewRow=rows.find(r=>r.id===reviewing);
 const table=(items:AdminRequest[],decided=false)=><DataTable head={['Gym Name','Owner','Contact','Plan','Submitted','Status','Actions']}>
  {items.map(r=><tr key={r.id} className={r.id===reviewing?'bg-secondary':''}>
   <td className={td}>{r.gym_name}</td><td className={td}>{r.owner_name}<span className="block text-xs text-muted-foreground">Email: {r.owner_email&&r.owner_email!=='—'?r.owner_email:'Not provided'}</span></td><td className={td}>{r.phone||'Not provided'}</td><td className={td}>{r.plan}{r.request_billing_type&&<span className="block text-xs text-muted-foreground">{r.request_billing_type} · {r.request_duration_days} days · {egp(Number(r.request_price??0))}</span>}</td><td className={td}>{r.created_at.slice(0,10)}</td><td className={td}>{r.status}{r.status==='Rejected'&&r.note?<span className="block max-w-56 whitespace-pre-wrap break-words text-xs text-muted-foreground">Reason: {r.note}</span>:null}</td>
   <td className={td}><div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={()=>setReviewing(id=>id===r.id?null:r.id)}>{reviewing===r.id?'Close review':'Review'}</Button>{!decided&&<><Button size="sm" disabled={busy} onClick={()=>approve(r.id,r.gym_name)}>Approve</Button><Button size="sm" variant="destructive" disabled={busy} onClick={()=>open(r.id,r.gym_name,'reject')}>Reject</Button></>}{decided&&r.status==='Rejected'&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>approve(r.id,r.gym_name)}>Edit — Approve</Button>}{decided&&r.status==='Approved'&&<Button size="sm" variant="destructive" disabled={busy} onClick={()=>open(r.id,r.gym_name,'revoke')}>Revoke</Button>}</div></td>
  </tr>)}
 </DataTable>;
 return <div><PageHeader title="Gym Requests" subtitle={`Pending: ${pendingRows.length} · Approved: ${decidedRows.filter(r=>r.status==='Approved').length} · Rejected: ${decidedRows.filter(r=>r.status==='Rejected').length}`}/>{error&&<p role="alert" className="mb-4 text-destructive">{error}<Button variant="outline" className="ml-3" onClick={()=>void load()}>Retry</Button></p>}
  {reviewRow&&<section className="mb-6 border-y py-4" aria-label="Request review"><h2 className="font-semibold">Review: {reviewRow.gym_name}</h2><p className="mt-2 text-sm">Owner: {reviewRow.owner_name} · Plan: {reviewRow.plan}{reviewRow.request_billing_type?` · ${reviewRow.request_billing_type} · ${reviewRow.request_duration_days} days · ${egp(Number(reviewRow.request_price??0))}`:''} · Phone: {reviewRow.phone||'Not provided'} · Email: {reviewRow.owner_email&&reviewRow.owner_email!=='—'?reviewRow.owner_email:'Not provided'}</p><p className="mt-1 text-sm text-muted-foreground">Submitted {new Date(reviewRow.created_at).toLocaleString()} · Status: {reviewRow.status}{reviewRow.decided_at?` · Decided ${new Date(reviewRow.decided_at).toLocaleString()}`:''}</p>{reviewRow.note&&<p className="mt-2 whitespace-pre-wrap text-sm">Reason: {reviewRow.note}</p>}{reviewRow.status==='Pending'&&<div className="mt-3 flex gap-2"><Button size="sm" disabled={busy} onClick={()=>approve(reviewRow.id,reviewRow.gym_name)}>Approve</Button><Button size="sm" variant="destructive" disabled={busy} onClick={()=>open(reviewRow.id,reviewRow.gym_name,'reject')}>Reject</Button></div>}</section>}
  {!loaded?<TableSkeleton cols={7}/>:<><h2 className="mb-3 text-lg font-semibold">Pending requests</h2>{table(pendingRows)}{!pendingRows.length&&<p className="py-6 text-muted-foreground">No pending requests.</p>}<h2 className="mb-3 mt-10 text-lg font-semibold">Decided</h2>{table(decidedRows,true)}{!decidedRows.length&&<p className="py-6 text-muted-foreground">No decided requests.</p>}</>}
  <Dialog open={!!pending} onOpenChange={o=>{if(!o)setPending(null);}}><DialogContent><DialogHeader><DialogTitle>{pending?titles[pending.mode]:''}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{pending?.mode==='revoke'?'This approved gym will be marked Rejected and blocked from the gym dashboard.':`${pending?.name} will be marked Rejected and blocked from the gym dashboard.`} The request and its history are kept.</p><label className="text-sm font-medium" htmlFor="reject-note">Notes / reason (optional, shown to the gym owner)</label><Textarea id="reject-note" maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/><div className="flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={()=>setPending(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={()=>pending&&void review(pending.id,false,note)}>{busy?'Saving…':'Confirm'}</Button></div></DialogContent></Dialog>
 </div>;
}
