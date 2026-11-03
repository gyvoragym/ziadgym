import { format, subDays, startOfMonth } from 'date-fns';
export type GymPeriod = 'today' | 'yesterday' | '7d' | 'month' | 'custom';
export const localDate = (now = new Date()) => format(now, 'yyyy-MM-dd');
export function gymRange(period: GymPeriod, now = new Date(), custom = { from: '', to: '' }) {
  const today = localDate(now);
  if (period === 'custom') return custom;
  if (period === 'yesterday') { const day = localDate(subDays(now, 1)); return { from: day, to: day }; }
  return { from: period === '7d' ? localDate(subDays(now, 6)) : period === 'month' ? localDate(startOfMonth(now)) : today, to: today };
}
export function filterGymPeriod<T extends { date: string }>(rows: T[], range: { from: string; to: string }) {
  if (!range.from || !range.to || range.from > range.to) return [];
  return rows.filter(row => row.date >= range.from && row.date <= range.to);
}