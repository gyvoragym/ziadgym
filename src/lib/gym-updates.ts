import { z } from "zod";
import {
  format,
  startOfWeek,
  startOfMonth,
  startOfYear,
  endOfWeek,
  endOfMonth,
  endOfYear,
} from "date-fns";
import type { Invoice, Plan, Member, TrainerDay, Workout, RecurringExpense } from "./store";
import { nextPayment } from "./validation";
import { generateId } from "./utils";

export const weekDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export const defaultSchedule = (): TrainerDay[] =>
  weekDays.map((day) => ({ day, available: day !== "Friday", start: "17:00", end: "22:00" }));
export const scheduleSchema = z
  .array(
    z
      .object({
        day: z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]),
        available: z.boolean(),
        start: z.string(),
        end: z.string(),
      })
      .refine(
        (d) =>
          !d.available ||
          (/^([01]\d|2[0-3]):[0-5]\d$/.test(d.start) &&
            /^([01]\d|2[0-3]):[0-5]\d$/.test(d.end) &&
            d.end > d.start),
        "End time must be later than start time",
      ),
  )
  .length(7)
  .refine((rows) => new Set(rows.map((r) => r.day)).size === 7, "Include each weekday once");
export const invoiceSchema = z.object({
  id: z.string(),
  number: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(100),
  description: z.string().max(500),
  date: z.string().date(),
  amount: z
    .number()
    .finite()
    .refine((n) => n !== 0, "Amount must be greater than zero"),
  method: z.string().min(1),
  type: z.string().min(1),
  attachment: z.string().max(2000000).optional(),
  deleted: z.boolean().optional(),
  entered: z.boolean().optional(),
});
export function deletePlan(plans: Plan[], members: Member[], id: string) {
  const plan = plans.find((p) => p.id === id);
  if (!plan) throw new Error("Plan not found");
  if (members.some((m) => m.plan === plan.name))
    throw new Error(
      "This plan is assigned to members. Move their memberships to another plan before deleting it.",
    );
  return plans.filter((p) => p.id !== id);
}
export function deleteProgram(programs: Workout[], selected: Workout) {
  return programs.filter((p) => (selected.id ? p.id !== selected.id : p !== selected));
}
export function nextInvoiceNumber(rows: Invoice[]) {
  return Math.max(0, ...rows.map((r) => r.number ?? 0)) + 1;
}
export function createInvoice(rows: Invoice[], draft: Invoice) {
  const row = invoiceSchema.parse({
    ...draft,
    number: nextInvoiceNumber(rows),
    entered: true,
    deleted: false,
  });
  return [...rows, row];
}
export function deleteInvoice(rows: Invoice[], id: string) {
  return rows.map((r) => (r.id === id ? { ...r, deleted: true } : r));
}
export type ReportPeriod = "today" | "week" | "month" | "year" | "custom";
export function reportRange(period: ReportPeriod, now = new Date(), custom = { from: "", to: "" }) {
  if (period === "custom") return custom;
  const f =
    period === "week"
      ? startOfWeek(now, { weekStartsOn: 1 })
      : period === "month"
        ? startOfMonth(now)
        : period === "year"
          ? startOfYear(now)
          : now;
  const t =
    period === "week"
      ? endOfWeek(now, { weekStartsOn: 1 })
      : period === "month"
        ? endOfMonth(now)
        : period === "year"
          ? endOfYear(now)
          : now;
  return { from: format(f, "yyyy-MM-dd"), to: format(t, "yyyy-MM-dd") };
}
export function reportInvoices(rows: Invoice[], range: { from: string; to: string }) {
  return rows.filter(
    (r) => r.entered && !r.deleted && r.amount < 0 && r.date >= range.from && r.date <= range.to,
  );
}
/** Record a recurring invoice's current occurrence as a paid expense and advance its next payment. */
export function markRecurringPaid(
  recurring: RecurringExpense[],
  transactions: Invoice[],
  id: string,
  payDate: string,
) {
  const row = recurring.find((r) => r.id === id);
  if (!row) throw new Error("Recurring invoice not found");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payDate)) throw new Error("Enter a valid payment date");
  const occurrence = row.next;
  if (row.lastPaidOccurrence === occurrence)
    throw new Error("This scheduled payment was already recorded as paid");
  const transactionsNext = createInvoice(transactions, {
    id: generateId(),
    name: row.name,
    category: row.category,
    description: `Recurring payment (${row.frequency}) due ${occurrence}`,
    date: payDate,
    amount: -row.amount,
    method: "Cash",
    type: "Expense",
  });
  const recurringNext = recurring.map((r) =>
    r.id === id
      ? {
          ...r,
          lastPaidOccurrence: occurrence,
          next:
            r.frequency === "Custom"
              ? r.next
              : nextPayment(r.frequency, new Date(`${occurrence}T12:00:00`)),
        }
      : r,
  );
  return { recurring: recurringNext, transactions: transactionsNext };
}
/** Income, paid expenses and net profit for one shared period. Only recorded invoices count. */
export function cashSummary(rows: Invoice[], range: { from: string; to: string }) {
  const inRange = rows.filter(
    (r) => !r.deleted && r.date >= range.from && r.date <= range.to,
  );
  const income = inRange.filter((r) => r.amount > 0).reduce((a, r) => a + r.amount, 0);
  const expenses = inRange.filter((r) => r.amount < 0).reduce((a, r) => a - r.amount, 0);
  return { income, expenses, net: income - expenses };
}
/** Count and total of entered expense invoices on a single date. */
export function dailySummary(rows: Invoice[], date: string) {
  const day = rows.filter(
    (r) => r.entered && !r.deleted && r.amount < 0 && r.date === date,
  );
  return { count: day.length, total: day.reduce((a, r) => a - r.amount, 0) };
}
export function groupInvoices(rows: Invoice[], group: "daily" | "weekly" | "monthly" | "yearly") {
  const groups = new Map<string, number>();
  for (const r of rows) {
    const date = new Date(r.date + "T12:00:00");
    const key =
      group === "weekly"
        ? format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd")
        : group === "monthly"
          ? r.date.slice(0, 7)
          : group === "yearly"
            ? r.date.slice(0, 4)
            : r.date;
    groups.set(key, (groups.get(key) ?? 0) + Math.abs(r.amount));
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b));
}
