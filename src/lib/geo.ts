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
