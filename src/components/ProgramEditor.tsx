import { useState, useEffect } from "react";
import { CheckCheck, Plus, Trash2, ZoomIn } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Field } from "./kit";
import { programSchema } from "@/lib/validation";
import { uploadWorkoutMedia, imageUrl } from "@/lib/images";
import type { Trainer, Workout } from "@/lib/store";
import { TrainerField } from "./TrainerField";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";
export function ExerciseImage({
  path,
  className = "h-16 w-20 rounded-md object-cover",
  alt = "Exercise",
}: {
  path?: string | undefined;
  className?: string;
  alt?: string;
}) {
  const [url, setUrl] = useState("");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    setUrl("");
    if (path)
      void imageUrl(path)
        .then(setUrl)
        .catch(() => setUrl(""));
  }, [path]);
  if (!url) return null;
  const video = /^data:video\//i.test(url) || /\.(mp4|webm|mov)(?:$|[?#])/i.test(url);
  return <>
    <button type="button" className="group relative block overflow-hidden rounded-md" onClick={() => setExpanded(true)} aria-label={`View larger ${alt.toLowerCase()}`}>
      {video
        ? <video src={url} className={className} muted autoPlay loop playsInline preload="metadata" />
        : <img src={url} alt={alt} className={className} />}
      <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100"><ZoomIn className="h-6 w-6" /></span>
    </button>
    <Dialog open={expanded} onOpenChange={setExpanded}>
      <DialogContent className="max-h-[95vh] w-fit max-w-[95vw] p-2">
        <DialogHeader className="sr-only"><DialogTitle>{alt}</DialogTitle></DialogHeader>
        {video
          ? <video src={url} className="max-h-[85vh] max-w-[90vw] rounded object-contain" controls autoPlay playsInline />
          : <img src={url} alt={alt} className="max-h-[85vh] max-w-[90vw] rounded object-contain" />}
      </DialogContent>
    </Dialog>
  </>;
}
const empty = () => ({ name: "", sets: 3, reps: "10", image: "" });
export function ProgramEditor({
  open,
  onClose,
  program,
  onSave,
  onDelete,
  trainers,
}: {
  open: boolean;
  onClose: () => void;
  program?: Workout | null;
  onSave: (p: Workout) => Promise<void> | void;
  onDelete?: (() => Promise<void> | void) | undefined;
  trainers?: Trainer[];
}) {
  const [name, setName] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [trainer, setTrainer] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Workout["exercises"]>([empty()]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (open) {
      setName(program?.name ?? "");
      setTrainer(program?.trainer ?? "");
      setNotes(program?.notes ?? "");
      setRows(program?.exercises.map((e) => ({ ...e })) ?? [empty()]);
    }
  }, [open, program]);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{program ? "Edit program" : "New program"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const p = programSchema.parse({
                id: program?.id ?? generateId(),
                name,
                trainer: trainers ? trainer.trim() : program?.trainer ?? "",
                notes: trainers ? notes : program?.notes ?? "",
                exercises: rows,
              });
              await onSave(p);
              setSavedFlash(true);
              window.setTimeout(() => { setSavedFlash(false); onClose(); }, 700);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not save program");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Program name">
            <Input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          {trainers && <TrainerField trainers={trainers} value={trainer} onChange={setTrainer} />}
          {rows.map((r, i) => (
            <div key={i} className="space-y-3 border-b pb-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_5rem_5rem_auto]">
                <Field label="Exercise name">
                  <Input
                    required
                    maxLength={100}
                    value={r.name}
                    onChange={(e) =>
                      setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                    }
                  />
                </Field>
                <Field label="Sets">
                  <Input
                    required
                    type="number"
                    min={1}
                    max={100}
                    value={r.sets}
                    onChange={(e) =>
                      setRows(
                        rows.map((x, j) => (j === i ? { ...x, sets: Number(e.target.value) } : x)),
                      )
                    }
                  />
                </Field>
                <Field label="Reps">
                  <Input
                    required
                    maxLength={30}
                    value={r.reps}
                    onChange={(e) =>
                      setRows(rows.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)))
                    }
                  />
                </Field>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="self-end"
                  aria-label="Delete exercise"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ExerciseImage path={r.image} />
                <Field label="Exercise image or video">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                    disabled={uploading}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setUploading(true);
                      try {
                        const path = await uploadWorkoutMedia(f);
                        setRows((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, image: path } : x)),
                        );
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Upload failed");
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                </Field>
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={() => setRows([...rows, empty()])}>
            <Plus className="h-4 w-4" />
            Add exercise
          </Button>
          {trainers && (
            <Field label="Trainer Notes">
              <Textarea aria-label="Trainer Notes" rows={4} maxLength={1000}
                value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          )}
          <DialogFooter>
            {program && onDelete && (
              <Button
                type="button"
                variant="destructive"
                disabled={busy || uploading}
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Delete this gym program? Saved client copies will remain unchanged.",
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await onDelete();
                    onClose();
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Could not delete program",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Delete Program
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy || uploading || savedFlash} className={savedFlash ? "saved-flash" : undefined}>{savedFlash ? <><CheckCheck className="h-4 w-4" />Saved</> : busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
