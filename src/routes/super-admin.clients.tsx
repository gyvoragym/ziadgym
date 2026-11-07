import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader, DataTable, td, Avatar, Field } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { initials } from '@/lib/mock';
import { useDemoStore, editClient, removeClientGym, sendDemoAdminMessage, setDemoClientFrozen, setDemoClientDeleted, getDemoAccounts, demoUserId, demoClientDirectory, isSeededDashboardRecord, type DemoClient } from '@/lib/demo';
import { CloudClients } from '@/components/CloudClients';
import { getDemoSession } from '@/lib/demo';
import { seo } from '@/lib/seo';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare } from 'lucide-react';
import { demoIdentity } from '@/lib/demo-identities';
import { useLocalAdminAccounts } from '@/hooks/use-local-admin-accounts';
import { sendLocalAdminMessage } from '@/lib/local-account-messages';
import { manageLocalAdminAccount, updateLocalAdminAccount } from '@/lib/local-admin-accounts';
import { readPreviewSession } from '@/lib/preview-session';

export const Route = createFileRoute('/super-admin/clients')({
  head: () => seo('Clients', 'Review and manage saved GYVORA client profiles and account access.'),
  component: Clients,
});

function Clients() {
  return getDemoSession() || !!readPreviewSession()?.adminToken ? <DemoClients /> : <CloudClients />;
}
function DemoClients() {
  const { accounts: apiAccounts, error: accountError, loading: accountsLoading, refresh: refreshAccounts } = useLocalAdminAccounts();
  const seeded = useDemoStore((s) => s.clients).filter((client) => !isSeededDashboardRecord(client.id));
  const registered: Array<DemoClient & { source: 'prototype' | 'api'; active?: boolean; email?: string; accountStatus?: 'active' | 'frozen' | 'deleted'; adminNote?: string }> = [
    ...seeded.map((client) => ({ ...client, source: 'prototype' as const })),
    ...getDemoAccounts()
      .filter((a) => a.type === 'individual')
      .map((a) => ({ id: demoUserId(a.email), name: a.name || a.email, phone: a.phone || '', email: a.email, photo: '', gyms: [], source: 'prototype' as const })),
    ...demoClientDirectory().filter((d) => !isSeededDashboardRecord(d.id)).map((d) => ({ id: d.id, name: d.name, phone: d.phone, email: d.email, photo: d.photo, gyms: [], source: 'prototype' as const })),
  ];
  const knownPhones = new Set(registered.map((client) => client.phone.replace(/\D/g, '')).filter(Boolean));
  const clients = [
    ...registered.filter((client, index) => registered.findIndex((other) => other.id === client.id) === index),
    ...apiAccounts
      .filter((account) => account.accountType === 'individual' && (!account.phone.replace(/\D/g, '') || !knownPhones.has(account.phone.replace(/\D/g, ''))))
      .map((account) => ({ id: account.id, name: account.fullName || account.phone, phone: account.phone, email: account.email, photo: '', gyms: [], source: 'api' as const, active: account.isActive, accountStatus: account.status, adminNote: account.adminNote })),
  ];
  const [editing, setEditing] = useState<(DemoClient & { source: 'prototype' | 'api'; email?: string }) | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const freezeMap = useDemoStore((s) => s.clientFreeze) ?? {};
  const deletionMap = useDemoStore((s) => s.clientDeletion) ?? {};
  const [messaging, setMessaging] = useState<(DemoClient & { source: 'prototype' | 'api'; email?: string }) | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [freezing, setFreezing] = useState<(DemoClient & { source: 'prototype' | 'api' }) | null>(null);
  const [freezeNote, setFreezeNote] = useState('');
  const [freezeMessage, setFreezeMessage] = useState('');
  const [deleting, setDeleting] = useState<(DemoClient & { source: 'prototype' | 'api'; email?: string }) | null>(null);
  const [deletionNote, setDeletionNote] = useState('');
  const [deletionMessage, setDeletionMessage] = useState('');
  const [sending, setSending] = useState(false);

  function openEdit(c: DemoClient & { source: 'prototype' | 'api'; email?: string }) {
    setEditing(c);
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email ?? '');
  }

  async function saveEdit() {
    if (!editing) return;
    if (!name.trim()) {
      toast.error('Client name is required');
      return;
    }
    setSending(true);
    try {
      if (editing.source === 'api') {
        await updateLocalAdminAccount(editing.id, { name: name.trim(), phone: phone.trim(), email: email.trim() });
        await refreshAccounts();
        toast.success('Client updated.');
      } else {
        editClient(editing.id, { name: name.trim(), phone: phone.trim() });
        toast.success('Client updated (demo).');
      }
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update client');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader title="Clients" subtitle={`Total client accounts: ${clients.length} · accounts recorded in this workspace.`} />
      {accountError && <p role="alert" className="mb-4 text-sm text-destructive">{accountError}</p>}
      {accountsLoading && <p role="status" className="mb-4 text-sm text-muted-foreground">Loading registered accounts…</p>}
      <DataTable head={['Client', 'GYVORA ID', 'Registered contact', 'Gyms', 'Status', 'Actions']}>
        {clients.map((c) => (
          <tr key={c.id}>
            <td className={td}>
              <div className="flex items-center gap-3">
                {c.photo ? <img src={c.photo} alt="" className="h-10 w-10 rounded-full object-cover" /> : <Avatar initials={initials(c.name)} />}
                <span className="font-medium">{c.name}</span>
              </div>
            </td>
            <td className={td}>{demoIdentity('C', c.id) ?? '—'}</td>
            <td className={td}><p>{c.email || 'Email not provided'}</p><p className="text-xs text-muted-foreground">{c.phone || 'Phone not provided'}</p></td>
            <td className={td}>
              <div className="flex flex-wrap gap-1.5">
                {c.gyms.map((g) => (
                  <span key={g} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs">
                    {g}
                    <button aria-label={`Remove ${c.name} from ${g}`} className="text-muted-foreground hover:text-destructive"
                      onClick={() => { removeClientGym(c.id, g); toast.success(`${c.name} removed from ${g} (demo). Other memberships kept.`); }}>×</button>
                  </span>
                ))}
                {!c.gyms.length && <span className="text-xs text-muted-foreground">No gyms</span>}
              </div>
            </td>
            <td className={td}><span className={c.source==='api'?(c.accountStatus==='active'?'text-success':'text-destructive'):deletionMap[c.id]||freezeMap[c.id]?'text-destructive':'text-success'}>{c.source==='api'?(c.accountStatus==='deleted'?'Banned':c.accountStatus==='frozen'?'Frozen':'Active'):deletionMap[c.id]?'Banned':freezeMap[c.id]?'Frozen':'Active'}</span>{c.source==='api'?c.adminNote&&<p className="mt-1 max-w-xs whitespace-pre-wrap text-xs text-muted-foreground">{c.adminNote}</p>:deletionMap[c.id]?.note&&<p className="mt-1 max-w-xs whitespace-pre-wrap text-xs text-muted-foreground">{deletionMap[c.id]?.note}</p>}</td>
            <td className={td}>
              {c.source === 'api' ? <div className="flex flex-wrap gap-2">
                <Button size="icon" variant="ghost" aria-label={`Message ${c.name}`} title="Send message" onClick={() => { setMessaging(c); setMessageBody(''); }}><MessageSquare className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" disabled={c.accountStatus==='deleted'||sending} onClick={() => openEdit(c)}>Edit</Button>
                {c.accountStatus==='frozen'&&<Button size="sm" variant="secondary" disabled={sending} onClick={async()=>{setSending(true);try{await manageLocalAdminAccount(c.id,'unfreeze');await refreshAccounts();toast.success(`${c.name} unfrozen.`);}catch(e){toast.error(e instanceof Error?e.message:'Could not unfreeze client');}finally{setSending(false);}}}>Unfreeze</Button>}
                {c.accountStatus==='active'&&<Button size="sm" variant="secondary" disabled={sending} onClick={()=>{setFreezing(c);setFreezeNote('');setFreezeMessage('');}}>Freeze</Button>}
                {c.accountStatus!=='deleted'&&<Button size="sm" variant="destructive" disabled={sending} onClick={()=>{setDeleting(c);setDeletionNote(c.adminNote??'');setDeletionMessage('');}}>Delete</Button>}
              </div> : <div className="flex flex-wrap gap-2">
                <Button size="icon" variant="ghost" aria-label={`Message ${c.name}`} title="Send message" onClick={() => { setMessaging(c); setMessageBody(''); }}><MessageSquare className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" disabled={!!deletionMap[c.id]} onClick={() => openEdit(c)}>Edit</Button>
                {!deletionMap[c.id]&&freezeMap[c.id]
                  ? <Button size="sm" variant="secondary" onClick={() => { if (window.confirm(`Unfreeze ${c.name}? They regain access to their demo account.`)) { setDemoClientFrozen(c.id, false, ''); toast.success(`${c.name} unfrozen (demo).`); } }}>Unfreeze</Button>
                  : !deletionMap[c.id]&&<Button size="sm" variant="secondary" onClick={() => { setFreezing(c); setFreezeNote(''); setFreezeMessage(''); }}>Freeze</Button>}
                {!deletionMap[c.id]&&<Button size="sm" variant="destructive" onClick={() => { setDeleting(c); setDeletionNote(''); setDeletionMessage(''); }}>Delete</Button>}
              </div>}
            </td>
          </tr>
        ))}
      </DataTable>
      {!clients.length && !accountsLoading && <p className="py-6 text-muted-foreground">No clients.</p>}

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4" role="dialog" aria-modal="true" aria-label="Edit client">
          <div className="panel w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold">Edit client</h3>
            <div className="mt-4 space-y-4">
              <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></Field>
              <Field label="Phone number"><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} /></Field>
              {editing.source==='api'&&<Field label="Email"><Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} maxLength={255}/></Field>}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" disabled={sending} onClick={() => setEditing(null)}>Cancel</Button>
              <Button disabled={sending} onClick={() => void saveEdit()}>{sending?'Saving…':'Save'}</Button>
            </div>
          </div>
        </div>
      )}
      <Dialog open={!!messaging} onOpenChange={(v) => { if (!v) setMessaging(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Message {messaging?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{messaging?.source === 'api' ? "This message will appear in the client's Notifications page and remain after refresh." : "Demo only: the message appears in this client's Notifications on this browser and remains after refresh."}</p>
          <label className="block text-sm">Message<Textarea className="mt-2" rows={4} maxLength={2000} value={messageBody} onChange={(e) => setMessageBody(e.target.value)} placeholder="Write your message…" /></label>
          <DialogFooter><Button variant="outline" disabled={sending} onClick={() => setMessaging(null)}>Cancel</Button><Button disabled={sending || !messageBody.trim()} onClick={async () => { if (!messaging) return; setSending(true); try { if (messaging.source === 'api') { if (!readPreviewSession()?.adminToken) throw new Error('Administrator session expired. Sign in again.'); await sendLocalAdminMessage(messaging.id, messageBody); } else sendDemoAdminMessage(messaging.id, messageBody); toast.success('Message sent.'); setMessaging(null); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not send message'); } finally { setSending(false); } }}>{sending ? 'Sending…' : 'Send message'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!freezing} onOpenChange={(v) => { if (!v) setFreezing(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Freeze {freezing?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{freezing?.source==='api'?'The client will be blocked from signing in until unfrozen. Their account and data are retained.':'Demo only: the client is blocked from their demo account pages on this browser until unfrozen. Account and data are retained.'}</p>
          <div className="space-y-4">
            <label className="block text-sm">Reason (optional, shown to the client)<Textarea className="mt-2" rows={3} maxLength={1000} value={freezeNote} onChange={(e) => setFreezeNote(e.target.value)} /></label>
            <label className="block text-sm">Message to the client (optional)<Textarea className="mt-2" rows={3} maxLength={2000} value={freezeMessage} onChange={(e) => setFreezeMessage(e.target.value)} /></label>
          </div>
          <DialogFooter><Button variant="outline" disabled={sending} onClick={() => setFreezing(null)}>Cancel</Button><Button variant="destructive" disabled={sending} onClick={async() => { if (!freezing) return; setSending(true); try { if(freezing.source==='api'){await manageLocalAdminAccount(freezing.id,'freeze',freezeNote,freezeMessage);await refreshAccounts();toast.success(`${freezing.name} frozen.`);}else{setDemoClientFrozen(freezing.id, true, freezeNote);if (freezeMessage.trim()) sendDemoAdminMessage(freezing.id, freezeMessage);toast.success(`${freezing.name} frozen (demo).`);}setFreezing(null); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not freeze client'); } finally {setSending(false);} }}>{sending?'Freezing…':'Freeze account'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleting} onOpenChange={(v) => { if (!v) setDeleting(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Delete {deleting?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{deleting?.source==='api'?'The client will be unable to sign in. Account history is retained.':'The client account will be blocked on this browser. Their account records and memberships are retained.'}</p>
          <div className="space-y-4">
            <label className="block text-sm">Reason (optional, shown to the client)<Textarea className="mt-2" rows={3} maxLength={1000} value={deletionNote} onChange={(e) => setDeletionNote(e.target.value)} /></label>
            <label className="block text-sm">Message to the client (optional)<Textarea className="mt-2" rows={3} maxLength={2000} value={deletionMessage} onChange={(e) => setDeletionMessage(e.target.value)} /></label>
          </div>
          <DialogFooter><Button variant="outline" disabled={sending} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={sending} onClick={async() => { if (!deleting) return; setSending(true); try { if(deleting.source==='api'){await manageLocalAdminAccount(deleting.id,'delete',deletionNote,deletionMessage);await refreshAccounts();toast.success(`${deleting.name} banned.`);}else{setDemoClientDeleted(deleting.id, deletionNote);if (deleting.email) setDemoClientDeleted(demoUserId(deleting.email), deletionNote);if (deletionMessage.trim()) sendDemoAdminMessage(deleting.id, deletionMessage);toast.success(`${deleting.name} banned (demo).`);}setDeleting(null); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not delete client'); } finally {setSending(false);} }}>{sending?'Deleting…':'Delete account'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
