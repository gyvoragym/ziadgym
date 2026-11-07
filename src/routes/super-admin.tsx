import { createFileRoute, Link, Navigate, Outlet, useRouterState } from '@tanstack/react-router';
import { useCloud } from '@/components/CloudProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Inbox, Building2, Users, LogOut, Receipt, CreditCard, ArchiveRestore, QrCode, UserPlus } from 'lucide-react';
import { seo } from '@/lib/seo';
import { useState } from 'react';
import { Bell, UserRound } from 'lucide-react';
import { PlatformAccount } from '@/components/PlatformAccount';
import { PlatformAdminProvider, usePlatformAdmin } from '@/components/PlatformAdminProvider';
import { Settings } from 'lucide-react';
import { PlatformSettings } from '@/components/PlatformSettings';
import { getDemoSession } from '@/lib/demo';
import { AppBrand } from '@/components/AppBrand';
import { readPreviewSession } from '@/lib/preview-session';

export const Route = createFileRoute('/super-admin')({
  head: () => seo('Platform administration', 'IronHaus platform super admin: gym requests, approved gyms, clients and platform metrics.'),
  component: SuperAdminLayout,
});

const nav = [
  { to: '/super-admin', label: 'Platform Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/super-admin/requests', label: 'Gym Requests', icon: Inbox },
  { to: '/super-admin/gyms', label: 'Approved Gyms', icon: Building2 },
  { to: '/super-admin/deleted-gyms', label: 'Deleted Gyms', icon: ArchiveRestore },
  { to: '/super-admin/plans', label: 'Subscription Plans', icon: CreditCard },
  { to: '/super-admin/signups', label: 'New Signups', icon: UserPlus },
  { to: '/super-admin/clients', label: 'Clients', icon: Users },
  { to: '/super-admin/prototype-signups', label: 'Prototype Signups', icon: QrCode },
  { to: '/super-admin/expenses', label: 'Expenses & Bills', icon: Receipt },
] as const;

function SuperAdminLayout() {
  return <PlatformAdminProvider><SuperAdminContent /></PlatformAdminProvider>;
}
function SuperAdminContent() {
  const c = useCloud();
  const [accountOpen,setAccountOpen] = useState(false);
  const [settingsOpen,setSettingsOpen] = useState(false);
  const {notifications}=usePlatformAdmin();
  const unread=notifications.filter(n=>!n.read).length;
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (c.loading) return <div className="p-12 text-muted-foreground">Loading administrator account…</div>;
  if (c.role !== 'super_admin') return <Navigate to="/" />;
  return (
    <div className={cn('mx-auto w-full py-10', path === '/super-admin/gyms' ? 'max-w-[2400px] px-4' : 'max-w-6xl px-6')}>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AppBrand />
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{readPreviewSession() ? 'Administrator design · prototype' : getDemoSession()?'Super Admin · local demo':'Super Admin · saved accounts'}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={()=>setSettingsOpen(true)} aria-label="Platform Settings" title="Platform Settings"><Settings className="h-4 w-4"/></Button>
          <Button variant="outline" size="sm" onClick={()=>setAccountOpen(true)}><UserRound className="h-4 w-4"/>Account</Button>
          <Button variant="outline" size="sm" asChild><Link to="/super-admin/notifications"><Bell className="h-4 w-4"/>Notifications{unread>0&&<span aria-label={`${unread} unread notifications`} className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{unread}</span>}</Link></Button>
          <Button variant="outline" size="sm" onClick={() => void c.logout()}><LogOut className="h-4 w-4" /> Sign out</Button>
        </div>
      </div>
      <nav className="mb-8 flex flex-wrap gap-2">
        {nav
          .filter((n) => n.to !== '/super-admin/prototype-signups' || !!readPreviewSession()?.adminToken)
          .filter((n) => n.to !== '/super-admin/signups' || ((!readPreviewSession() && !getDemoSession()) || !!readPreviewSession()?.adminToken))
          .map((n) => {
          const active = 'exact' in n && n.exact ? path === n.to : path.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to}
              className={cn('flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors',
                active ? 'border-primary/40 bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <n.icon className={cn('h-4 w-4', active && 'text-primary')} />{n.label}
            </Link>
          );
        })}
      </nav>
      <div key={path} className="page-enter"><Outlet /></div>
      <PlatformAccount open={accountOpen} onOpenChange={setAccountOpen}/>
      <PlatformSettings open={settingsOpen} onOpenChange={setSettingsOpen}/>
    </div>
  );
}
