import { toast } from "sonner";
import { Button } from "./ui/button";
import { ExerciseImage } from "./ProgramEditor";
import { useCloud } from "./CloudProvider";
import { getDemoSession, pendingDemoAssignments, respondDemoAssignment, useDemoStore } from "@/lib/demo";

/** Pending trainer-sent workouts for the signed-in client only. */
export function AssignedWorkouts({ onSaved }: { onSaved?: () => void }) {
  const c = useCloud();
  const all = useDemoStore((s) => s.assignments);
  if (!getDemoSession() || !c.profile) return null;
  const rows = pendingDemoAssignments(c.profile.id, all);
  if (!rows.length) return null;
  return (
    <section aria-label="Workouts sent to you" className="mb-8 space-y-4">
      <h2 className="eyebrow">Workouts sent to you ({rows.length})</h2>
      {rows.map((a) => (
        <article key={a.id} className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">{a.program.name}</p>
              {a.program.trainer && <p className="text-sm text-muted-foreground">Trainer · {a.program.trainer}</p>}
              <p className="text-sm text-muted-foreground">
                {a.senderName} ({a.gymName}) · {new Date(a.sentAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  try {
                    respondDemoAssignment(a.id, true);
                    toast.success("Workout saved to your programs");
                    onSaved?.();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not save");
                  }
                }}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  try {
                    respondDemoAssignment(a.id, false);
                    toast.success("Workout notification deleted");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not delete");
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </div>
          <ul className="divide-y">
            {a.program.exercises.map((e, i) => (
              <li key={i} className="flex items-center gap-4 py-3">
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
        </article>
      ))}
    </section>
  );
}
