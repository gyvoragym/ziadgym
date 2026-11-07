import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { PageHeader, StatCard, Panel } from '@/components/kit';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Building2, CreditCard, Users, Wallet, TrendingUp, UserPlus, ClipboardList } from 'lucide-react';
import { useDemoStore, getDemoSession, isSeededDashboardRecord, PERIODS, periodRange, inRange, platformTotals, type Period, type ApprovedGym } from '@/lib/demo';
import { egp } from '@/lib/mock';
import { seo } from '@/lib/seo';
import { projectedSubscriptions, planEndDate } from '@/lib/platform-subscriptions';
import { useLocalAdminAccounts } from '@/hooks/use-local-admin-accounts';
import { getPlatformOverview, listAdminGyms } from '@/lib/platform-admin.functions';
import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';
import { useCloud } from '@/components/CloudProvider';

export const Route = createFileRoute('/super-admin/')({
  head: () => seo('Platform dashboard', 'Review platform gyms, subscriptions, clients and projected revenue.'),
  component: PlatformDashboard,
});

function PlatformDashboard() {
  return getDemoSession()?<DemoPlatformDashboard/>:<CloudPlatformDashboard/>;
}
function CloudPlatformDashboard() {
  const cloud=useCloud();
  const fetchOverview=useServerFn(getPlatformOverview);
  const fetchGyms=useServerFn(listAdminGyms);
  const expenses=useDemoStore((s)=>s.expenses);
  const [summary,setSummary]=useState<Awaited<ReturnType<typeof getPlatformOverview>>|null>(null);
  const [cloudGyms,setCloudGyms]=useState<Awaited<ReturnType<typeof listAdminGyms>>>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [period,setPeriod]=useState<Period>('year');
  const [custom,setCustom]=useState({from:`${new Date().getFullYear()}-01-01`,to:`${new Date().getFullYear()}-12-31`});
  const load=()=>{
    setLoading(true);setError('');
    return Promise.all([fetchOverview(),fetchGyms()])
      .then(([overview,gymRows])=>{setSummary(overview);setCloudGyms(gymRows);})
      .catch(reason=>setError(reason instanceof Error?reason.message:'Could not load platform statistics.'))
      .finally(()=>setLoading(false));
  };
  useEffect(()=>{void load();},[cloud.profile?.id]);

  // Approved, not deleted gyms in the shape the revenue projection expects.
  const gyms=useMemo<ApprovedGym[]>(()=>cloudGyms.filter(g=>!g.deleted&&g.subscriptionStart).map(g=>{
    const billingType=g.billingType==='Annual'||g.billingType==='Monthly'?g.billingType:undefined;
    const durationDays=g.durationDays??(billingType==='Annual'||g.plan==='Annual Plan'?365:30);
    let end=g.subscriptionEnd;
    if(!end)try{end=planEndDate(g.subscriptionStart,durationDays);}catch{end=g.subscriptionStart;}
    return {
      id:g.id,name:g.name,phone:g.ownerPhone,email:g.ownerEmail,plan:g.plan,start:g.subscriptionStart,end,
      status:g.frozen?'Frozen':'Active',billingType,durationDays,
      ...(g.monthlyPrice===null?{}:{monthlyPrice:g.monthlyPrice}),
      ...(g.annualPrice===null?{}:{annualPrice:g.annualPrice,annualPriceManual:g.annualPriceManual}),
      ...(g.planId?{planId:g.planId}:{}),
    };
  }),[cloudGyms]);

  const {from,to}=periodRange(period,custom);
  const revenue=useMemo(()=>projectedSubscriptions(gyms,from,to),[gyms,from.getTime(),to.getTime()]);
  const filteredRevenue=useMemo(()=>revenue.filter(r=>inRange(r.date,from,to)),[revenue,from.getTime(),to.getTime()]);
  const totalRevenue=filteredRevenue.reduce((sum,r)=>sum+r.amount,0);
  const totals=platformTotals(revenue,expenses,from,to);
  const newGyms=gyms.filter(g=>inRange(g.start,from,to)).length;
  const activeSubs=gyms.filter(g=>g.status==='Active').length;
  const bars=useMemo(()=>{
    const months:{label:string;amount:number}[]=[];
    const cursor=new Date(from.getFullYear(),from.getMonth(),1);
    const last=new Date(to.getFullYear(),to.getMonth(),1);
    while(cursor<=last&&months.length<24){
      const y=cursor.getFullYear(),m=cursor.getMonth();
      const amount=filteredRevenue.filter(r=>{const d=new Date(r.date+'T12:00:00');return d.getFullYear()===y&&d.getMonth()===m;}).reduce((s,r)=>s+r.amount,0);
      months.push({label:cursor.toLocaleString('en-US',{month:'short',year:'2-digit'}),amount});
      cursor.setMonth(cursor.getMonth()+1);
    }
    return months;
  },[filteredRevenue,from.getTime(),to.getTime()]);
  const maxBar=Math.max(1,...bars.map(b=>b.amount));
  const show=(value:string)=>loading?'…':error?'—':value;

  return <div>
    <PageHeader title="Platform Dashboard" subtitle="Live platform totals · projected revenue is based on approved plan prices, not collected payments." actions={<Button asChild variant="outline"><Link to="/super-admin/requests" search={{request:undefined}}><ClipboardList className="h-4 w-4"/>Review requests{summary?.pendingRequests?` (${summary.pendingRequests})`:''}</Link></Button>}/>
    {error&&<p role="alert" className="mb-4 text-sm text-destructive">{error}<Button variant="outline" className="ml-3" onClick={()=>void load()}>Retry</Button></p>}
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {PERIODS.map(p=><Button key={p.id} size="sm" variant={period===p.id?'default':'outline'} onClick={()=>setPeriod(p.id)}>{p.label}</Button>)}
      {period==='custom'&&<div className="flex items-center gap-2">
        <Input type="date" value={custom.from} onChange={e=>setCustom(c=>({...c,from:e.target.value}))} className="h-9 w-auto"/>
        <span className="text-sm text-muted-foreground">to</span>
        <Input type="date" value={custom.to} onChange={e=>setCustom(c=>({...c,to:e.target.value}))} className="h-9 w-auto"/>
      </div>}
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard label="Approved gyms" value={show(String(gyms.length))} icon={Building2} delta={`+${newGyms} in period`} tone="good"/>
      <StatCard label="Active subscriptions" value={show(String(activeSubs))} icon={CreditCard} delta={`${gyms.length-activeSubs} frozen`}/>
      <StatCard label="Total clients" value={show(String(summary?.clients??0))} icon={Users} delta="Across all gyms"/>
      <StatCard label="Projected subscription revenue" value={show(egp(totalRevenue))} icon={Wallet} delta="Active gyms · scheduled billing · not collected"/>
      <StatCard label="Expenses" value={egp(totals.expenses)} icon={Wallet} delta="Platform only · selected period"/>
      <StatCard label="Net" value={show(`${totals.net<0?'−':''}${egp(totals.net)}`)} icon={Wallet} delta="Projected revenue minus expenses"/>
    </div>
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      <Panel title="Projected subscription revenue" className="lg:col-span-2">
        {!loading&&!filteredRevenue.length&&<p className="py-6 text-sm text-muted-foreground">No priced active gym subscriptions have a billing date in this period.</p>}
        <div className="flex h-44 items-end gap-2">
          {bars.map(b=><div key={b.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className={cn('w-full rounded-t bg-primary/80')} style={{height:`${Math.max(2,(b.amount/maxBar)*150)}px`}} title={`${b.label}: ${egp(b.amount)}`}/>
            <span className="w-full truncate text-center text-[10px] text-muted-foreground">{b.label}</span>
          </div>)}
        </div>
      </Panel>
      <Panel title="Growth">
        <div className="space-y-4">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary"><TrendingUp className="h-4 w-4"/></span><div><div className="font-display text-xl font-semibold">{newGyms}</div><div className="text-xs text-muted-foreground">New gyms in period</div></div></div>
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary"><UserPlus className="h-4 w-4"/></span><div><div className="font-display text-xl font-semibold">{summary?.clients??0}</div><div className="text-xs text-muted-foreground">Clients on platform</div></div></div>
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary"><Wallet className="h-4 w-4"/></span><div><div className="font-display text-xl font-semibold">{filteredRevenue.length}</div><div className="text-xs text-muted-foreground">Projected billings in period</div></div></div>
        </div>
      </Panel>
    </div>
  </div>;
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
