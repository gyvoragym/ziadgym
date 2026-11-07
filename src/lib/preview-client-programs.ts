import type { Database, Json } from "@/integrations/supabase/types";
import type { Workout } from "./store";
import { readPreviewSession } from "./preview-session";
import { prototypeStorage } from "./prototype-storage";
import { generateId } from "./utils";
import { hasGymSource } from "./workout-sources";

type ClientProgram = Database["public"]["Tables"]["client_programs"]["Row"];
const key = (userId: string) => `ironhaus-preview-client-programs:${userId}`;

function assertPreviewClient(userId: string) {
  const session = readPreviewSession();
  if (session?.type !== "individual" || session.id !== userId)
    throw new Error("Personal programs are unavailable for this prototype account.");
}

export function readPreviewClientPrograms(userId: string): ClientProgram[] {
  assertPreviewClient(userId);
  const raw = prototypeStorage().getItem(key(userId));
  if (!raw) return [];
  const rows: unknown = JSON.parse(raw);
  if (
    !Array.isArray(rows) ||
    rows.some(
      (row) =>
        !row ||
        typeof row !== "object" ||
        row["user_id"] !== userId ||
        typeof row["id"] !== "string" ||
        !Array.isArray(row["completion"]),
    )
  )
    throw new Error("Saved prototype workout data is invalid.");
  return rows as ClientProgram[];
}

function writePreviewClientPrograms(userId: string, rows: ClientProgram[]) {
  assertPreviewClient(userId);
  prototypeStorage().setItem(key(userId), JSON.stringify(rows));
  return rows;
}

export function savePreviewClientProgram(
  userId: string,
  definition: Workout,
  id?: string,
  source?: { gymId: string; workoutId: string },
): ClientProgram[] {
  const rows = readPreviewClientPrograms(userId);
  const previous = id ? rows.find((row) => row.id === id) : undefined;
  if (id && !previous) throw new Error("Program unavailable.");
  if (
    !id &&
    source &&
    rows.some(
      (row) =>
        (row.source_gym_id === source.gymId &&
          row.source_workout_id === source.workoutId) ||
        hasGymSource(row.definition, source.gymId, source.workoutId),
    )
  )
    return rows;
  const row: ClientProgram = {
    id: previous?.id ?? generateId(),
    user_id: userId,
    definition: definition as unknown as Json,
    completion: [],
    created_at: previous?.created_at ?? new Date().toISOString(),
    source_gym_id: source?.gymId ?? previous?.source_gym_id ?? null,
    source_workout_id: source?.workoutId ?? previous?.source_workout_id ?? null,
  };
  return writePreviewClientPrograms(
    userId,
    previous ? rows.map((item) => (item.id === id ? row : item)) : [row, ...rows],
  );
}

export function changePreviewClientProgram(
  userId: string,
  id: string,
  completion: number[] | null,
): ClientProgram[] {
  const rows = readPreviewClientPrograms(userId);
  if (!rows.some((row) => row.id === id)) throw new Error("Program unavailable.");
  return writePreviewClientPrograms(
    userId,
    completion === null
      ? rows.filter((row) => row.id !== id)
      : rows.map((row) => (row.id === id ? { ...row, completion } : row)),
  );
}
