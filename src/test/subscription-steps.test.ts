import { describe, expect, it } from 'vitest';
import { subscriptionEntryStep } from '@/lib/subscription-steps';
describe('saved subscription entry', () => {
  it('new owners start at plan selection, never pending', () => {
    expect(subscriptionEntryStep(null)).toBe('selection');
  });
  it('returning pending owners see their saved status', () => {
    expect(subscriptionEntryStep({status:'Pending'})).toBe('status');
  });
});