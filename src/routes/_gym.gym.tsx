import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EditGymDialog, ShareGymDialog } from "@/components/GymModals";
import { currencyOf, useStore, fmt12 } from "@/lib/store";
import { Clock, MapPin, Pencil, Share2, Phone, MessageCircle, Instagram, Facebook, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/kit";
import { TrainerAvatar } from "@/components/TrainerAvatar";
import { seo } from "@/lib/seo";
import { useCloud } from '@/components/CloudProvider';
import { canChange } from '@/lib/gym-permissions';
import { readPreviewSession } from '@/lib/preview-session';
import { SampleAccountQR } from '@/components/SampleAccountQR';
import { GymGalleryManager } from '@/components/GymGallery';
import { CurrentLocationButton, LocationSummary } from '@/components/GymLocation';
import { gymContactUrl } from '@/lib/gym-contact';

export const Route = createFileRoute("/_gym/gym")({
  head: () => seo("Gym profile", "Manage your gym's public profile, plans, trainers and gallery."),
  component: GymProfile,
});

function GymProfile() {
  const c=useCloud();
  const gym = useStore((s) => s.gym);
  const plans = useStore((s) => s.plans);
  const trainers = useStore((s) => s.trainers);
  const [edit, setEdit] = useState(false);
  const [share, setShare] = useState(false);
  return (
    <div className="space-y-6">
      <EditGymDialog open={edit} onOpenChange={setEdit} />
      <ShareGymDialog open={share} onOpenChange={setShare} code={gym.code} gyvoraId={c.gyms.find(g=>g.id===c.gymId)?.gyvora_id} />
      <div className="panel relative overflow-hidden">
        {gym.cover ? <img src={gym.cover} alt={`${gym.name} cover`} className="h-64 w-full object-cover sm:h-80" width={1600} height={640} /> : <div aria-hidden="true" className="h-64 bg-secondary sm:h-80" />}
        <div className="hero-overlay absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div className="flex min-w-0 items-end gap-4">
            {gym.logo ? <img src={gym.logo} alt="Gym logo" className="h-20 w-20 shrink-0 rounded-2xl border-4 border-card object-cover" /> : <span className="h-20 w-20 shrink-0 rounded-2xl border-4 border-card bg-secondary" aria-hidden="true" />}
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold sm:text-3xl">{gym.name}</h1>
              <p className="text-sm text-muted-foreground">{gym.tagline}</p>
              {c.gyms.find(g=>g.id===c.gymId)?.gyvora_id&&<p className="mt-1 break-all text-xs text-muted-foreground">{readPreviewSession() ? "Sample GYVORA ID" : "GYVORA ID"} · {c.gyms.find(g=>g.id===c.gymId)?.gyvora_id}</p>}
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" />{gym.location}</span>
                <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-primary" />{gym.hoursByDay[0] ? `${fmt12(gym.hoursByDay[0].open)} – ${fmt12(gym.hoursByDay[0].close)}` : "Hours not set"}</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {canChange(c.role,c.permissions,'Profile','edit')&&<Button onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />Edit Profile</Button>}
            <Button variant="secondary" onClick={() => setShare(true)}><Share2 className="h-4 w-4" />Share</Button>
          </div>
        </div>
      </div>

      {readPreviewSession() && <SampleAccountQR kind="gym"/>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="About the gym" className="lg:col-span-2">
          <p className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-muted-foreground">{gym.description || "No description added yet."}</p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {gym.facilities.map((f) => <div key={f} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs"><Check className="h-3.5 w-3.5 text-primary" />{f}</div>)}
          </div>
          {!gym.facilities.length && <p className="mt-3 text-sm text-muted-foreground">No facilities added yet.</p>}
        </Panel>
        <div className="space-y-6">
          <Panel title="Services">
            <div className="flex flex-wrap gap-2">{gym.services.map((s) => <span key={s} className="rounded-full border px-3 py-1.5 text-xs">{s}</span>)}</div>
            {!gym.services.length && <p className="text-sm text-muted-foreground">No services added yet.</p>}
          </Panel>
          <Panel title="Working hours">
            <ul className="space-y-2 text-sm">
              {gym.hoursByDay.map((d) => (
                <li key={d.day} className="flex justify-between"><span>{d.day}</span><span className={d.closed ? "text-destructive" : "text-muted-foreground"}>{d.closed ? "Closed" : `${fmt12(d.open)} – ${fmt12(d.close)}`}</span></li>
              ))}
            </ul>
            {!gym.hoursByDay.length && <p className="text-sm text-muted-foreground">Working hours have not been set.</p>}
          </Panel>
        </div>
      </div>

      <Panel title="Membership plans">
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className={`rounded-xl border p-5 ${p.featured ? "border-primary/50 bg-accent" : "bg-surface"}`}>
              <div className="eyebrow">{p.duration}</div>
              <div className="mt-2 font-display text-xl font-semibold">{p.name}</div>
              <div className="mt-3 font-display text-2xl text-primary">{currencyOf()} {p.price.toLocaleString()}</div>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">{p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>)}</ul>
            </div>
          ))}
        </div>
        {!plans.length && <p className="text-sm text-muted-foreground">No membership plans added yet.</p>}
      </Panel>

      <Panel title="Trainers">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {trainers.map((t) => (
            <div key={t.id} className="min-w-0 rounded-lg bg-surface p-5">
              <TrainerAvatar t={t} size="h-14 w-14" />
              <div className="mt-4 break-words font-semibold">{t.name?.trim() || "Trainer"}</div>
              {t.specialty?.trim() && <div className="break-words text-xs text-primary">{t.specialty}</div>}
              {t.notes?.trim() && <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">{t.notes}</p>}
            </div>
          ))}
        </div>
        {!trainers.length && <p className="text-sm text-muted-foreground">No trainers</p>}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <GymGalleryManager editable={canChange(c.role,c.permissions,'Profile','edit')} />
        <div className="space-y-6">
          <Panel title="Location" action={canChange(c.role,c.permissions,'Profile','edit') ? <CurrentLocationButton /> : undefined}>
            <LocationSummary address={gym.location} coords={gym.coords} directions />
          </Panel>
          <Panel title="Contact">
            <div className="space-y-2 text-sm">
              {gym.phone && <a className="flex items-center gap-2 hover:text-primary" href={`tel:${gym.phone}`}><Phone className="h-4 w-4 text-primary" />{gym.phone}</a>}
              {gym.whatsapp && <a className="flex items-center gap-2 break-all hover:text-primary" href={gymContactUrl("whatsapp", gym.whatsapp) || undefined} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 shrink-0 text-primary" />WhatsApp {gym.whatsapp}</a>}
              {gym.instagram && <a className="flex items-center gap-2 break-all hover:text-primary" href={gymContactUrl("social", gym.instagram) || undefined} target="_blank" rel="noreferrer"><Instagram className="h-4 w-4 shrink-0 text-primary" />Instagram</a>}
              {gym.facebook && <a className="flex items-center gap-2 break-all hover:text-primary" href={gymContactUrl("social", gym.facebook) || undefined} target="_blank" rel="noreferrer"><Facebook className="h-4 w-4 shrink-0 text-primary" />Facebook</a>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
