import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoPoint } from "@/lib/geo";

const pin = L.divIcon({ className: "", html: '<span class="gy-map-pin"></span>', iconSize: [24, 24], iconAnchor: [12, 24] });

/** Browser-only OpenStreetMap view; draggable marker when onPick is given. */
export default function LeafletMap({ point, accuracy = null, onPick, onError, className = "h-72 w-full" }: { point: GeoPoint | null; accuracy?: number | null; onPick?: (p: GeoPoint) => void; onError?: (m: string) => void; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const circle = useRef<L.Circle | null>(null);
  const pick = useRef(onPick); pick.current = onPick;
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true, scrollWheelZoom: !!onPick }).setView(point ? [point.lat, point.lng] : [30.0444, 31.2357], point ? 16 : 11);
    let failures = 0;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" })
      .on("tileerror", () => { if (++failures === 4) onError?.("Map tiles could not load. Check your connection and try again."); }).addTo(m);
    if (onPick) m.on("click", e => pick.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.current = m;
    setTimeout(() => m.invalidateSize(), 150);
    return () => { m.remove(); map.current = null; marker.current = null; circle.current = null; };
  }, []);
  useEffect(() => {
    const m = map.current; if (!m) return;
    if (!point) { marker.current?.remove(); marker.current = null; return; }
    if (!marker.current) {
      marker.current = L.marker([point.lat, point.lng], { icon: pin, draggable: !!onPick, keyboard: true, title: "Gym location" }).addTo(m);
      marker.current.on("dragend", () => { const ll = marker.current!.getLatLng(); circle.current?.remove(); circle.current = null; pick.current?.({ lat: ll.lat, lng: ll.lng }); });
    } else marker.current.setLatLng([point.lat, point.lng]);
    circle.current?.remove(); circle.current = null;
    if (accuracy && accuracy > 15 && accuracy < 50000) {
      // Shows how far off the device reading may be, so the owner knows to drag the pin.
      circle.current = L.circle([point.lat, point.lng], { radius: accuracy, color: "#f5a524", weight: 1, fillOpacity: 0.12, interactive: false }).addTo(m);
      m.fitBounds(circle.current.getBounds(), { maxZoom: 18 });
    } else m.setView([point.lat, point.lng], Math.max(m.getZoom(), onPick ? 17 : 15));
  }, [point?.lat, point?.lng, accuracy]);
  return <div ref={el} className={`${className} z-0 overflow-hidden rounded-lg border`} role="application" aria-label="Map" />;
}
