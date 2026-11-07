import { Link } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { Building2, CreditCard, Package, ClipboardList, Menu, X, ArrowLeft } from 'lucide-react';
import { ExerciseImage } from './ProgramEditor';
import { AppBrand } from './AppBrand';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/mock';
import type { ClientGym } from '@/lib/client-portal';

export const clientGymPages = ['Profile', 'Memberships', 'Workouts', 'Products'] as const;
export type ClientGymPage = typeof clientGymPages[number];
const icons = [Building2, CreditCard, ClipboardList, Package];
export function ClientGymWorkspace({ gym, logo, page, onPage, children }: {
  gym: ClientGym; logo?: string | undefined; page: ClientGymPage; onPage: (page: ClientGymPage) => void; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const sidebar = <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
    <AppBrand className="border-b border-sidebar-border px-5 py-3" />
    <div className="flex items-center gap-3 px-5 py-6">
      {logo ? <ExerciseImage path={logo} alt={`${gym.name} logo`} className="h-9 w-9 shrink-0 rounded-lg object-cover" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">{initials(gym.name)}</span>}
      <div className="min-w-0 break-words font-display text-sm font-semibold">{gym.name}</div>
    </div>
    <nav aria-label="Gym pages" className="flex-1 space-y-0.5 px-3 pb-4">
      {clientGymPages.map((name, i) => { const Icon = icons[i]; return <Button key={name} variant="ghost" aria-current={page === name ? 'page' : undefined} onClick={() => { onPage(name); setOpen(false); }} className={cn('w-full justify-start gap-3 text-sm', page === name && 'bg-sidebar-accent text-sidebar-accent-foreground')}>
        {Icon && <Icon className={cn('h-4 w-4', page === name && 'text-primary')} />}{name}
      </Button>; })}
    </nav>
    <div className="border-t border-sidebar-border p-3"><Button asChild variant="ghost" className="w-full justify-start"><Link to="/member"><ArrowLeft className="h-4 w-4" />My account</Link></Button></div>
  </aside>;
  return <div className="flex min-h-screen">
    <div className="sticky top-0 hidden h-screen lg:block">{sidebar}</div>
    {open && <div className="fixed inset-0 z-50 flex lg:hidden">{sidebar}<Button aria-label="Close menu" variant="ghost" className="h-full flex-1 rounded-none bg-background/70" onClick={() => setOpen(false)}><X /></Button></div>}
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur sm:px-8">
        <Button size="icon" variant="ghost" aria-label="Open menu" className="lg:hidden" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></Button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{gym.name}</span>
        <Button asChild size="sm" variant="outline"><Link to="/member"><ArrowLeft className="h-4 w-4" />My account</Link></Button>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  </div>;
}