import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader, DataTable, td, Avatar, Field } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { initials } from '@/lib/mock';
import { useDemoStore, editClient, deleteClient, removeClientGym, sendDemoAdminMessage, setDemoClientFrozen, getDemoAccounts, demoUserId, demoClientDirectory, isSeededDashboardRecord, type DemoClient } from '@/lib/demo';
import { CloudClients } from '@/components/CloudClients';
import { getDemoSession } from '@/lib/demo';
import { seo } from '@/lib/seo';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare } from 'lucide-react';
import { demoIdentity } from '@/lib/demo-identities';
import { useLocalAdminAccounts } from '@/hooks/use-local-admin-accounts';
import { sendLocalAdminMessage } from '@/lib/local-account-messages';
import { readPreviewSession } from '@/lib/preview-session';

export const Route = createFileRoute('/super-admin/clients')({
  head: () => seo('Clients', 'Review and manage saved GYVORA client profiles and account access.'),
  component: Clients,
});

function Clients() {
  return getDemoSession() || !!readPreviewSession()?.adminToken ? <DemoClients /> : <CloudClients />;
}
function DemoClients() {
  const { accounts: apiAccounts, error: accountError, loading: accountsLoading } = useLocalAdminAccounts();
  const seeded = useDemoStore((s) => s.clients).filter((client) => !isSeededDashboardRecord(client.id));
  const registered: Array<DemoClient & { source: 'prototype' | 'api'; active?: boolean; email?: string }> = [
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
      .map((account) => ({ id: account.id, name: account.fullName || account.phone, phone: account.phone, email: account.email, photo: '', gyms: [], source: 'api' as const, active: account.isActive })),
  ];
  const [editing, setEditing] = useState<DemoClient | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const freezeMap = useDemoStore((s) => s.clientFreeze) ?? {};
  const [messaging, setMessaging] = useState<(DemoClient & { source: 'prototype' | 'api' }) | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [freezing, setFreezing] = useState<DemoClient | null>(null);
  const [freezeNote, setFreezeNote] = useState('');
  const [freezeMessage, setFreezeMessage] = useState('');
  const [sending, setSending] = useState(false);

  function openEdit(c: DemoClient) {
    setEditing(c);
    setName(c.name);
    setPhone(c.phone);
  }

  function saveEdit() {
    if (!editing) return;
    if (!name.trim()) {
      toast.error('Client name is required');
      return;
    }
    editClient(editing.id, { name: name.trim(), phone: phone.trim() });
    toast.success('Client updated (demo).');
    setEditing(null);
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
            <td className={td}><span className={freezeMap[c.id] ? 'text-destructive' : 'text-success'}>{freezeMap[c.id] ? 'Frozen' : c.active === false ? 'Deactivated' : 'Active'}</span></td>
            <td className={td}>
              {c.source === 'api' ? <Button size="icon" variant="ghost" aria-label={`Message ${c.name}`} title="Send message" disabled={c.active === false} onClick={() => { setMessaging(c); setMessageBody(''); }}><MessageSquare className="h-4 w-4" /></Button> : <div className="flex flex-wrap gap-2">
                <Button size="icon" variant="ghost" aria-label={`Message ${c.name}`} title="Send message" onClick={() => { setMessaging(c); setMessageBody(''); }}><MessageSquare className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(c)}>Edit</Button>
                {freezeMap[c.id]
                  ? <Button size="sm" variant="secondary" onClick={() => { if (window.confirm(`Unfreeze ${c.name}? They regain access to their demo account.`)) { setDemoClientFrozen(c.id, false, ''); toast.success(`${c.name} unfrozen (demo).`); } }}>Unfreeze</Button>
                  : <Button size="sm" variant="secondary" onClick={() => { setFreezing(c); setFreezeNote(''); setFreezeMessage(''); }}>Freeze</Button>}
                <Button size="sm" variant="destructive" onClick={() => { if (window.confirm(`Delete ${c.name} entirely? This removes all their demo gym memberships.`)) { deleteClient(c.id); toast.success(`${c.name} deleted (demo).`); } }}>Delete</Button>
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
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={saveEdit}>Save</Button>
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
          <p className="text-sm text-muted-foreground">Demo only: the client is blocked from their demo account pages on this browser until unfrozen. Account and data are retained.</p>
          <div className="space-y-4">
            <label className="block text-sm">Reason (optional, shown to the client)<Textarea className="mt-2" rows={3} maxLength={1000} value={freezeNote} onChange={(e) => setFreezeNote(e.target.value)} /></label>
            <label className="block text-sm">Message to the client (optional)<Textarea className="mt-2" rows={3} maxLength={2000} value={freezeMessage} onChange={(e) => setFreezeMessage(e.target.value)} /></label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFreezing(null)}>Cancel</Button><Button variant="destructive" onClick={() => { if (!freezing) return; try { setDemoClientFrozen(freezing.id, true, freezeNote); if (freezeMessage.trim()) sendDemoAdminMessage(freezing.id, freezeMessage); toast.success(`${freezing.name} frozen (demo).`); setFreezing(null); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not freeze client'); } }}>Freeze account</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
