import { afterEach, describe, expect, it } from "vitest";
import { savePreviewSession, type PreviewSession } from "@/lib/preview-session";
import {
  changePreviewClientProgram,
  readPreviewClientPrograms,
  savePreviewClientProgram,
} from "@/lib/preview-client-programs";
import { clearPrototypeStorage } from "@/lib/prototype-storage";

const client = (id: string): PreviewSession => ({
  id,
  type: "individual",
  name: "Prototype client",
});

afterEach(() => {
  savePreviewSession(null);
  clearPrototypeStorage();
  localStorage.clear();
});

describe("prototype client workout persistence", () => {
  it("saves personal programs and preserves them when reopened", () => {
    savePreviewSession(client("preview-client-one"));
    const saved = savePreviewClientProgram("preview-client-one", {
      name: "My workout",
      trainer: "",
      notes: "",
      exercises: [{ name: "Squat", sets: 3, reps: "10" }],
    });

    expect(readPreviewClientPrograms("preview-client-one")).toEqual(saved);
    expect(saved[0]?.definition).toMatchObject({ name: "My workout" });
    expect(saved[0]?.completion).toEqual([]);
  });

  it("keeps workout programs isolated by preview client", () => {
    savePreviewSession(client("preview-client-one"));
    savePreviewClientProgram("preview-client-one", {
      name: "Private workout",
      trainer: "",
      notes: "",
      exercises: [{ name: "Squat", sets: 3, reps: "10" }],
    });

    savePreviewSession(client("preview-client-two"));
    expect(readPreviewClientPrograms("preview-client-two")).toEqual([]);
    expect(() => readPreviewClientPrograms("preview-client-one")).toThrow();
  });

  it("updates completion and removes saved programs", () => {
    savePreviewSession(client("preview-client-one"));
    const [program] = savePreviewClientProgram("preview-client-one", {
      name: "My workout",
      trainer: "",
      notes: "",
      exercises: [{ name: "Squat", sets: 3, reps: "10" }],
    });
    if (!program) throw new Error("Expected the workout to be saved.");

    expect(changePreviewClientProgram("preview-client-one", program.id, [0])[0]?.completion).toEqual([0]);
    expect(changePreviewClientProgram("preview-client-one", program.id, null)).toEqual([]);
    expect(readPreviewClientPrograms("preview-client-one")).toEqual([]);
  });

  it("persists gym source keys and prevents saving the same gym workout twice", () => {
    savePreviewSession(client("preview-client-one"));
    const definition = {
      name: "Gym strength",
      trainer: "",
      notes: "",
      exercises: [{ name: "Squat", sets: 3, reps: "10" }],
    };

    const saved = savePreviewClientProgram("preview-client-one", definition, undefined, {
      gymId: "gym-one",
      workoutId: "plan-one",
    });
    const duplicate = savePreviewClientProgram("preview-client-one", definition, undefined, {
      gymId: "gym-one",
      workoutId: "plan-one",
    });

    expect(saved).toHaveLength(1);
    expect(duplicate).toEqual(saved);
    expect(saved[0]).toMatchObject({
      source_gym_id: "gym-one",
      source_workout_id: "plan-one",
    });
  });
});
