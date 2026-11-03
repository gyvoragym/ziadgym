import { useEffect, useState } from "react";
import { Plus, ScanLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Field, selectCls } from "./kit";
import { QRScanner } from "./QRScanner";
import { TrainerField } from "./TrainerField";
import { ExerciseImage } from "./ProgramEditor";
import { useCloud } from "./CloudProvider";
import { useStore, type Member, type Workout } from "@/lib/store";
import { findSessionClient } from "@/lib/session-client";
import { programSchema } from "@/lib/validation";
import { uploadImage } from "@/lib/images";
import { getDemoSession, sendDemoAssignment } from "@/lib/demo";
import { generateId } from "@/lib/utils";

const emptyRow = () => ({ name: "", sets: 3, reps: "10", image: "" });

export function AssignWorkout({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useCloud();
  const members = useStore((s) => s.members);
  const workouts = useStore((s) => s.workouts);
  const trainers = useStore((s) => s.trainers);
  const [trainer, setTrainer] = useState("");
  const gymName = useStore((s) => s.gym.name);
  const [client, setClient] = useState<Member | null>(null);
  const [query, setQuery] = useState("");
  const [memberId, setMemberId] = useState("");
  const [scan, setScan] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [existing, setExisting] = useState("");
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Workout["exercises"]>([emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [requestKey, setRequestKey] = useState("");

  useEffect(() => {
    if (!open) return;
    setClient(null);
    setQuery("");
    setMemberId("");
    setMode("existing");
    setExisting("");
    setName("");
    setTrainer("");
    setRows([emptyRow()]);
    setRequestKey(generateId());
  }, [open]);

  function pick(m: Member | undefined) {
    if (!m) {
      toast.error("No client with that ID or name in this gym");
      return false;
    }
    setClient(m);
    setQuery(m.name);
    return true;
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!client) {
      toast.error("Select a client first");
      return;
    }
    if (!getDemoSession()) {
      toast.error("Sending workouts is available in the prototype accounts only");
      return;
    }
    setBusy(true);
    try {
      const source = mode === "existing" ? workouts[Number(existing)] : undefined;
      if (mode === "existing" && !source) throw new Error("Choose a program to send");
      const program = programSchema.parse(
        source
           ? { ...source, id: generateId(), trainer: trainer.trim() }
           : { id: generateId(), name, trainer: trainer.trim(), notes: "", exercises: rows },
      );
      sendDemoAssignment({ requestKey, gymId: c.gymId, gymName, memberId: client.id, program });
      toast.success(`Workout sent to ${client.name}`);
      onClose();
    } catch (err) {
      toast.error(
        err && typeof err === "object" && "issues" in err
          ? "Fill in every exercise name, sets and reps"
          : err instanceof Error
            ? err.message
            : "Could not send workout",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open={open && !scan} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Workout</DialogTitle>
          </DialogHeader>
          <form className="space-y-5" onSubmit={send}>
            <div className="space-y-3">
              <p className="eyebrow">Client</p>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Field label="Search client by name">
                  <Input
                    aria-label="Search client by name"
                    list="assign-members"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      const m = members.find(
                        (x) => x.name.toLowerCase() === e.target.value.trim().toLowerCase(),
                      );
                      setClient(m ?? null);
                    }}
                  />
                  <datalist id="assign-members">
                    {members.map((m) => (
                      <option key={m.id}>{m.name}</option>
                    ))}
                  </datalist>
                </Field>
                <Button type="button" variant="secondary" className="self-end" onClick={() => setScan(true)}>
                  <ScanLine className="h-4 w-4" />
                  Scan client QR
                </Button>
              </div>
              <div className="flex items-end gap-3">
                <Field label="Member ID">
                  <Input aria-label="Member ID" value={memberId} onChange={(e) => setMemberId(e.target.value)} placeholder="M-1040" />
                </Field>
                <Button type="button" variant="outline" onClick={() => pick(findSessionClient(members, memberId))}>
                  Find
                </Button>
              </div>
              {client && (
                <p className="rounded-lg bg-surface p-3 text-sm" role="status">
                  <span className="font-medium">{client.name}</span> · {client.id} · member of {gymName}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <p className="eyebrow">Workout</p>
              <div className="flex gap-2">
                <Button type="button" variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")}>
                  Choose Existing Program
                </Button>
                <Button type="button" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>
                  Create New Program
                </Button>
              </div>
              {mode === "existing" ? (
                <Field label="Gym program">
                  <select aria-label="Gym program" className={selectCls} value={existing} onChange={(e) => {
                    setExisting(e.target.value);
                    setTrainer(e.target.value ? workouts[Number(e.target.value)]?.trainer ?? "" : "");
                  }}>
                    <option value="">Select a program…</option>
                    {workouts.map((w, i) => (
                      <option key={i} value={i}>
                        {w.name} ({w.exercises.length} exercises)
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <>
                  <Field label="Program Name">
                    <Input aria-label="Program Name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  {rows.map((r, i) => {
                    const set = (patch: Partial<Workout["exercises"][number]>) =>
                      setRows((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    return (
                      <div key={i} className="space-y-3 border-b pb-4">
                        <div className="grid gap-3 sm:grid-cols-[1fr_5rem_5rem_auto]">
                          <Field label="Exercise Name">
                            <Input aria-label={`Exercise Name ${i + 1}`} required maxLength={100} value={r.name} onChange={(e) => set({ name: e.target.value })} />
                          </Field>
                          <Field label="Sets">
                            <Input aria-label={`Sets ${i + 1}`} required type="number" min={1} max={100} value={r.sets} onChange={(e) => set({ sets: Number(e.target.value) })} />
                          </Field>
                          <Field label="Reps">
                            <Input aria-label={`Reps ${i + 1}`} required maxLength={30} value={r.reps} onChange={(e) => set({ reps: e.target.value })} />
                          </Field>
                          <Button type="button" size="icon" variant="ghost" className="self-end" aria-label={`Remove exercise ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <ExerciseImage path={r.image} />
                          <Field label="Exercise Image">
                            <Input
                              type="file"
                              aria-label={`Exercise Image ${i + 1}`}
                              accept="image/jpeg,image/png,image/webp"
                              disabled={uploading}
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                setUploading(true);
                                try {
                                  set({ image: await uploadImage(f) });
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : "Upload failed");
                                } finally {
                                  setUploading(false);
                                }
                              }}
                            />
                          </Field>
                        </div>
                      </div>
                    );
                  })}
                  <Button type="button" variant="secondary" onClick={() => setRows([...rows, emptyRow()])}>
                    <Plus className="h-4 w-4" />
                    Add Exercise
                  </Button>
                </>
              )}
            </div>
            <TrainerField trainers={trainers} value={trainer} onChange={setTrainer} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={busy || uploading}>{busy ? "Sending…" : "Send"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <QRScanner
        open={open && scan}
        onClose={() => setScan(false)}
        onScan={(v) => {
          const ok = pick(findSessionClient(members, v));
          if (ok) setScan(false);
          return ok;
        }}
        title="Scan client QR"
        manualLabel="Member ID"
      />
    </>
  );
}
