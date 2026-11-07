import type { Workout } from './store';
import { copyProgram } from './programs';

export function workoutSourceId(workout: Workout): string {
  return workout.id || `legacy:${workout.name}`;
}
export function personalGymCopy(workout: Workout, gymId: string) {
  return { ...copyProgram(workout), sourceGymId: gymId, sourceWorkoutId: workoutSourceId(workout) };
}
export function hasGymSource(definition: unknown, gymId: string, workoutId: string): boolean {
  if (!definition || typeof definition !== 'object') return false;
  const value = definition as Record<string, unknown>;
  return value['sourceGymId'] === gymId && value['sourceWorkoutId'] === workoutId;
}