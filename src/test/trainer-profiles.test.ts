import { describe, expect, it } from "vitest";
import { trainers, workouts } from "@/lib/mock";
import { deleteTrainerProfile, updateTrainerProfile, trainerCreatedWorkout, trainerProfileSchema } from "@/lib/trainer-profiles";
import { defaultSchedule } from "@/lib/gym-updates";

describe("gym trainer profiles", () => {
  it("updates profile fields without changing the weekly schedule or other trainers", () => {
    const base = trainers[0];
    if (!base) throw new Error("Missing trainer fixture");
    const rows = [{ ...base, schedule: defaultSchedule() }, ...trainers.slice(1)];
    const next = updateTrainerProfile(rows, base.id, { name: "Coach Updated", specialty: "Strength", phone: "01012345678", image: "data:image/png;base64,test" });
    expect(next[0]).toMatchObject({ name: "Coach Updated", specialty: "Strength", phone: "01012345678", image: "data:image/png;base64,test", schedule: rows[0]?.schedule });
    expect(next.slice(1)).toEqual(rows.slice(1));
  });
  it("deletes only the target trainer from the supplied gym records", () => {
    const rows = structuredClone(trainers);
    const target = rows[0];
    if (!target) throw new Error("Missing trainer fixture");
    expect(deleteTrainerProfile(rows, target.id)).toEqual(rows.slice(1));
    expect(trainers).toHaveLength(rows.length);
  });
  it("saves and clears notes without changing schedule, biography or trainer identity", () => {
    const base = trainers[0];
    if (!base) throw new Error("Missing trainer fixture");
    const trainer = { ...base, schedule: defaultSchedule() };
    const profile = { name: trainer.name, specialty: trainer.specialty, phone: trainer.phone, image: trainer.image ?? "", notes: "Technique focus\nProgress reviewed weekly" };
    const saved = updateTrainerProfile([trainer], trainer.id, profile);
    expect(saved[0]?.notes).toBe("Technique focus\nProgress reviewed weekly");
    expect(saved[0]).toMatchObject({ id: trainer.id, bio: trainer.bio, schedule: trainer.schedule });
    expect(updateTrainerProfile(saved, trainer.id, { ...profile, notes: "" })[0]?.notes).toBe("");
  });
  it("keeps historical workout associations after trainer renames without rewriting programs", () => {
    const base = trainers[0];
    if (!base) throw new Error("Missing trainer fixture");
    const workoutDefinitions = structuredClone(workouts);
    const profile = { name: "Updated Coach", specialty: base.specialty, phone: base.phone, image: "" };
    const renamed = updateTrainerProfile([base], base.id, profile)[0];
    if (!renamed) throw new Error("Missing updated trainer");
    expect(trainerCreatedWorkout(renamed, base.name)).toBe(true);
    expect(trainerCreatedWorkout(renamed, "Updated Coach")).toBe(true);
    expect(trainerCreatedWorkout(renamed, "Unrelated Coach")).toBe(false);
    expect(workoutDefinitions).toEqual(workouts);
  });
  it("allows legacy profiles without notes but rejects notes beyond the allowed length", () => {
    const profile = { name: "Coach", specialty: "Strength", phone: "01012345678", image: "" };
    expect(trainerProfileSchema.parse(profile).notes).toBeUndefined();
    expect(() => trainerProfileSchema.parse({ ...profile, notes: "a".repeat(1001) })).toThrow();
  });
  it("rejects blank profile values and missing gym trainers", () => {
    const profile = { name: " ", specialty: "Strength", phone: "01012345678", image: "" };
    expect(() => updateTrainerProfile(trainers, "missing", profile)).toThrow();
    expect(() => updateTrainerProfile([], "missing", { ...profile, name: "Coach" })).toThrow("Trainer no longer exists in this gym");
  });
});