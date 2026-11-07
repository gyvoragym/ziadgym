import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { ImagePlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { imageUrl, uploadImage } from "@/lib/images";
import { getState, saveState, toPhoto, useStore, type GalleryPhoto } from "@/lib/store";
import { generateId } from "@/lib/utils";
import { Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Renders a saved gallery photo (storage path or URL); skeleton while loading, notice if unavailable. */
export function GalleryImage({ path, className = "aspect-[4/3] w-full rounded-lg object-cover" }: { path: string; className?: string }) {
  const [state, setState] = useState<{ url: string; status: "loading" | "ready" | "failed" }>({ url: "", status: "loading" });
  useEffect(() => {
    let live = true;
    setState({ url: "", status: "loading" });
    imageUrl(path).then(url => live && setState({ url, status: url ? "ready" : "failed" })).catch(() => live && setState({ url: "", status: "failed" }));
    return () => { live = false; };
  }, [path]);
  if (state.status === "failed") return <div className={`${className} grid place-items-center bg-secondary text-xs text-muted-foreground`}>Photo unavailable</div>;
  if (state.status === "loading") return <div className={`${className} animate-pulse bg-secondary`} aria-label="Loading photo" />;
  return <img src={state.url} alt="Gym gallery" loading="lazy" className={className} onError={() => setState({ url: "", status: "failed" })} />;
}

const ASPECT = 4 / 3;
async function cropToFile(src: string, area: Area, name: string): Promise<File> {
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Could not read image")); i.src = src; });
  const w = Math.min(1600, Math.round(area.width)), h = Math.round(w / ASPECT);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"); if (!ctx) throw new Error("Cropping is not supported in this browser");
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, w, h);
  const blob = await new Promise<Blob | null>(r => c.toBlob(r, "image/jpeg", 0.9));
  if (!blob) throw new Error("Could not crop image");
  return new File([blob], name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

const savePhotos = (photos: GalleryPhoto[]) => saveState(() => ({ gym: { ...getState().gym, gallery: photos } }));

function PhotoDialog({ photo, onClose }: { photo: GalleryPhoto | "new" | null; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [live, setLive] = useState("");
  const onComplete = useCallback((_: Area, px: Area) => setArea(px), []);
  useEffect(() => { setCrop({ x: 0, y: 0 }); setZoom(1); setArea(null); }, [preview]);
  useEffect(() => {
    if (!preview || !area) { setLive(""); return; }
    let url = ""; let on = true;
    const t = setTimeout(() => { cropToFile(preview, area, "p").then(f => { if (!on) return; url = URL.createObjectURL(f); setLive(url); }).catch(() => {}); }, 120);
    return () => { on = false; clearTimeout(t); if (url) URL.revokeObjectURL(url); };
  }, [preview, area]);
  const isNew = photo === "new";
  useEffect(() => { setFile(null); setPreview(""); setCaption(photo && photo !== "new" ? photo.caption : ""); }, [photo]);
  useEffect(() => { if (!file) return; const u = URL.createObjectURL(file); setPreview(u); return () => URL.revokeObjectURL(u); }, [file]);
  const submit = async () => {
    if (isNew && !file) { toast.error("Choose a photo first"); return; }
    setBusy(true);
    try {
      if (file && !area) throw new Error("Choose a crop area first");
      const path = file ? await uploadImage(await cropToFile(preview, area!, file.name)) : (photo as GalleryPhoto).path;
      const current = getState().gym.gallery.map(toPhoto);
      const next = isNew ? [...current, { id: generateId(), path, caption: caption.trim() }] : current.map(p => p.id === (photo as GalleryPhoto).id ? { ...p, path, caption: caption.trim() } : p);
      await savePhotos(next);
      toast.success(isNew ? "Photo added to gallery" : "Photo updated");
      onClose();
    } catch (err) { toast.error(err instanceof Error ? `Not saved: ${err.message}` : "Not saved — please try again"); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={!!photo} onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{isNew ? "Add photo" : "Edit photo"}</DialogTitle></DialogHeader>
        {preview ? <div className="space-y-3">
          <div className="relative h-56 w-full overflow-hidden rounded-lg bg-secondary sm:h-72"><Cropper image={preview} crop={crop} zoom={zoom} aspect={ASPECT} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onComplete} /></div>
          <label className="flex items-center gap-3 text-xs text-muted-foreground">Zoom<input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="flex-1 accent-primary" aria-label="Zoom" /></label>
          <div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">Gallery preview</span>{live ? <img src={live} alt="Cropped preview" className="aspect-[4/3] w-28 rounded-md object-cover" /> : <div className="aspect-[4/3] w-28 animate-pulse rounded-md bg-secondary" />}</div>
        </div> : photo && photo !== "new" ? <GalleryImage path={photo.path} /> : <div className="grid aspect-[4/3] place-items-center rounded-lg bg-secondary text-sm text-muted-foreground">No photo selected</div>}
        <Input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} aria-label={isNew ? "Choose photo" : "Replace photo"} />
        <Input value={caption} maxLength={140} placeholder="Caption (optional)" disabled={busy} onChange={e => setCaption(e.target.value)} />
        <DialogFooter>
          <Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={submit}>{busy ? (file ? "Uploading…" : "Saving…") : file ? "Crop & Upload" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Owner-side Photos section: add, caption, replace and delete without the full profile form. */
export function GymGalleryManager({ editable }: { editable: boolean }) {
  const photos = useStore(s => s.gym.gallery).map(toPhoto);
  const [editing, setEditing] = useState<GalleryPhoto | "new" | null>(null);
  const [removing, setRemoving] = useState<GalleryPhoto | null>(null);
  const busy = useRef(false);
  return (
    <Panel title="Photos" className="lg:col-span-2" action={editable ? <Button size="sm" onClick={() => setEditing("new")}><ImagePlus className="h-4 w-4" />Add Photo</Button> : undefined}>
      {photos.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map(p => (
            <figure key={p.id} className="space-y-1">
              <div className="relative">
                <GalleryImage path={p.path} />
                {editable && <div className="absolute right-1 top-1 flex gap-1">
                  <Button size="icon" variant="secondary" className="h-7 w-7" aria-label="Edit photo" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="secondary" className="h-7 w-7" aria-label="Delete photo" onClick={() => setRemoving(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>}
              </div>
              {p.caption && <figcaption className="break-words text-xs text-muted-foreground">{p.caption}</figcaption>}
            </figure>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">No photos yet.{editable ? " Use Add Photo to show your gym to clients." : ""}</p>}
      <PhotoDialog photo={editing} onClose={() => setEditing(null)} />
      <Dialog open={!!removing} onOpenChange={o => { if (!o) setRemoving(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete this photo?</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">It will be removed from your gallery and clients will no longer see it.</p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              if (!removing || busy.current) return; busy.current = true;
              try { await savePhotos(getState().gym.gallery.map(toPhoto).filter(x => x.id !== removing.id)); toast.success("Photo deleted"); }
              catch (err) { toast.error(err instanceof Error ? `Not deleted: ${err.message}` : "Not deleted"); }
              finally { busy.current = false; setRemoving(null); }
            }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
