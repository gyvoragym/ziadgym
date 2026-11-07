import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { PageHeader, DataTable, td, StatusPill } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useDemoStore, approveRequest, rejectRequest, getDemoSession, isSeededDashboardRecord } from '@/lib/demo';
import { CloudGymRequests } from '@/components/CloudGymRequests';
import { seo } from '@/lib/seo';
import { usePlatformAdmin } from '@/components/PlatformAdminProvider';
import { useLocalAdminAccounts } from '@/hooks/use-local-admin-accounts';
import { egp } from '@/lib/mock';

export const Route = createFileRoute('/super-admin/requests')({
  validateSearch: (search: Record<string,unknown>) => ({request: typeof search['request'] === 'string' ? search['request'] : undefined}),
  head: () => seo('Gym requests', 'Review fictional pending gym subscription requests.'),
  component: Requests,
});

function Requests() {
  const {request}=Route.useSearch();
  const {notifications}=usePlatformAdmin();
  const { accounts: registeredAccounts, error: accountError } = useLocalAdminAccounts();
  const gymAccounts = registeredAccounts.filter((account) => account.accountType === 'gym');
  const selected=notifications.find(n=>n.requestId===request);
  const requests = useDemoStore((s) => s.requests).filter((r) => !isSeededDashboardRecord(r.id));
  const navigate = useNavigate();
  const reviewing = requests.find((r) => r.id === request);
  const pending = requests.filter((r) => r.status === 'Pending');
  const decided = requests.filter((r) => r.status !== 'Pending');

  if(!getDemoSession())return <CloudGymRequests/>;

  function decide(id: string, gymName: string, approve: boolean) {
    if (!window.confirm(`${approve ? 'Approve' : 'Reject'} ${gymName}?`)) return;
    if (approve) {
      approveRequest(id);
      toast.success(`${gymName} approved — added to Approved Gyms (demo).`);
    } else {
      const note = window.prompt('Rejection notes (optional)', '');
      if (note === null) return;
      rejectRequest(id, note);
      toast.success(`${gymName} rejected (demo).`);
    }
  }

  return (
    <div>
      <PageHeader title="Gym Requests" subtitle={`Pending: ${pending.length} · Approved: ${decided.filter(r=>r.status==='Approved').length} · Rejected: ${decided.filter(r=>r.status==='Rejected').length} · subscription requests only.`} />
      {accountError && <p role="alert" className="mb-4 text-sm text-destructive">{accountError}</p>}
      {!!gymAccounts.length && <section className="mb-8"><h2 className="mb-3 text-lg font-semibold">Registered gym accounts</h2><p className="mb-3 text-sm text-muted-foreground">These accounts have registered but have not submitted a subscription request, so they are not approved gyms.</p><DataTable head={['Owner','Phone','Email','Registered']}>{gymAccounts.map(account=><tr key={account.id}><td className={td}>{account.fullName}</td><td className={td}>{account.phone}</td><td className={td}>{account.email||'—'}</td><td className={td}>{new Date(account.createdAt).toLocaleString()}</td></tr>)}</DataTable></section>}
      {reviewing&&<section className="mb-6 border-y py-4" aria-label="Request review"><h2 className="font-semibold">Review: {reviewing.gymName}</h2><p className="mt-2 text-sm">Owner: {reviewing.ownerName} · Plan: {reviewing.plan}{reviewing.billingType?` · ${reviewing.billingType} · ${reviewing.durationDays} days`:''}{reviewing.price!==undefined?` · ${egp(reviewing.price)}`:''} · Contact: {reviewing.email || '—'}{reviewing.phone ? ` · ${reviewing.phone}` : ''}</p><p className="mt-1 text-sm text-muted-foreground">Submitted {reviewing.submittedAt ? new Date(reviewing.submittedAt).toLocaleString() : reviewing.requestDate} · Status: {reviewing.status}{reviewing.decidedAt ? ` · Decided ${reviewing.decidedAt}` : ''}</p>{reviewing.status==='Pending'&&<div className="mt-3 flex gap-2"><Button size="sm" onClick={() => decide(reviewing.id, reviewing.gymName, true)}>Approve</Button><Button size="sm" variant="destructive" onClick={() => decide(reviewing.id, reviewing.gymName, false)}>Reject</Button></div>}</section>}
      {!reviewing&&selected&&<section className="mb-6 border-y py-4" aria-label="Selected request"><h2 className="font-semibold">Review: {selected.gymName}</h2><p className="mt-2 text-sm">Owner: {selected.ownerName} · Plan: {selected.plan}</p><p className="mt-1 text-sm text-muted-foreground">{new Date(selected.date).toLocaleString()} · {selected.status}</p></section>}
      <DataTable head={['Gym Name', 'Plan', 'Submitted', 'Contact', 'Decision']}>
        {pending.map((r) => (
          <tr key={r.id} className={r.id===request?'bg-secondary':''}>
            <td className={td}>{r.gymName}{r.id.startsWith('prototype-')&&<span className="block text-xs text-muted-foreground">Fictional sample</span>}</td>
            <td className={td}>{r.plan}{r.billingType&&<span className="block text-xs text-muted-foreground">{r.billingType} · {r.durationDays} days · {r.price!==undefined?egp(r.price):'Price not recorded'}</span>}</td>
            <td className={td}>{r.requestDate}</td>
            <td className={td}>{r.phone || 'Not provided'}</td>
            <td className={td}>
              <div className="flex gap-2">
                <StatusPill status={r.status}/>
                <Button size="sm" variant="outline" onClick={() => navigate({ to: '/super-admin/requests', search: { request: request === r.id ? undefined : r.id } })}>{request === r.id ? 'Close review' : 'Review'}</Button>
                <Button size="sm" onClick={() => decide(r.id, r.gymName, true)}>Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => decide(r.id, r.gymName, false)}>Reject</Button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
      {!pending.length && <p className="py-6 text-muted-foreground">No pending requests.</p>}
      {decided.length > 0 && (
        <>
          <h3 className="mb-3 mt-10 text-sm font-semibold">Decided</h3>
          <DataTable head={['Gym Name', 'Plan', 'Request Date', 'Decision Date', 'Status', 'Actions']}>
            {decided.map((r) => (
              <tr key={r.id}>
                <td className={td}>{r.gymName}</td>
                <td className={td}>{r.plan}{r.billingType&&<span className="block text-xs text-muted-foreground">{r.billingType} · {r.durationDays} days · {r.price!==undefined?egp(r.price):'Price not recorded'}</span>}</td>
                <td className={td}>{r.requestDate}</td>
                <td className={td}>{r.decidedAt ?? '—'}</td>
                <td className={td}><StatusPill status={r.status}/></td>
                <td className={td}><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => navigate({ to: '/super-admin/requests', search: { request: request === r.id ? undefined : r.id } })}>{request === r.id ? 'Close review' : 'Review'}</Button>{r.status==='Rejected'&&<Button size="sm" variant="outline" onClick={()=>decide(r.id,r.gymName,true)}>Approve</Button>}</div></td>
              </tr>
            ))}
          </DataTable>
        </>
      )}
    </div>
  );
}
