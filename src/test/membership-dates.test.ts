import { describe, expect, it } from 'vitest';
import { initialMembershipDates, membershipEnd, planMonths, positiveMonths } from '@/lib/membership-dates';
import { planSchema } from '@/lib/validation';

describe('gym plan months and client dates', () => {
  const plan = { id:'fictional-months', name:'Fictional plan', duration:'3 months', durationMonths:3, price:350, features:[] };
  it('persists numeric month duration alongside existing plan fields', () => {
    expect(planSchema.parse(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
  });
  it('accepts positive whole months only', () => {
    for (const n of [0,-1,1.5,NaN,Infinity]) {
      expect(positiveMonths(n)).toBe(false);
      expect(planSchema.safeParse({...plan,durationMonths:n}).success).toBe(false);
    }
    expect(planSchema.parse({...plan,durationMonths:1}).durationMonths).toBe(1);
  });
  it('starts an added membership today and ends three calendar months later', () => {
    expect(initialMembershipDates(undefined,false,3,'2026-10-24')).toEqual({start:'2026-10-24',expiry:'2027-01-24'});
  });
  it('preserves ordinary-edit dates independently of the catalog duration', () => {
    expect(initialMembershipDates({start:'2026-01-12',expiry:'2026-03-19'},false,3,'2026-10-24')).toEqual({start:'2026-01-12',expiry:'2026-03-19'});
  });
  it('renewal resets dates to today and selected duration', () => {
    expect(initialMembershipDates({start:'2026-01-12',expiry:'2026-03-19'},true,1,'2026-10-24')).toEqual({start:'2026-10-24',expiry:'2026-11-24'});
  });
  it('recalculates from changed plan and changed start', () => {
    expect(membershipEnd('2026-10-24',1)).toBe('2026-11-24');
    expect(membershipEnd('2026-11-15',3)).toBe('2027-02-15');
  });
  it('clamps month end rather than rolling into the following month', () => {
    expect(membershipEnd('2026-01-31',1)).toBe('2026-02-28');
    expect(membershipEnd('2026-08-31',1)).toBe('2026-09-30');
  });
  it('handles leap years consistently', () => {
    expect(membershipEnd('2028-01-31',1)).toBe('2028-02-29');
    expect(membershipEnd('2028-02-29',12)).toBe('2029-02-28');
  });
  it('supports existing month labels without guessing unknown legacy durations', () => {
    expect(planMonths({duration:'12 months'})).toBe(12);
    expect(planMonths({duration:'30 days'})).toBeUndefined();
  });
});