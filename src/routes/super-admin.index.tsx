import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { PageHeader, StatCard, Panel } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Building2, CreditCard, Users, Wallet, TrendingUp, UserPlus } from 'lucide-react';
import { useDemoStore, getDemoSession, isSeededDashboardRecord, PERIODS, periodRange, inRange, platformTotals, type Period } from '@/lib/demo';
import { CloudGymRequests } from '@/components/CloudGymRequests';
import { egp } from '@/lib/mock';
import { seo } from '@/lib/seo';
import { projectedSubscriptions } from '@/lib/platform-subscriptions';
import { useLocalAdminAccounts } from '@/hooks/use-local-admin-accounts';

export const Route = createFileRoute('/super-admin/')({
  head: () => seo('Platform dashboard', 'Review platform gyms, subscriptions, clients and projected revenue.'),
  component: PlatformDashboard,
});

function PlatformDashboard() {
  return getDemoSession()?<DemoPlatformDashboard/>:<CloudGymRequests/>;
}
function DemoPlatformDashboard() {
  const gyms = useDemoStore((s) => s.gyms).filter(g=>!g.deletedAt&&!isSeededDashboardRecord(g.id));
  const clients = useDemoStore((s) => s.clients).filter(c=>!isSeededDashboardRecord(c.id));
  const expenses = useDemoStore((s) => s.expenses);
  const { accounts: registeredAccounts, error: accountError } = useLocalAdminAccounts();
  const registeredClients = registeredAccounts.filter((account) => account.accountType === 'individual');
  const registeredGyms = registeredAccounts.filter((account) => account.accountType === 'gym');
  const registeredClientPhones = new Set(clients.map((client) => client.phone.replace(/\D/g, '')).filter(Boolean));
  const newRegisteredClientCount = registeredClients.filter((account) => {
    const phone = account.phone.replace(/\D/g, '');
    if (!phone) return true;
    if (registeredClientPhones.has(phone)) return false;
    registeredClientPhones.add(phone);
    return true;
  }).length;
  const [period, setPeriod] = useState<Period>('year');
  const [custom, setCustom] = useState({ from: '2026-01-01', to: '2026-12-31' });

  const { from, to } = periodRange(period, custom);
  const revenue = useMemo(() => projectedSubscriptions(gyms, from, to), [gyms, from.getTime(), to.getTime()]);
  const filteredRevenue = useMemo(() => revenue.filter((r) => inRange(r.date, from, to)), [revenue, from.getTime(), to.getTime()]);
  const totalRevenue = filteredRevenue.reduce((sum, r) => sum + r.amount, 0);
  const totals = platformTotals(revenue, expenses, from, to);
  const newGyms = gyms.filter((g) => inRange(g.start, from, to)).length;
  const activeSubs = gyms.filter((g) => g.status === 'Active').length;

  // Monthly revenue bars across the selected range.
  const bars = useMemo(() => {
    const months: { label: string; amount: number }[] = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= end && months.length < 24) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const amount = filteredRevenue
        .filter((r) => {
          const d = new Date(r.date + 'T12:00:00');
          return d.getFullYear() === y && d.getMonth() === m;
        })
        .reduce((s, r) => s + r.amount, 0);
      months.push({ label: cursor.toLocaleString('en-US', { month: 'short', year: '2-digit' }), amount });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
  }, [filteredRevenue, from.getTime(), to.getTime()]);
  const maxBar = Math.max(1, ...bars.map((b) => b.amount));

  return (
    <div>
      <PageHeader title="Platform Dashboard" subtitle="Platform accounts and activity recorded in this workspace." />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <Button key={p.id} size="sm" variant={period === p.id ? 'default' : 'outline'} onClick={() => setPeriod(p.id)}>{p.label}</Button>
        ))}
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="h-9 w-auto" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="h-9 w-auto" />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Approved gyms" value={String(gyms.length)} icon={Building2} delta={`+${newGyms} in period`} tone="good" />
        <StatCard label="Active subscriptions" value={String(activeSubs)} icon={CreditCard} delta={`${gyms.length - activeSubs} frozen`} />
        <StatCard label="Total clients" value={String(clients.length + newRegisteredClientCount)} icon={Users} delta="Across all registered accounts" />
        <StatCard label="Gym account registrations" value={String(registeredGyms.length)} icon={Building2} delta="Not yet counted as approved gyms" />
        <StatCard label="Projected subscription revenue" value={egp(totalRevenue)} icon={Wallet} delta="Active gyms · scheduled billing · not collected" />
        <StatCard label="Expenses" value={egp(totals.expenses)} icon={Wallet} delta="Platform only · selected period" />
        <StatCard label="Net" value={`${totals.net < 0 ? '−' : ''}${egp(totals.net)}`} icon={Wallet} delta="Projected revenue minus platform expenses" />
      </div>
      {accountError && <p role="alert" className="mt-4 text-sm text-destructive">{accountError}</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Projected subscription revenue" className="lg:col-span-2">
          {!filteredRevenue.length && <p className="py-6 text-sm text-muted-foreground">No priced active gym subscriptions have a billing date in this period.</p>}
          <div className="flex h-44 items-end gap-2">
            {bars.map((b) => (
              <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className={cn('w-full rounded-t bg-primary/80')} style={{ height: `${Math.max(2, (b.amount / maxBar) * 150)}px` }} title={`${b.label}: ${egp(b.amount)}`} />
                <span className="w-full truncate text-center text-[10px] text-muted-foreground">{b.label}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Growth">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary"><TrendingUp className="h-4 w-4" /></span>
              <div><div className="font-display text-xl font-semibold">{newGyms}</div><div className="text-xs text-muted-foreground">New gyms in period</div></div>
            </div>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary"><UserPlus className="h-4 w-4" /></span>
              <div><div className="font-display text-xl font-semibold">{clients.length}</div><div className="text-xs text-muted-foreground">Clients on platform</div></div>
            </div>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary"><Wallet className="h-4 w-4" /></span>
              <div><div className="font-display text-xl font-semibold">{filteredRevenue.length}</div><div className="text-xs text-muted-foreground">Projected billings in period</div></div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
