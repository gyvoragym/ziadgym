import {useEffect,useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import type {Database} from '@/integrations/supabase/types';
import {Button} from './ui/button';
import {Textarea} from './ui/textarea';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from './ui/dialog';
import {DataTable,PageHeader,TableSkeleton,td} from './kit';
import {toast} from 'sonner';

type AdminRequest=Database['public']['Functions']['admin_request_list']['Returns'][number] & {phone?:string;note?:string};
type Pending={id:string;name:string;mode:'reject'|'delete'|'revoke'};
const titles={reject:'Reject request',delete:'Delete request (rejects and blocks the gym)',revoke:'Revoke approved gym'};

export function CloudGymRequests(){
 const [rows,setRows]=useState<AdminRequest[]>([]);
 const [error,setError]=useState('');const [loaded,setLoaded]=useState(false);const [busy,setBusy]=useState(false);
 const [pending,setPending]=useState<Pending|null>(null);const [note,setNote]=useState('');
 async function load(){const [{data,error},{data:contacts,error:contactError}]=await Promise.all([supabase.rpc('admin_request_list'),supabase.from('owner_requests').select('id,phone,decision_note')]);if(error||contactError)setError('Could not load gym requests. Please reload.');else {setRows((data??[]).map(r=>{const c=contacts?.find(c=>c.id===r.id);return {...r,phone:c?.phone??'',note:c?.decision_note??''};}));setError('');}}
 useEffect(()=>{void load().finally(()=>setLoaded(true));},[]);
 async function review(id:string,approve:boolean,reason=''){
  setBusy(true);setError('');
  try {const {error}=await supabase.rpc('review_owner_request',{request_id:id,approve,note:reason.trim()});if(error)throw error;toast.success(approve?'Gym approved — subscription active, no payment collected':'Request rejected — the gym is blocked from its dashboard');setPending(null);setNote('');await load();}
  catch(e){setError(e instanceof Error?e.message:'Could not save the decision. Please try again.');}
  finally{setBusy(false);}
 }
 function approve(id:string,name:string){if(window.confirm(`Approve ${name}?`))void review(id,true);}
 const open=(id:string,name:string,mode:Pending['mode'])=>{setNote('');setPending({id,name,mode});};
 return <div><PageHeader title="Gym Requests" subtitle={`Pending: ${rows.filter(r=>r.status==='Pending').length} · Approved: ${rows.filter(r=>r.status==='Approved').length} · Rejected: ${rows.filter(r=>r.status==='Rejected').length}`}/>{error&&<p role="alert" className="mb-4 text-destructive">{error}</p>}{!loaded?<TableSkeleton cols={7}/>:<><DataTable head={['Gym Name','Owner','Contact','Plan','Submitted','Status','Decision']}>
 {rows.map(r=><tr key={r.id}><td className={td}>{r.gym_name}</td><td className={td}>{r.owner_name}<span className="block text-xs text-muted-foreground">Email: {r.owner_email&&r.owner_email!=='—'?r.owner_email:'Not provided'}</span></td><td className={td}>{r.phone||'Not provided'}</td><td className={td}>{r.plan}</td><td className={td}>{r.created_at.slice(0,10)}</td><td className={td}>{r.status}{r.status==='Rejected'&&r.note?<span className="block max-w-56 whitespace-pre-wrap break-words text-xs text-muted-foreground">Reason: {r.note}</span>:null}</td><td className={td}>{r.status==='Pending'?<div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={()=>approve(r.id,r.gym_name)}>Approve</Button><Button size="sm" variant="destructive" disabled={busy} onClick={()=>open(r.id,r.gym_name,'reject')}>Reject</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>open(r.id,r.gym_name,'delete')}>Delete</Button></div>:<div className="flex flex-wrap items-center gap-2"><span>{r.decided_at?.slice(0,10)??'—'}</span>{r.status==='Rejected'&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>approve(r.id,r.gym_name)}>Edit — Approve</Button>}{r.status==='Approved'&&<Button size="sm" variant="destructive" disabled={busy} onClick={()=>open(r.id,r.gym_name,'revoke')}>Revoke</Button>}</div>}</td></tr>)}
 </DataTable>{!rows.length&&<p className="py-6 text-muted-foreground">No requests recorded.</p>}</>}
 <Dialog open={!!pending} onOpenChange={o=>{if(!o)setPending(null);}}><DialogContent><DialogHeader><DialogTitle>{pending?titles[pending.mode]:''}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{pending?.name} will be marked Rejected and blocked from the gym dashboard. The request and its history are kept.</p><label className="text-sm font-medium" htmlFor="reject-note">Notes / reason (optional, shown to the gym owner)</label><Textarea id="reject-note" maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/><div className="flex justify-end gap-2"><Button variant="secondary" onClick={()=>setPending(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={()=>pending&&void review(pending.id,false,note)}>{busy?'Saving…':'Confirm'}</Button></div></DialogContent></Dialog>
 </div>;
}
