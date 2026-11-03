import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useCloud } from "@/components/CloudProvider";
import { ClientShell } from "@/components/ClientShell";
import { ProgramEditor, ExerciseImage } from "@/components/ProgramEditor";
import { Button } from "@/components/ui/button";
import { Check, Plus } from "lucide-react";
import type { Workout } from "@/lib/store";
import { programSchema } from "@/lib/validation";
import { toast } from "sonner";
import { getDemoSession, getDemoState, saveDemoProgram, changeDemoProgram } from "@/lib/demo";
import { hasGymSource } from "@/lib/workout-sources";
import { seo } from "@/lib/seo";
import { readPreviewSession } from "@/lib/preview-session";
import {
  changePreviewClientProgram,
  readPreviewClientPrograms,
  savePreviewClientProgram,
} from "@/lib/preview-client-programs";
type Row = Database["public"]["Tables"]["client_programs"]["Row"];
export const Route = createFileRoute("/member/workouts")({
  head: () => seo("My workouts", "Manage personal workout programs and track exercise completion."),
  component: Workouts,
});
function Workouts() {
  const c = useCloud();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  async function load() {
    if (!c.profile) return;
    if (readPreviewSession()) {
      try {
        setRows(readPreviewClientPrograms(c.profile.id));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load programs");
      }
      setLoading(false);
      return;
    }
    if (getDemoSession()) {
      setRows(
        getDemoState().programs.filter((p) => p.user_id === c.profile?.id) as unknown as Row[],
      );
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("client_programs")
      .select("*")
      .eq("user_id", c.profile.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows(data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, [c.profile?.id]);
  async function completion(row: Row, marks: number[]) {
    if (readPreviewSession()) {
      try {
        setRows(changePreviewClientProgram(row.user_id, row.id, marks));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update program");
      }
      return;
    }
    if (getDemoSession()) {
      changeDemoProgram(row.id, marks);
      await load();
      return;
    }
    const { error } = await supabase
      .from("client_programs")
      .update({ completion: marks })
      .eq("id", row.id);
    if (error) toast.error(error.message);
    else setRows(rows.map((r) => (r.id === row.id ? { ...r, completion: marks } : r)));
  }
  return (
    <ClientShell
      title="Workout Programs"
      actions={
        <>
          <Button asChild variant="outline">
            <Link to="/member/browse">Browse Gym Programs</Link>
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New Program
          </Button>
        </>
      }
    >
      <div className="space-y-8">
        {rows.map((row) => {
          const w = row.definition as unknown as Workout;
          return (
            <section key={row.id} className="border-b pb-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">{w.name}</h2>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditing(row);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (!window.confirm("Delete this personal program?")) return;
                      if (readPreviewSession()) {
                        setRows(changePreviewClientProgram(row.user_id, row.id, null));
                        toast.success("Program deleted");
                        return;
                      }
                      if (getDemoSession()) {
                        changeDemoProgram(row.id, null);
                        await load();
                        toast.success("Program deleted");
                        return;
                      }
                      const { error } = await supabase
                        .from("client_programs")
                        .delete()
                        .eq("id", row.id);
                      if (error) toast.error(error.message);
                      else {
                        toast.success("Program deleted");
                        void load();
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              <ul className="divide-y">
                {w.exercises.map((e, i) => (
                  <li key={i} className="flex items-center gap-4 py-4">
                    <Button
                      size="icon"
                      variant={row.completion.includes(i) ? "default" : "outline"}
                      aria-label={`${row.completion.includes(i) ? "Clear" : "Complete"} ${e.name}`}
                      className={
                        row.completion.includes(i)
                          ? "rounded-full bg-success text-success-foreground hover:bg-success/90"
                          : "rounded-full"
                      }
                      onClick={() =>
                        void completion(
                          row,
                          row.completion.includes(i)
                            ? row.completion.filter((x) => x !== i)
                            : [...row.completion, i],
                        )
                      }
                    >
                      {row.completion.includes(i) && <Check className="h-4 w-4" />}
                    </Button>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{e.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {e.sets} sets · {e.reps} reps
                      </p>
                    </div>
                    <ExerciseImage path={e.image} />
                  </li>
                ))}
              </ul>
              <Button className="mt-4" variant="secondary" onClick={() => void completion(row, [])}>
                Complete Workout
              </Button>
            </section>
          );
        })}
      </div>
      {!rows.length && (
        <p className="py-8 text-muted-foreground">
          {loading ? "Loading programs…" : "No personal programs yet."}
        </p>
      )}
      <ProgramEditor
        open={open}
        onClose={() => setOpen(false)}
        program={editing ? (editing.definition as unknown as Workout) : null}
        onSave={async (w) => {
          if (!c.profile) return;
          const parsed = programSchema.parse(w);
          const previous = editing?.definition as unknown as Record<string, unknown> | undefined;
          const p = previous && typeof previous["sourceGymId"] === "string" && typeof previous["sourceWorkoutId"] === "string" && hasGymSource(previous,previous["sourceGymId"],previous["sourceWorkoutId"]) ? {...parsed,sourceGymId:previous["sourceGymId"],sourceWorkoutId:previous["sourceWorkoutId"]} : parsed;
          if (readPreviewSession()) {
            setRows(savePreviewClientProgram(c.profile.id, p, editing?.id));
            toast.success("Program saved");
            return;
          }
          if (getDemoSession()) {
            saveDemoProgram(c.profile.id, p, editing?.id);
            toast.success("Program saved");
            await load();
            return;
          }
          const { error } = editing
            ? await supabase
                .from("client_programs")
                .update({ definition: p as unknown as Json, completion: [] })
                .eq("id", editing.id)
            : await supabase
                .from("client_programs")
                .insert({ user_id: c.profile.id, definition: p as unknown as Json, completion: [] });
          if (error) throw error;
          toast.success("Program saved");
          await load();
        }}
      />
    </ClientShell>
  );
}
