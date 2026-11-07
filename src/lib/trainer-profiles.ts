import { z } from "zod";
import type { Trainer } from "./store";

export const trainerProfileSchema = z.object({
  name: z.string().trim().min(1, "Enter a trainer name").max(60),
  specialty: z.string().trim().min(1, "Enter a specialty").max(60),
  phone: z.string().trim().min(1, "Enter a phone number").max(30),
  image: z.string().max(8_000_000),
  notes: z.string().trim().max(1000, "Keep notes within 1,000 characters").optional(),
});

export function updateTrainerProfile(rows: Trainer[], id: string, input: unknown): Trainer[] {
  const profile = trainerProfileSchema.parse(input);
  if (!rows.some((t) => t.id === id)) throw new Error("Trainer no longer exists in this gym");
  return rows.map((t) => t.id === id ? {
    ...t,
    ...profile,
    previousNames: profile.name !== t.name
      ? [...new Set([...(t.previousNames ?? []), t.name])]
      : t.previousNames,
  } : t);
}

export function trainerCreatedWorkout(trainer: Trainer, creator: string): boolean {
  return creator === trainer.name || (trainer.previousNames ?? []).includes(creator);
}

export function deleteTrainerProfile(rows: Trainer[], id: string): Trainer[] {
  if (!rows.some((t) => t.id === id)) throw new Error("Trainer no longer exists in this gym");
  return rows.filter((t) => t.id !== id);
}