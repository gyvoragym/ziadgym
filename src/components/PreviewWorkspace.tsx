import { useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { LogOut, Plus, Trash2 } from 'lucide-react';
import { AppBrand } from './AppBrand';
import { Button } from './ui/button';
import { Input } from './ui/input';
import type { PreviewSession } from '@/lib/preview-session';

export function PreviewWorkspace({ session, logout }: { session: PreviewSession; logout: () => Promise<void> }) {
  const path = useRouterState({ select: s => s.location.pathname });
  const [draft, setDraft] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const denied = path.startsWith('/super-admin') || (session.type === 'individual' && !path.startsWith('/member'));
  return <div className="min-h-screen bg-background">
    <header className="flex items-center justify-between gap-4 border-b px-6 py-4"><AppBrand/><Button variant="outline" onClick={() => void logout()}><LogOut className="h-4 w-4"/>Log out</Button></header>
    <main className="mx-auto max-w-4xl px-6 py-8">
      <p role="status" className="mb-6 border-b pb-4 text-sm text-muted-foreground">Preview session · Not a real account. No real gym, client or administrator data is available.</p>
      {denied ? <h1 className="text-2xl font-semibold">Administrator or account access required</h1> : <>
        <h1 className="text-3xl font-semibold">{session.type === 'gym' ? 'Gym dashboard' : 'My account'}</h1>
        <p className="mt-2 text-muted-foreground">Welcome, {session.name}</p>
        <section className="mt-8 border-t pt-6"><h2 className="text-xl font-semibold">{session.type === 'gym' ? 'Preview gym notes' : 'Personal training notes'}</h2>
          <form className="mt-4 flex gap-2" onSubmit={e => {e.preventDefault();if(draft.trim()){setItems([...items,draft.trim()]);setDraft('');}}}><Input aria-label="New note" value={draft} onChange={e => setDraft(e.target.value)} maxLength={200}/><Button type="submit" aria-label="Add note"><Plus className="h-4 w-4"/></Button></form>
          {!items.length && <p className="mt-4 text-sm text-muted-foreground">No notes yet.</p>}
          <ul className="mt-4 divide-y">{items.map((item,i) => <li key={i} className="flex items-center justify-between gap-4 py-3"><span className="min-w-0 break-words">{item}</span><Button variant="ghost" size="icon" aria-label="Delete note" onClick={() => setItems(items.filter((_,n)=>n!==i))}><Trash2 className="h-4 w-4"/></Button></li>)}</ul>
        </section>
      </>}
    </main>
  </div>;
}