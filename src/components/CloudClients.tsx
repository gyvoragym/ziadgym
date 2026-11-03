import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { listClients, updateClient, deleteClientAccount } from '@/lib/clients.functions';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Avatar, DataTable, Field, PageHeader, TableSkeleton, td } from './kit';
import { ExerciseImage } from './ProgramEditor';
import { initials } from '@/lib/mock';
import { uploadImage } from '@/lib/images';
import { toast } from 'sonner';
import { useCloud } from './CloudProvider';
import { sendAccountMessage, setClientFrozen } from '@/lib/account-messages.functions';
import { Textarea } from './ui/textarea';
import { MessageSquare } from 'lucide-react';
type Client = Awaited<ReturnType<typeof listClients>>[number];
export function CloudClients({gymId}: {gymId?: string}) {
  const cloud = useCloud();
  const fetch = useServerFn(listClients); const update = useServerFn(updateClient); const remove = useServerFn(deleteClientAccount);
  const [rows,setRows] = useState<Client[]>([]); const [error,setError] = useState(''); const [loading,setLoading] = useState(true);
  const [editing,setEditing] = useState<Client | null>(null); const [deleting,setDeleting] = useState<Client | null>(null);
  const [messaging,setMessaging] = useState<Client | null>(null); const [messageBody,setMessageBody] = useState('');
  const [freezing,setFreezing] = useState<Client | null>(null); const [freezeNote,setFreezeNote] = useState(''); const [freezeMessage,setFreezeMessage] = useState('');
  const [details,setDetails] = useState({name:'',email:'',phone:'',photo:''}); const [busy,setBusy] = useState(false);
  const sendMessage = useServerFn(sendAccountMessage); const freezeClient = useServerFn(setClientFrozen);
  const input = gymId ? {gymId} : {};
  async function refresh() {setLoading(true);try {setRows(await fetch({data:input}));setError('');} catch(e){setError(e instanceof Error ? e.message : 'Could not load clients');} finally{setLoading(false);}}
  useEffect(() => {void refresh();},[gymId]);
  return <div className="space-y-4">
    <PageHeader title={gymId ? 'Client accounts' : 'Clients'} subtitle={loading ? 'Loading clients…' : `${rows.length} saved client accounts`} />
    {error && <p role="alert" className="text-destructive">{error}<Button variant="outline" className="ml-3" onClick={()=>void refresh()}>Retry</Button></p>}
    {loading && !rows.length ? <TableSkeleton cols={6} /> : <DataTable head={['Client','GYVORA ID','Registered contact','Gyms','Status','Actions']}>{rows.map(p=><tr key={p.id}>
      <td className={td}><div className="flex items-center gap-3">{p.photo ? <ExerciseImage path={p.photo} alt={`${p.full_name} photo`} className="h-10 w-10 rounded-full object-cover"/> : <Avatar initials={initials(p.full_name || 'Client')}/>}<span>{p.full_name || 'Name not provided'}</span></div></td>
      <td className={td}><span className="break-all">{p.gyvora_id || 'Unavailable'}</span></td>
      <td className={td}><p className="break-all">{p.email || 'Email not provided'}</p><p className="text-xs text-muted-foreground">{p.phone || 'Phone not provided'}</p></td>
      <td className={td}>{p.gyms.map(g=>g.name).join(', ') || 'No gym memberships'}</td>
      <td className={td}>{p.disabled_at ? 'Deactivated' : p.frozen_at ? 'Frozen' : 'Active'}</td>
      <td className={td}><div className="flex flex-wrap gap-2">
        <Button size="icon" variant="ghost" aria-label={`Message ${p.full_name || 'client'}`} title="Send message" disabled={!!p.disabled_at} onClick={()=>{setMessaging(p);setMessageBody('');}}><MessageSquare className="h-4 w-4"/></Button>
        <Button size="sm" variant="outline" disabled={!!p.disabled_at} onClick={()=>{setEditing(p);setDetails({name:p.full_name,email:p.email,phone:p.phone,photo:p.photo});}}>Edit</Button>
        {p.frozen_at
          ? <Button size="sm" variant="secondary" disabled={busy} onClick={async()=>{if(!window.confirm(`Unfreeze ${p.full_name || 'this client'}? They regain access to their account.`))return;setBusy(true);try{await freezeClient({data:{target:p.id,frozen:false}});toast.success('Client unfrozen');await refresh();}catch(e){toast.error(e instanceof Error?e.message:'Could not unfreeze client');}finally{setBusy(false);}}}>Unfreeze</Button>
          : <Button size="sm" variant="secondary" disabled={!!p.disabled_at} onClick={()=>{setFreezing(p);setFreezeNote('');setFreezeMessage('');}}>Freeze</Button>}
        <Button size="sm" variant="destructive" onClick={()=>setDeleting(p)}>{p.disabled_at ? 'Retry Delete' : 'Delete'}</Button>
      </div></td>
    </tr>)}</DataTable>}
    {!loading && !error && !rows.length && <p className="py-6 text-muted-foreground">No clients.</p>}
    <Dialog open={!!editing} onOpenChange={v=>{if(!busy&&!v)setEditing(null);}}><DialogContent><DialogHeader><DialogTitle>Edit client</DialogTitle></DialogHeader><div className="space-y-4">
      <Field label="Full name"><Input value={details.name} onChange={e=>setDetails(d=>({...d,name:e.target.value}))} maxLength={100}/></Field>
      <Field label="Registered email"><Input type="email" value={details.email} onChange={e=>setDetails(d=>({...d,email:e.target.value}))}/></Field>
      <Field label="Phone number"><Input type="tel" value={details.phone} onChange={e=>setDetails(d=>({...d,phone:e.target.value}))} maxLength={30}/></Field>
      <Field label="Profile photo"><Input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setBusy(true);try{const photo=await uploadImage(file);setDetails(d=>({...d,photo}));}catch(e){toast.error(e instanceof Error?e.message:'Upload failed');}finally{setBusy(false);}}}/></Field>
      {details.photo && <ExerciseImage path={details.photo} alt="Client photo" className="h-16 w-16 rounded-full object-cover"/>}
    </div><DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setEditing(null)}>Cancel</Button><Button disabled={busy} onClick={async()=>{if(!editing)return;setBusy(true);try{await update({data:{...input,id:editing.id,details}});toast.success('Client updated');setEditing(null);await refresh();}catch(e){toast.error(e instanceof Error?e.message:'Could not save client');}finally{setBusy(false);}}}>{busy?'Saving…':'Save'}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={v=>{if(!busy&&!v)setDeleting(null);}}><DialogContent><DialogHeader><DialogTitle>{gymId?'Remove client from this gym':'Deactivate client account'}</DialogTitle></DialogHeader><p className="break-words">{deleting?.full_name} · {deleting?.email}</p><p className="text-sm text-muted-foreground">{gymId ? 'Remove this gym membership only. Their account and other gyms will remain unchanged.' : 'This blocks sign-in and app access. Saved memberships and history will be retained, not erased.'}</p><DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={async()=>{if(!deleting)return;setBusy(true);try{await remove({data:{...input,id:deleting.id}});toast.success(gymId?'Client removed from this gym':'Client account deactivated');setDeleting(null);await refresh();}catch(e){toast.error(e instanceof Error?e.message:'Could not delete client');}finally{setBusy(false);}}}>{busy?'Deleting…':'Confirm Delete'}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!messaging} onOpenChange={v=>{if(!busy&&!v)setMessaging(null);}}><DialogContent><DialogHeader><DialogTitle>Message {messaging?.full_name || 'client'}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">This in-app message will appear in the client's Notifications page and remain after refresh.</p><label className="block text-sm">Message<Textarea className="mt-2" rows={4} maxLength={2000} value={messageBody} onChange={e=>setMessageBody(e.target.value)} placeholder="Write your message…"/></label><DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setMessaging(null)}>Cancel</Button><Button disabled={busy||!messageBody.trim()} onClick={async()=>{if(!messaging)return;setBusy(true);try{await sendMessage({data:{target:messaging.id,body:messageBody}});toast.success('Message sent');setMessaging(null);}catch(e){toast.error(e instanceof Error?e.message:'Could not send message');}finally{setBusy(false);}}}>{busy?'Sending…':'Send message'}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!freezing} onOpenChange={v=>{if(!busy&&!v)setFreezing(null);}}><DialogContent><DialogHeader><DialogTitle>Freeze {freezing?.full_name || 'client'}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">The client will be blocked from their account pages and data until you unfreeze them. Their account and data are retained.</p><div className="space-y-4"><label className="block text-sm">Reason (optional, shown to the client)<Textarea className="mt-2" rows={3} maxLength={1000} value={freezeNote} onChange={e=>setFreezeNote(e.target.value)}/></label><label className="block text-sm">Message to the client (optional)<Textarea className="mt-2" rows={3} maxLength={2000} value={freezeMessage} onChange={e=>setFreezeMessage(e.target.value)} placeholder="Also send an in-app message…"/></label></div><DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setFreezing(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={async()=>{if(!freezing)return;setBusy(true);try{await freezeClient({data:{target:freezing.id,frozen:true,note:freezeNote}});if(freezeMessage.trim())await sendMessage({data:{target:freezing.id,body:freezeMessage}});toast.success('Client frozen');setFreezing(null);await refresh();}catch(e){toast.error(e instanceof Error?e.message:'Could not freeze client');}finally{setBusy(false);}}}>{busy?'Freezing…':'Freeze account'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}