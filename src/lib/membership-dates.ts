import { addMonths, format, isValid, parseISO } from 'date-fns';
import { localDate } from './gym-period';

export function positiveMonths(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
export const monthLabel = (months: number) => `${months} ${months === 1 ? 'month' : 'months'}`;

export function planMonths(plan?: { duration: string; durationMonths?: number }): number | undefined {
  if (!plan) return undefined;
  if (positiveMonths(plan.durationMonths)) return plan.durationMonths;
  const match = /^(\d+)\s*months?$/i.exec(plan.duration.trim());
  const months = match ? Number(match[1]) : undefined;
  return positiveMonths(months) ? months : undefined;
}

export function membershipEnd(start: string, months: number): string {
  if (!positiveMonths(months)) throw new Error('Duration must be a positive whole number of months.');
  const date = parseISO(start);
  if (!isValid(date)) return '';
  const end = addMonths(date, months);
  if (!isValid(end)) throw new Error('This duration exceeds the supported calendar range.');
  return format(end, 'yyyy-MM-dd');
}

export function initialMembershipDates(existing: { start: string; expiry: string } | undefined, renew: boolean, months?: number, today = localDate()) {
  if (existing && !renew) return { start: existing.start, expiry: existing.expiry };
  return { start: today, expiry: months ? membershipEnd(today, months) : '' };
}