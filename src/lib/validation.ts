import { z } from 'zod';
export const text = z.string().trim().min(1).max(100);
export const membershipEmailSchema = z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? null : value,
  z.string().trim().email('Enter a valid email or leave it blank.').max(255).nullish().transform(value => value ?? null),
);
export const exerciseSchema = z.object({ name: text, sets: z.number().int().min(1).max(100), reps: z.string().trim().min(1).max(30), image: z.string().max(8000).optional() });
export const programSchema = z.object({ id: z.string().optional(), name: text, trainer: z.string().max(100).default(''), notes: z.string().max(1000).default(''), exercises: z.array(exerciseSchema).min(1) });
export const planSchema = z.object({ id: text, name: text, duration: text, durationMonths: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(), price: z.number().finite().min(0), features: z.array(z.string().trim().min(1).max(100)), featured: z.boolean().optional() });
export const sessionSchema = z.object({ id: text, name: text, trainer: z.string().max(100), price: z.number().finite().min(0), date: z.string().date(), type: text, method: text, memberId: z.string().optional() });
export const recurringSchema = z.object({ id: text, name: text, category: text, frequency: z.enum(['Weekly','Monthly','Yearly','Custom']), next: z.string().date(), start: z.string().date(), amount: z.number().finite().positive() });
export function nextPayment(frequency: string, from = new Date()) {
  const d = new Date(from); const day = d.getDate();
  if (frequency === 'Weekly') d.setDate(day + 7);
  if (frequency === 'Monthly' || frequency === 'Yearly') { d.setDate(1); frequency === 'Monthly' ? d.setMonth(d.getMonth()+1) : d.setFullYear(d.getFullYear()+1); const last = new Date(d.getFullYear(), d.getMonth()+1,0).getDate(); d.setDate(Math.min(day,last)); }
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function invitationStatus(status: string, expires: string, now = Date.now()) { return status === 'Pending' && new Date(expires).getTime() <= now ? 'Expired' : status; }
export function verifiedMethods(amr: Array<{method: string}>, aal?: string) { return aal === 'aal2' || amr.some(x => ['otp','totp','phone'].includes(x.method)); }