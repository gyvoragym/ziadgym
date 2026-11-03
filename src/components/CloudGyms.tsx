import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { listAdminGyms, setGymFrozen, changeGymDeletion, editAdminGym, setGymAdminNote, setGymDeletionNote } from '@/lib/platform-admin.functions';
import { Input } from './ui/input';
import { Field } from './kit';
import { Button } from './ui/button';
import { DataTable, PageHeader, TableSkeleton, td } from './kit';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { sendAccountMessage } from '@/lib/account-messages.functions';
import { MessageSquare } from 'lucide-react';
import { AdminNoteCell } from './AdminNoteCell';
import { gymPrices } from '@/lib/platform-subscriptions';
import { egp } from '@/lib/mock';
import { approvedGymColumns, approvedGymColumnWidths, approvedGymTableMinWidth, approvedGymTotals, formatGymDate } from '@/lib/approved-gym-columns';

type AdminGym = Awaited<ReturnType<typeof listAdminGyms>>[number];

const deletedHead = ['#','Gym Name','Owner','Contact','Deletion date','Notes / Reason','Actions'];

export function CloudGyms({ deleted = false }: { deleted?: boolean }) {
  const list = useServerFn(listAdminGyms);
  const freeze = useServerFn(setGymFrozen);
  const remove = useServerFn(changeGymDeletion);
  const saveGym = useServerFn(editAdminGym);
  const saveNote = useServerFn(setGymAdminNote);
  const saveDeletionNote = useServerFn(setGymDeletionNote);
  const [editing,setEditing]=useState<AdminGym|null>(null);
  const [gymName,setGymName]=useState('');
  const [rows, setRows] = useState<AdminGym[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [freezing, setFreezing] = useState<AdminGym | null>(null);
  const [note, setNote] = useState('');
  const [deleting, setDeleting] = useState<AdminGym | null>(null);
  const [restoring, setRestoring] = useState<AdminGym | null>(null);
  const [deletionNote, setDeletionNote] = useState('');
  const [messaging, setMessaging] = useState<AdminGym | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const sendMessage = useServerFn(sendAccountMessage);

  async function load() {
    try { setRows(await list({})); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load gyms. Please reload.'); }
    finally { setLoaded(true); }
  }
  useEffect(() => { void load(); }, []);

  async function confirmFreeze() {
    if (!freezing) return;
    setBusy(true); setError('');
    try {
      await freeze({ data: { gymId: freezing.id, frozen: true, note } });
      toast.success(`${freezing.name} frozen — the owner is blocked from the dashboard.`);
      setFreezing(null); setNote('');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not freeze the gym.'); }
    finally { setBusy(false); }
  }

  async function unfreeze(g: AdminGym) {
    if (!window.confirm(`Unfreeze ${g.name}? The owner regains dashboard access.`)) return;
    setBusy(true); setError('');
    try {
      await freeze({ data: { gymId: g.id, frozen: false } });
      toast.success(`${g.name} reactivated.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not unfreeze the gym.'); }
    finally { setBusy(false); }
  }

  async function confirmDeletion() {
    const target = deleting ?? restoring;
    if (!target) return;
    setBusy(true); setError('');
    try {
      await remove({data:{gymId:target.id,deleted:!!deleting,note:deletionNote}});
      toast.success(deleting ? 'Gym moved to Deleted Gyms.' : 'Gym restored to Approved Gyms.');
      setDeleting(null); setRestoring(null); setDeletionNote(''); await load();
    } catch(e) { setError(e instanceof Error ? e.message : 'Could not update the gym.'); }
    finally { setBusy(false); }
  }
  const visibleRows=rows.filter(g=>g.deleted===deleted);
  const totals = deleted ? { monthlyPrice: 0, annualPrice: 0 } : approvedGymTotals(visibleRows);

  return (
    <div>
      <PageHeader title={deleted ? "Deleted Gyms" : "Approved Gyms"} subtitle={deleted ? `Total deleted gyms: ${visibleRows.length}` : ''} />
      {!deleted && loaded && <div className="panel mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3 text-sm">
        <span className="font-semibold">Total approved gyms: {visibleRows.length}</span>
        <span className="text-muted-foreground">Total monthly price: <span className="font-semibold tabular-nums text-foreground">{egp(totals.monthlyPrice)}</span></span>
        <span className="text-muted-foreground">Total annual price: <span className="font-semibold tabular-nums text-foreground">{egp(totals.annualPrice)}</span></span>
      </div>}
      {error && <p role="alert" className="mb-4 text-destructive">{error}</p>}
      {!loaded ? <TableSkeleton cols={deleted ? 7 : 12} /> : <><DataTable head={deleted ? deletedHead : approvedGymColumns} widths={deleted ? undefined : approvedGymColumnWidths} minWidth={deleted ? 640 : approvedGymTableMinWidth}>
        {visibleRows.map((g, i) => {
          const prices = gymPrices({ plan: g.plan });
          return (
          <tr key={g.id}>
            {deleted ? <>
              <td className={td}>{i + 1}</td>
              <td className={td}>{g.name}</td>
              <td className={td}>{g.ownerName || '—'}<span className="block text-xs text-muted-foreground">Email: {g.ownerEmail || 'Not provided'}</span></td><td className={td}>{g.ownerPhone || 'Not provided'}</td>
              <td className={td}>{g.deletedAt ? new Date(g.deletedAt).toLocaleString() : '—'}</td>
              <td className={td}><AdminNoteCell gymName={g.name} note={g.deletionNote || ''} title="Deletion reason" description="Reason this gym was deleted. Separate from freeze notes and request rejection notes." emptyText="–" saveLabel="Save" onSave={async note=>{await saveDeletionNote({data:{gymId:g.id,note}});await load();}} /></td>
              <td className={td}><Button size="sm" variant="outline" disabled={busy} onClick={()=>setRestoring(g)}>Edit / Restore</Button></td>
            </> : <>
              <td className={`${td} tabular-nums`}>{i + 1}</td>
              <td className={`${td} min-w-[15rem]`}>{g.name}</td>
              <td className={`${td} max-w-[18rem] break-words`}>{g.ownerEmail || 'Not provided'}</td>
              <td className={`${td} whitespace-nowrap`}>{g.ownerPhone || 'Not provided'}</td>
              <td className={`${td} whitespace-nowrap`}>{g.plan || '—'}</td>
              <td className={`${td} whitespace-nowrap tabular-nums`}>{prices.monthlyPrice > 0 ? egp(prices.monthlyPrice) : '—'}</td>
              <td className={`${td} whitespace-nowrap tabular-nums`}>{prices.annualPrice > 0 ? egp(prices.annualPrice) : '—'}</td>
              <td className={`${td} whitespace-nowrap tabular-nums`}>{formatGymDate(g.subscriptionStart)}</td>
              <td className={`${td} whitespace-nowrap tabular-nums`}>{formatGymDate(g.subscriptionEnd)}</td>
              <td className={`${td} whitespace-nowrap`}><span className={g.frozen ? 'text-destructive' : 'text-success'}>{g.frozen ? 'Frozen' : 'Active'}</span></td>
              <td className={td}><AdminNoteCell gymName={g.name} note={g.adminNote} onSave={async note=>{await saveNote({data:{gymId:g.id,note}});await load();}} /></td>
              <td className={`${td} min-w-[19rem]`}><div className="flex flex-nowrap gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={()=>{setEditing(g);setGymName(g.name);}}>Edit</Button>
                {g.frozen ? <Button size="sm" variant="secondary" disabled={busy} onClick={()=>void unfreeze(g)}>Unfreeze</Button> : <Button size="sm" variant="secondary" disabled={busy} onClick={()=>{setFreezing(g);setNote('');}}>Freeze</Button>}
                <Button size="sm" variant="destructive" disabled={busy} onClick={()=>{setDeleting(g);setDeletionNote('');}}>Delete</Button>
                <Button size="icon" variant="ghost" aria-label={`Message ${g.name} owner`} disabled={busy} onClick={()=>{setMessaging(g);setMessageBody('');}}><MessageSquare className="h-4 w-4"/></Button>
              </div></td>
            </>}
          </tr>
          );
        })}
      </DataTable></>}
      {!visibleRows.length && <p className="py-6 text-muted-foreground">{deleted ? "No deleted gyms." : "No approved gyms yet. Approve a request to add one."}</p>}
      <Dialog open={!!editing} onOpenChange={open=>{if(!open)setEditing(null);}}><DialogContent><DialogHeader><DialogTitle>Edit gym</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={async e=>{e.preventDefault();if(!editing)return;setBusy(true);try{await saveGym({data:{gymId:editing.id,name:gymName}});setEditing(null);await load();toast.success('Gym details saved.');}catch(e){setError(e instanceof Error?e.message:'Could not save gym.');}finally{setBusy(false);}}}><Field label="Gym name"><Input required maxLength={100} value={gymName} onChange={e=>setGymName(e.target.value)}/></Field><DialogFooter><Button type="button" variant="outline" onClick={()=>setEditing(null)}>Cancel</Button><Button disabled={busy}>Save</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={!!deleting || !!restoring} onOpenChange={open=>{if(!open){setDeleting(null);setRestoring(null);}}}>
        <DialogContent><DialogHeader><DialogTitle>{deleting ? 'Delete' : 'Restore'} {(deleting ?? restoring)?.name}</DialogTitle></DialogHeader>
          {deleting ? <><p className="text-sm text-muted-foreground">The gym will be suspended until restored. The owner can still sign in; all memberships and gym data are retained.</p><label className="text-sm">Notes / Reason<Textarea className="mt-2" rows={4} maxLength={1000} value={deletionNote} onChange={e=>setDeletionNote(e.target.value)}/></label></> : <><p className="text-sm text-muted-foreground">Restore this gym to Approved Gyms? Its previous deletion reason and history will be retained. Any separate Freeze restriction remains.</p><p className="whitespace-pre-wrap break-words text-sm">{restoring?.deletionNote || 'No deletion note recorded.'}</p></>}
          <DialogFooter><Button variant="outline" disabled={busy} onClick={()=>{setDeleting(null);setRestoring(null);}}>Cancel</Button><Button variant={deleting ? 'destructive' : 'default'} disabled={busy} onClick={()=>void confirmDeletion()}>{busy ? 'Saving…' : deleting ? 'Confirm delete' : 'Restore to Approved'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!messaging} onOpenChange={(open)=>{if(!busy&&!open)setMessaging(null);}}>
        <DialogContent><DialogHeader><DialogTitle>Message {messaging?.name} owner</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This in-app message will appear in the gym owner's Notifications and remain after refresh.</p>
          <label className="block text-sm">Message<Textarea className="mt-2" rows={4} maxLength={2000} value={messageBody} onChange={(e)=>setMessageBody(e.target.value)} placeholder="Write your message…"/></label>
          <DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setMessaging(null)}>Cancel</Button><Button disabled={busy||!messageBody.trim()} onClick={async()=>{if(!messaging)return;setBusy(true);setError('');try{await sendMessage({data:{target:messaging.ownerId,body:messageBody}});toast.success(`Message sent to ${messaging.name}'s owner.`);setMessaging(null);}catch(e){setError(e instanceof Error?e.message:'Could not send the message.');}finally{setBusy(false);}}}>{busy?'Sending…':'Send message'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!freezing} onOpenChange={(open) => { if (!open) setFreezing(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Freeze {freezing?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">The gym owner will be blocked from the dashboard until you unfreeze the account. You can add a reason below — it will be shown to the owner.</p>
          <label className="block text-sm">
            Notes (optional)
            <Textarea className="mt-2" rows={4} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for freezing this account…" />
          </label>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFreezing(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={() => void confirmFreeze()}>{busy ? 'Freezing…' : 'Freeze account'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
