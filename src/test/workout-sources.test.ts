import { describe, it, expect } from 'vitest';
import { hasGymSource, personalGymCopy, workoutSourceId } from '@/lib/workout-sources';
describe('gym workout copies', () => {
  const original = { id: 'plan-1', name: 'Strength', trainer: '', notes: '', exercises: [{ name: 'Squat', sets: 3, reps: '10' }] };
  it('editing or adding personal exercises never changes gym source', () => {
    const copy = personalGymCopy(original, 'gym-1');
    const exercise = copy.exercises[0];
    if (!exercise) throw new Error("Missing exercise");
    exercise.sets = 5;
    copy.exercises.push({ name: 'Press', sets: 2, reps: '8' });
    expect(original.exercises).toEqual([{ name: 'Squat', sets: 3, reps: '10' }]);
    expect(copy.id).not.toBe(original.id);
  });
  it('detects duplicate saves by source, not personal name', () => {
    const copy = personalGymCopy(original, 'gym-1'); copy.name = 'Renamed';
    expect(hasGymSource(copy, 'gym-1', 'plan-1')).toBe(true);
    expect(hasGymSource(copy, 'gym-2', 'plan-1')).toBe(false);
    expect(hasGymSource(copy, 'gym-1', 'plan-2')).toBe(false);
    expect(workoutSourceId(original)).toBe('plan-1');
  });
});