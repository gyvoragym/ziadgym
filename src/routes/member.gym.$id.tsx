import { LocationSummary } from '@/components/GymLocation';
import { toPhoto, type GalleryItem } from '@/lib/store';
import { GalleryImage } from '@/components/GymGallery';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Check, MapPin, Clock, Phone, Save, CheckCheck, MessageCircle, Instagram, Facebook } from 'lucide-react';
import { toast } from 'sonner';
import { useCloud } from '@/components/CloudProvider';
import { ClientShell } from '@/components/ClientShell';
import { ClientGymWorkspace, clientGymPages, type ClientGymPage } from '@/components/ClientGymWorkspace';
import { Button } from '@/components/ui/button';
import { PageHeader, Panel, DataTable, td, StatusPill } from '@/components/kit';
import { ExerciseImage } from '@/components/ProgramEditor';
import { TrainerAvatar } from '@/components/TrainerAvatar';
import { clientGymContent, useClientGyms, type ClientGymContent } from '@/lib/client-portal';
import { personalGymCopy, workoutSourceId, hasGymSource } from '@/lib/workout-sources';
import { getDemoSession, getDemoState, saveDemoProgram } from '@/lib/demo';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { readPreviewSession } from '@/lib/preview-session';
import { readPreviewClientPrograms, savePreviewClientProgram } from '@/lib/preview-client-programs';
import { fmt12, type Workout } from '@/lib/store';
import { initials } from '@/lib/mock';
import { gymContactUrl } from '@/lib/gym-contact';
import { seo } from '@/lib/seo';
import cover from '@/assets/gym-cover.jpg';

