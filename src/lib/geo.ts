/** Keyless geocoding via OpenStreetMap Nominatim (light, user-triggered use only). */
export type GeoPoint = { lat: number; lng: number };
const BASE = "https://nominatim.openstreetmap.org";
export const validPoint = (p: unknown): p is GeoPoint => !!p && typeof p === "object" && Number.isFinite((p as GeoPoint).lat) && Number.isFinite((p as GeoPoint).lng) && Math.abs((p as GeoPoint).lat) <= 90 && Math.abs((p as GeoPoint).lng) <= 180;
export const fmtPoint = (p: GeoPoint) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
export async function searchPlaces(q: string): Promise<{ label: string; point: GeoPoint }[]> {
  const r = await fetch(`${BASE}/search?format=jsonv2&limit=5&q=${encodeURIComponent(q.slice(0, 200))}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`Place search failed (${r.status})`);
  return ((await r.json()) as { display_name: string; lat: string; lon: string }[]).map(x => ({ label: x.display_name, point: { lat: Number(x.lat), lng: Number(x.lon) } }));
}
export async function reverseGeocode(p: GeoPoint): Promise<string> {
  const r = await fetch(`${BASE}/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`Address lookup failed (${r.status})`);
  return ((await r.json()) as { display_name?: string }).display_name ?? "";
}
export const mapsLink = (p: GeoPoint) => `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`;

export type LocationFix = { point: GeoPoint; accuracy: number };

/**
 * Watches the device position for a short time and keeps the most accurate reading.
 * The first reading on phones and laptops is often a rough Wi-Fi/IP estimate; GPS fixes arrive a few seconds later.
 */
export function bestCurrentPosition({ goodEnough = 25, maxWait = 20000 }: { goodEnough?: number; maxWait?: number } = {}): Promise<LocationFix> {
  return new Promise((resolve, reject) => {
    let best: LocationFix | null = null;
    let done = false;
    let id = 0;
    const finish = (error?: GeolocationPositionError) => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(id);
      clearTimeout(timer);
      if (best) resolve(best); else reject(error ?? new Error("Your current location is unavailable."));
    };
    const timer = setTimeout(() => finish(), maxWait);
    id = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = { point: { lat: pos.coords.latitude, lng: pos.coords.longitude }, accuracy: Math.round(pos.coords.accuracy || 9999) };
        if (!best || fix.accuracy <= best.accuracy) best = fix;
        if (fix.accuracy <= goodEnough) finish();
      },
      (error) => { if (error.code === error.PERMISSION_DENIED || !best) finish(error); },
      { enableHighAccuracy: true, timeout: maxWait, maximumAge: 0 },
    );
  });
}

export const accuracyHint = (accuracy: number) =>
  accuracy <= 50
    ? `Location found (accurate to about ${accuracy} m). Drag the pin if it is not exactly on the gym.`
    : `Your device only gave an approximate location (about ${accuracy >= 1000 ? `${(accuracy / 1000).toFixed(1)} km` : `${accuracy} m`} off), which is common on computers without GPS. Drag the pin onto the gym, tap the map, or search the address, then save.`;
