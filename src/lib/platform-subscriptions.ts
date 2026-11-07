import { addDays, addMonths, format, parseISO } from 'date-fns';
import { z } from 'zod';
import type { ApprovedGym, RevenueEvent } from './demo';

export const platformPlanSchema = z.object({
  id: z.string().min(1), name: z.string().trim().min(1).max(100),
  billingType: z.enum(['Monthly', 'Annual']),
  price: z.number().finite().positive().max(100000000),
  durationDays: z.number().int().positive().max(36500),
});
export type PlatformPlan = z.infer<typeof platformPlanSchema>;
export const defaultPlatformPlans: PlatformPlan[] = [
  { id: 'platform-monthly', name: 'Monthly Plan', billingType: 'Monthly', price: 800, durationDays: 30 },
  { id: 'platform-annual', name: 'Annual Plan', billingType: 'Annual', price: 7200, durationDays: 365 },
];
export const gymDatesSchema = z.object({start:z.string().date(),end:z.string().date(),notes:z.string().trim().max(4000)}).refine(d=>d.end>=d.start,{message:'Subscription end date must not be before the start date.'});
export function planEndDate(start: string, durationDays: number) {
  z.string().date().parse(start);
  z.number().int().positive().max(36500).parse(durationDays);
  return format(addDays(parseISO(start), durationDays), 'yyyy-MM-dd');
}
export function planDefaults(plan: PlatformPlan, start: string) {
  const row=platformPlanSchema.parse(plan);
  const monthlyPrice=row.billingType==='Monthly'?row.price:row.price/12;
  return {plan:row.name,planId:row.id,billingType:row.billingType,durationDays:row.durationDays,monthlyPrice,annualPrice:row.billingType==='Annual'?row.price:row.price*12,annualPriceManual:row.billingType==='Annual',end:planEndDate(start,row.durationDays)};
}

export const subscriptionPriceSchema = z.object({
  monthlyPrice: z.number().finite().min(0).max(100000000),
  annualPrice: z.number().finite().min(0).max(1200000000),
  annualPriceManual: z.boolean(),
});
export const billingMonths = (plan: string) => ({ Basic: 1, Premium: 3, VIP: 12, 'Monthly Plan': 1, '3 Months Plan': 3, 'Annual Plan': 12 }[plan] ?? 1);
export function gymPrices(gym: Pick<ApprovedGym, 'plan' | 'monthlyPrice' | 'annualPrice' | 'annualPriceManual'>) {
  const months = billingMonths(gym.plan);
  const legacyPrice = ({ Basic: 800, Premium: 2100, VIP: 7200, 'Monthly Plan': 800, '3 Months Plan': 2100, 'Annual Plan': 7200 }[gym.plan] ?? 0) / months;
  const monthlyPrice = gym.monthlyPrice ?? legacyPrice;
  return { monthlyPrice, annualPrice: gym.annualPrice ?? monthlyPrice * 12, annualPriceManual: gym.annualPriceManual ?? false };
}
export function savePrices(input: z.infer<typeof subscriptionPriceSchema>) {
  const prices = subscriptionPriceSchema.parse(input);
  return { ...prices, annualPrice: prices.annualPriceManual ? prices.annualPrice : prices.monthlyPrice * 12 };
}
/** Hypothetical charges on scheduled billing dates, not payment receipts. */
export function projectedSubscriptions(gyms: ApprovedGym[], from: Date, to: Date): RevenueEvent[] {
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) return [];
  const fromDay = format(from, 'yyyy-MM-dd');
  const toDay = format(to, 'yyyy-MM-dd');
  const events: RevenueEvent[] = [];
  for (const gym of gyms) {
    if (gym.status !== 'Active' || gym.deletedAt) continue;
    const start = parseISO(gym.start);
    if (!Number.isFinite(start.getTime()) || gym.end < gym.start) continue;
    const months = gym.billingType ? (gym.billingType === 'Annual' ? 12 : 1) : billingMonths(gym.plan);
    const prices = gymPrices(gym);
    const amount = months === 12 ? prices.annualPrice : prices.monthlyPrice * months;
    if (amount <= 0) continue;
    // Calculate each date from the original anchor so month-end dates don't drift.
    const first = Math.max(0, Math.floor(((from.getFullYear() - start.getFullYear()) * 12 + from.getMonth() - start.getMonth()) / months) - 1);
    for (let cycle = first; ; cycle++) {
      const date = format(addMonths(start, cycle * months), 'yyyy-MM-dd');
      if (date > gym.end || (gym.planId && date === gym.end) || date > toDay) break;
      if (date >= fromDay) events.push({ id: `projection:${gym.id}:${date}`, date, amount, gymName: gym.name });
    }
  }
  return events;
}