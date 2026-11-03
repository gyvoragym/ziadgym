import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader, Panel } from "@/components/kit";
import { CURRENCIES, defaultPreferences, readFile, saveState, useStore, type Currency, type GymPreferences } from "@/lib/store";
import { useCloud } from "@/components/CloudProvider";
import { seo } from "@/lib/seo";
import { gymNotificationTypes } from "@/lib/notification-preferences";

export const Route = createFileRoute("/_gym/settings")({
  head: () => seo("Settings", "Gym information, branding, currency, language and notification preferences."),
  component: Settings,
});

const sel = "h-10 w-full rounded-md border bg-surface px-3 text-sm";
function Settings() {
  const c = useCloud();
  const saved = useStore((s) => s.gym);
  const [form, setForm] = useState({ name: saved.name, phone: saved.phone || c.profile?.phone || "", location: saved.location, logo: saved.logo });
  const [prefs, setPrefs] = useState<GymPreferences>({ ...defaultPreferences, ...saved.preferences });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setForm({ name: saved.name, phone: saved.phone || c.profile?.phone || "", location: saved.location, logo: saved.logo }); setPrefs({ ...defaultPreferences, ...saved.preferences }); }, [saved, c.profile?.phone]);
  const up = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  async function save() {
    const name = form.name.trim(), phone = form.phone.trim(), location = form.location.trim();
    if (!name || !phone || !location) { setError("Gym name, phone and address are required."); return; }
    setBusy(true); setError("");
    try {
      await saveState((s) => ({ gym: { ...s.gym, name, phone, location, logo: form.logo, preferences: { ...prefs, timeZone: prefs.timeZone ?? 'UTC' } } }));
      toast.success("Settings saved");
    } catch (e) { const m = e instanceof Error ? e.message : "Could not save settings"; setError(m); toast.error(m); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Settings" actions={<Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</Button>} />
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Gym information">
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="g-name">Gym name</Label><Input id="g-name" required maxLength={80} value={form.name} onChange={(e) => up({ name: e.target.value })} className="bg-surface" /></div>
            <div className="space-y-2"><Label htmlFor="g-phone">Gym contact phone</Label><Input id="g-phone" required maxLength={30} value={form.phone} onChange={(e) => up({ phone: e.target.value })} className="bg-surface" /><p className="text-xs text-muted-foreground">Your sign-in phone is managed separately in Account Settings.</p></div>
            <div className="space-y-2"><Label htmlFor="g-addr">Address</Label><Input id="g-addr" required maxLength={160} value={form.location} onChange={(e) => up({ location: e.target.value })} className="bg-surface" /></div>
          </div>
        </Panel>
        <Panel title="Logo & regional">
          <div className="flex items-center gap-4">
            {form.logo ? <img src={form.logo} alt="Gym logo" className="h-16 w-16 rounded-2xl object-cover" /> : <span className="h-16 w-16 rounded-2xl bg-secondary" aria-hidden="true" />}
            <Button variant="secondary" asChild><label className="cursor-pointer"><Upload className="h-4 w-4" />Upload logo<input type="file" accept="image/*" className="sr-only" aria-label="Upload logo" onChange={async (e) => { const f = e.target.files?.[0]; if (f) up({ logo: await readFile(f) }); }} /></label></Button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="g-cur">Currency</Label><select id="g-cur" className={sel} value={prefs.currency} onChange={(e) => setPrefs({ ...prefs, currency: e.target.value as Currency })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="g-lang">Language</Label><select id="g-lang" className={sel} value={prefs.language} onChange={(e) => setPrefs({ ...prefs, language: e.target.value as GymPreferences["language"] })}><option>English</option><option>العربية</option></select></div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Currency changes the displayed label only; saved amounts are not converted.</p>
          <div className="mt-4 space-y-2"><Label htmlFor="g-zone">Time zone</Label><select id="g-zone" className={sel} value={prefs.timeZone ?? 'UTC'} onChange={e => setPrefs({ ...prefs, timeZone: e.target.value })}>{Array.from(new Set([Intl.DateTimeFormat().resolvedOptions().timeZone, ...Intl.supportedValuesOf('timeZone'), 'UTC'])).sort().map(zone => <option key={zone}>{zone}</option>)}</select></div>
        </Panel>
        <Panel title="Notifications" className="lg:col-span-2">
          <div className="space-y-4">
            {gymNotificationTypes.map((n) => (
              <div key={n} className="flex items-center justify-between text-sm"><span>{n}</span><Switch aria-label={n} checked={prefs.notifications[n] !== false} onCheckedChange={(v) => setPrefs({ ...prefs, notifications: { ...prefs.notifications, [n]: v } })} /></div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