export const Route = createFileRoute('/member/gym/$id')({
  validateSearch: (search: Record<string, unknown>): {page?: ClientGymPage} => clientGymPages.includes(search['page'] as ClientGymPage) ? {page: search['page'] as ClientGymPage} : {},
  head: () => seo('Gym pages — member view', 'Browse gym memberships, profile, products and workouts, and save independent personal workout plans.'),
  component: GymProfile,
});
function GymProfile() {
  const c = useCloud(); const { id } = Route.useParams(); const p = useClientGyms();
  const gym = p.directory.find(g => g.id === id);
  const {page: requestedPage} = Route.useSearch();
  const [page, setPage] = useState<ClientGymPage>(requestedPage ?? 'Profile');
  useEffect(() => {setPage(requestedPage ?? 'Profile');},[id,requestedPage]);
  const [content, setContent] = useState<ClientGymContent | null>(null);
  const [error, setError] = useState(''); const [saved, setSaved] = useState<string[]>([]); const [busy, setBusy] = useState('');
  useEffect(() => {
    let active = true; setContent(null); setError(''); setSaved([]);
    if (!c.profile) return;
    void clientGymContent(id).then(value => { if (active) setContent(value); }).catch(() => { if (active) setError('This gym is unavailable. Please return to Join a Gym.'); });
    void (async () => {
      if (!c.profile) return;
      if (readPreviewSession()) {
        try {
          setSaved(
            readPreviewClientPrograms(c.profile.id).flatMap((row) => {
              if (row.source_gym_id === id && row.source_workout_id)
                return [row.source_workout_id];
              const definition = row.definition as unknown as Record<string, unknown>;
              const sourceWorkoutId = definition['sourceWorkoutId'];
              return typeof sourceWorkoutId === 'string' &&
                hasGymSource(definition, id, sourceWorkoutId)
                ? [sourceWorkoutId]
                : [];
            }),
          );
        } catch (savedError) {
          if (active)
            setError(
              savedError instanceof Error
                ? savedError.message
                : 'Could not check saved workouts. Please refresh before saving.',
            );
        }
      } else if (getDemoSession()) {
        if (active) setSaved(getDemoState().programs.filter(r => r.user_id === c.profile?.id).flatMap(r => {
          const d = r.definition as unknown as Record<string, unknown>;
          return d['sourceGymId'] === id && typeof d['sourceWorkoutId'] === 'string' ? [d['sourceWorkoutId']] : [];
        }));
      } else {
        const result = await supabase.from('client_programs').select('source_workout_id,definition').eq('user_id', c.profile.id).eq('source_gym_id', id);
        if (result.error) { if (active) setError('Could not check saved workouts. Please refresh before saving.'); return; }
        if (active) setSaved((result.data ?? []).flatMap(r => r.source_workout_id ? [r.source_workout_id] : []));
      }
    })();
    return () => { active = false; };
  }, [id, c.profile?.id]);
  async function save(workout: Workout) {
    if (!c.profile || busy) return;
    const source = workoutSourceId(workout); if (saved.includes(source)) return;
    setBusy(source);
    try {
      const copy = personalGymCopy(workout, id);
      if (readPreviewSession()) {
        savePreviewClientProgram(c.profile.id, copy, undefined, { gymId: id, workoutId: source });
      } else if (getDemoSession()) {
        const exists = getDemoState().programs.some(r => r.user_id === c.profile?.id && hasGymSource(r.definition, id, source));
        if (!exists) saveDemoProgram(c.profile.id, copy);
      } else {
        const { error: failure } = await supabase.from('client_programs').insert({ user_id: c.profile.id, definition: copy as unknown as Json, source_gym_id: id, source_workout_id: source });
        if (failure && failure.code !== '23505') throw failure;
      }
      setSaved(values => [...values, source]); toast.success('Saved to your personal workouts');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save workout. Please try again.');
    } finally { setBusy(''); }
  }
  if (!gym || !content) return <ClientShell title={gym?.name ?? 'Gym'}><p role={error ? 'alert' : 'status'}>{error || p.error || 'Loading gym…'}</p><Button asChild variant="outline" className="mt-4"><Link to="/member/join">Join a Gym</Link></Button></ClientShell>;
  const profile = content.profile; const currency = profile.currency || profile.preferences?.currency || 'EGP';
  return <ClientGymWorkspace gym={gym} logo={profile.logo} page={page} onPage={setPage}>
    {error && <p role="alert" className="mb-4 text-destructive">{error}</p>}
    {page === 'Memberships' && <>
      <PageHeader title="Membership plans" />
      <div className="grid gap-5 md:grid-cols-3">{content.plans.map(plan => <article key={plan.id} className={`panel flex flex-col p-6 ${plan.featured ? 'border-primary/50' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="eyebrow">{plan.duration}</span>{plan.featured && <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">Most popular</span>}</div>
        <h2 className="mt-3 break-words text-2xl font-semibold">{plan.name}</h2><div className="mt-4 font-display text-3xl text-primary">{currency} {plan.price.toLocaleString()}</div>
        <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">{(plan.features ?? []).map(feature => <li key={feature} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" />{feature}</li>)}</ul>
      </article>)}</div>
      {!content.plans.length && <p className="text-muted-foreground">No membership plans available.</p>}
      {p.memberships.filter(m => m.gymId === id).map(m => <div key={m.id} className="mt-6 flex flex-wrap items-center gap-3 border-t pt-4"><h2 className="font-semibold">{m.plan}</h2><StatusPill status={m.status} /><p className="text-sm text-muted-foreground">{m.start} — {m.expiry}</p></div>)}
    </>}
    {page === 'Profile' && <div className="space-y-6">
      <div className="panel relative overflow-hidden">{profile.cover || gym.image ? <ExerciseImage path={profile.cover || gym.image} className="h-64 w-full object-cover sm:h-80" /> : <img src={cover} alt={`${gym.name} interior`} className="h-64 w-full object-cover sm:h-80" />}<div className="hero-overlay absolute inset-0" /><div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-6 sm:p-8">
        {profile.logo ? <ExerciseImage path={profile.logo} className="h-20 w-20 shrink-0 rounded-lg border-4 border-card object-cover" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border-4 border-card bg-primary font-display text-xl font-bold text-primary-foreground">{initials(gym.name)}</span>}
        <div className="min-w-0"><h1 className="break-words text-2xl font-semibold sm:text-3xl">{gym.name}</h1>{profile.tagline && <p className="mt-1 text-sm text-muted-foreground">{profile.tagline}</p>}<p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />{profile.location || gym.location || 'Location not provided'}</p></div>
      </div></div>
      <div className="grid gap-6 lg:grid-cols-3"><Panel title="About the gym" className="min-w-0 lg:col-span-2"><p className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-muted-foreground">{profile.description || gym.description || 'No description provided.'}</p><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{(profile.facilities ?? []).map(f => <div key={f} className="flex gap-2 rounded-lg bg-secondary px-3 py-2 text-xs"><Check className="h-3.5 w-3.5 shrink-0 text-primary" />{f}</div>)}</div></Panel>
      <div className="space-y-6"><Panel title="Services"><div className="flex flex-wrap gap-2">{(profile.services ?? []).map(s => <span key={s} className="rounded-full border px-3 py-1.5 text-xs">{s}</span>)}</div>{!profile.services?.length && <p className="text-sm text-muted-foreground">No services listed.</p>}</Panel><Panel title="Working hours"><ul className="space-y-2 text-sm">{(profile.hoursByDay ?? []).map(d => <li key={d.day} className="flex justify-between gap-2"><span>{d.day}</span><span className="text-muted-foreground">{d.closed ? 'Closed' : `${fmt12(d.open)} – ${fmt12(d.close)}`}</span></li>)}</ul>{!profile.hoursByDay?.length && <p className="flex gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" />Hours not provided.</p>}</Panel></div></div>
      <Panel title="Trainers"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{content.trainers.map((t, i) => <article key={i} className="min-w-0 rounded-lg bg-surface p-5"><TrainerAvatar t={t} size="h-14 w-14" /><h2 className="mt-4 break-words font-semibold">{t.name || 'Trainer'}</h2><p className="text-xs text-primary">{t.specialty}</p>{t.notes && <p className="mt-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">{t.notes}</p>}</article>)}</div>{!content.trainers.length && <p className="text-sm text-muted-foreground">No trainers listed.</p>}</Panel>
      <div className="grid gap-6 lg:grid-cols-3"><Panel title="Photos" className="lg:col-span-2">{profile.gallery?.length ? <div className="grid grid-cols-2 gap-3">{profile.gallery.map((g: GalleryItem, i: number) => { const p = toPhoto(g, i); return <figure key={p.id} className="space-y-1"><GalleryImage path={p.path} />{p.caption && <figcaption className="break-words text-xs text-muted-foreground">{p.caption}</figcaption>}</figure>; })}</div> : <p className="text-sm text-muted-foreground">This gym hasn't added any photos yet.</p>}</Panel><Panel title="Location"><LocationSummary address={profile.location || gym.location} coords={profile.coords} directions /></Panel><Panel title="Contact"><div className="space-y-2 text-sm">{profile.phone && <a className="flex items-center gap-2 break-all text-muted-foreground hover:text-primary" href={`tel:${profile.phone}`}><Phone className="h-4 w-4 shrink-0 text-primary" />{profile.phone}</a>}{profile.whatsapp && <a className="flex items-center gap-2 break-all text-muted-foreground hover:text-primary" href={gymContactUrl('whatsapp', profile.whatsapp) || undefined} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 shrink-0 text-primary" />WhatsApp</a>}{profile.instagram && <a className="flex items-center gap-2 break-all text-muted-foreground hover:text-primary" href={gymContactUrl('social', profile.instagram) || undefined} target="_blank" rel="noreferrer"><Instagram className="h-4 w-4 shrink-0 text-primary" />Instagram</a>}{profile.facebook && <a className="flex items-center gap-2 break-all text-muted-foreground hover:text-primary" href={gymContactUrl('social', profile.facebook) || undefined} target="_blank" rel="noreferrer"><Facebook className="h-4 w-4 shrink-0 text-primary" />Facebook</a>}{!profile.phone && !profile.whatsapp && !profile.instagram && !profile.facebook && <p className="text-muted-foreground">Contact not provided.</p>}</div></Panel></div>
    </div>}
    {page === 'Products' && <><PageHeader title="Products & Inventory" /><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{content.products.map((product, i) => <article key={product.id ?? i} className="panel overflow-hidden"><ExerciseImage path={product.image} alt={`${product.name} image`} className="aspect-[4/3] w-full object-cover" /><div className="p-5"><span className="eyebrow">{product.category}</span><h2 className="mt-2 break-words text-lg font-semibold">{product.name}</h2><p className="mt-3 font-display text-xl text-primary">{currency} {product.price.toLocaleString()}</p></div></article>)}</div>{!content.products.length && <p className="text-muted-foreground">No products available.</p>}</>}
    {page === 'Workouts' && <><PageHeader title="Workout programs" /><div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">{content.workouts.map(w => { const key = workoutSourceId(w); return <Panel className="min-w-0" key={key} title={w.name} action={<Button size="sm" variant="secondary" disabled={!!busy || saved.includes(key)} onClick={() => void save(w)}>{saved.includes(key) ? <CheckCheck className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saved.includes(key) ? 'Saved' : busy === key ? 'Saving…' : 'Save'}</Button>}>
      {w.trainer && <p className="mb-4 text-sm text-muted-foreground">Trainer · {w.trainer}</p>}<DataTable head={['Exercise', 'Sets', 'Reps', 'Image']}>{w.exercises.map((e, i) => <tr key={i}><td className={td}>{e.name}</td><td className={td}>{e.sets}</td><td className={td}>{e.reps}</td><td className={td}><ExerciseImage path={e.image} /></td></tr>)}</DataTable>{w.notes && <div className="mt-4 whitespace-pre-wrap break-words rounded-lg bg-surface p-3 text-sm text-muted-foreground"><span className="eyebrow mr-2">Trainer notes</span>{w.notes}</div>}
    </Panel>; })}</div>{!content.workouts.length && <p className="text-muted-foreground">No programs available.</p>}</>}
  </ClientGymWorkspace>;
}
