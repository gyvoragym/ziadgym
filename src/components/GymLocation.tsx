import { lazy, Suspense, useEffect, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Crosshair, ExternalLink, LoaderCircle, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtPoint, mapsLink, reverseGeocode, searchPlaces, validPoint, type GeoPoint } from "@/lib/geo";
import { getState, saveState } from "@/lib/store";

const LeafletMap = lazy(() => import("./LeafletMap"));
const MapSkeleton = ({ className = "h-72 w-full" }: { className?: string }) => <div className={`${className} animate-pulse rounded-lg bg-secondary`} aria-label="Loading map" />;

export function MapView({ point, className = "h-40 w-full" }: { point: GeoPoint; className?: string }) {
  const [err, setErr] = useState("");
  if (err) return <p role="alert" className="text-xs text-destructive">{err}</p>;
  return <ClientOnly fallback={<MapSkeleton className={className} />}><Suspense fallback={<MapSkeleton className={className} />}><LeafletMap point={point} onError={setErr} className={className} /></Suspense></ClientOnly>;
}

/** Read-only location block shared by owner and client profile views. */
export function LocationSummary({ address, coords, directions = false }: { address?: string | undefined; coords?: GeoPoint | undefined; directions?: boolean }) {
  const p = validPoint(coords) ? coords : null;
  if (!p && !address) return <div className="grid h-32 place-items-center gap-1 rounded-lg bg-secondary p-4 text-center text-sm text-muted-foreground"><MapPin className="h-6 w-6 text-primary" />Location not provided</div>;
  const dirUrl = p ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address ?? "")}`;
  return <div className="space-y-3">
    {p ? <MapView point={p} className="h-40 w-full" /> : <div className="grid h-32 place-items-center rounded-lg bg-secondary text-xs text-muted-foreground"><MapPin className="h-6 w-6 text-primary" />Map pin not set</div>}
    <p className="break-words text-sm text-muted-foreground">{address || "Address not provided"}</p>
    {p && <a href={mapsLink(p)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">{fmtPoint(p)}<ExternalLink className="h-3 w-3" /></a>}
    {directions && <Button asChild size="sm" className="w-full"><a href={dirUrl} target="_blank" rel="noreferrer"><MapPin className="h-4 w-4" />Get directions</a></Button>}
  </div>;
}

export function LocationPickerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [address, setAddress] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ label: string; point: GeoPoint }[]>([]);
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "error"; text?: string }>({ kind: "idle" });
  const [mapError, setMapError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!open) return; const g = getState().gym; setPoint(validPoint(g.coords) ? g.coords : null); setAddress(g.location ?? ""); setQ(""); setResults([]); setStatus({ kind: "idle" }); setMapError(""); }, [open]);

  const choose = async (p: GeoPoint, label?: string) => {
    setPoint(p); setResults([]);
    if (label) { setAddress(label); return; }
    setStatus({ kind: "busy", text: "Looking up address…" });
    try { const a = await reverseGeocode(p); if (a) setAddress(a); setStatus({ kind: "idle" }); }
    catch { setStatus({ kind: "error", text: "Pin placed, but the address could not be looked up. You can type it below." }); }
  };
  const useCurrent = () => {
    if (!("geolocation" in navigator)) { setStatus({ kind: "error", text: "This browser doesn't support location. Search or tap the map instead." }); return; }
    setStatus({ kind: "busy", text: "Finding your location…" });
    navigator.geolocation.getCurrentPosition(
      pos => void choose({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => setStatus({ kind: "error", text: err.code === err.PERMISSION_DENIED ? "Location permission was denied. Allow location in your browser settings, or search / tap the map instead." : err.code === err.TIMEOUT ? "Finding your location took too long. Try again or choose on the map." : "Your current location is unavailable. Search or tap the map instead." }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  };
  const search = async () => {
    if (q.trim().length < 3) { setStatus({ kind: "error", text: "Type at least 3 characters to search." }); return; }
    setStatus({ kind: "busy", text: "Searching…" });
    try { const r = await searchPlaces(q.trim()); setResults(r); setStatus(r.length ? { kind: "idle" } : { kind: "error", text: "No places found. Try a different search or tap the map." }); }
    catch { setStatus({ kind: "error", text: "Place search is unavailable right now. Tap the map to place the pin." }); }
  };
  const save = async () => {
    if (!address.trim() && !point) { setStatus({ kind: "error", text: "Enter an address or choose a point on the map." }); return; }
    setSaving(true);
    try { await saveState(() => ({ gym: { ...getState().gym, location: address.trim().slice(0, 300), ...(point ? { coords: { lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) } } : {}) } })); toast.success("Location saved"); onOpenChange(false); }
    catch (e) { toast.error(e instanceof Error ? `Location not saved: ${e.message}` : "Location not saved"); }
    finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={o => { if (!saving) onOpenChange(o); }}>
    <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>Set gym location</DialogTitle></DialogHeader>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="secondary" onClick={useCurrent} disabled={status.kind === "busy"}><Crosshair className="h-4 w-4" />Use my current location</Button>
        <form className="flex flex-1 gap-2" onSubmit={e => { e.preventDefault(); void search(); }}>
          <Input value={q} maxLength={200} placeholder="Search for a place or address" onChange={e => setQ(e.target.value)} aria-label="Search place" />
          <Button type="submit" variant="secondary" size="icon" aria-label="Search" disabled={status.kind === "busy"}><Search className="h-4 w-4" /></Button>
        </form>
      </div>
      {results.length > 0 && <ul className="max-h-40 overflow-y-auto rounded-lg border">{results.map((r, i) => <li key={i}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-secondary" onClick={() => void choose(r.point, r.label)}>{r.label}</button></li>)}</ul>}
      {mapError ? <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">{mapError}</p>
        : <ClientOnly fallback={<MapSkeleton />}><Suspense fallback={<MapSkeleton />}><LeafletMap point={point} onPick={p => void choose(p)} onError={setMapError} className="h-64 w-full sm:h-80" /></Suspense></ClientOnly>}
      <p className="text-xs text-muted-foreground">Tap the map or drag the pin to adjust the exact spot.</p>
      {status.kind !== "idle" && <p role={status.kind === "error" ? "alert" : "status"} className={`flex items-center gap-2 text-sm ${status.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}>{status.kind === "busy" && <LoaderCircle className="h-4 w-4 animate-spin" />}{status.text}</p>}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="space-y-1 text-sm"><span className="font-medium">Address</span><Input value={address} maxLength={300} onChange={e => setAddress(e.target.value)} placeholder="Address shown to clients" /></label>
        <div className="text-xs text-muted-foreground sm:pb-2">{point ? fmtPoint(point) : "No pin placed"}</div>
      </div>
      <DialogFooter>
        <Button variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save location"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
