import type { Gym, Member, Plan, Session, Invoice } from './store';

export type MembershipEvent = { id: string; memberId: string; date: string; price: number; kind: 'created' | 'renewed' };
export function gymToday(gym: Partial<Gym>, now = new Date()) {
  const timeZone = gym.preferences?.timeZone ?? 'UTC';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function membershipPrice(member: Pick<Member, 'planPrice' | 'plan'>, plans: Plan[]) {
  return member.planPrice ?? plans.find(p => p.name === member.plan)?.price ?? 0;
}
export const sessionTotal = (sessions: Session[]) => sessions.reduce((sum, row) => sum + row.price, 0);
/** Keep immutable history, but exclude removed memberships from live reports. */
export const reportingEvents = (events: MembershipEvent[], members: Pick<Member, 'id'>[]) => events.filter(e => members.some(m => m.id === e.memberId));
/** Collected session and subscription income; invoices supply paid expenses only. */
export function recordedTotals(sessions: Session[], events: MembershipEvent[], invoices: Invoice[], range: { from: string; to: string }) {
  const inRange = (date: string) => date >= range.from && date <= range.to;
  const sessionRevenue = sessionTotal(sessions.filter(s => inRange(s.date)));
  const subscriptions = [...new Map(events.map(e => [e.id, e])).values()].filter(e => inRange(e.date)).reduce((sum, e) => sum + e.price, 0);
  const paid = invoices.filter(i => i.entered && !i.deleted && i.amount < 0 && inRange(i.date));
  const expenses = paid.reduce((sum, i) => sum - i.amount, 0);
  const income = sessionRevenue + subscriptions;
  return { sessionRevenue, subscriptions, income, revenue: income, expenses, expenseCount: paid.length, net: income - expenses };
}
export function revenueReports(sessions: Session[], events: MembershipEvent[], invoices: Invoice[], date: string) {
  return {
    daily: recordedTotals(sessions, events, invoices, { from: date, to: date }),
    monthly: recordedTotals(sessions, events, invoices, { from: `${date.slice(0, 7)}-01`, to: date }),
    yearly: recordedTotals(sessions, events, invoices, { from: `${date.slice(0, 4)}-01-01`, to: date }),
  };
}
export function dashboardTotals(sessions: Session[], events: MembershipEvent[], invoices: Invoice[], date: string) {
  return recordedTotals(sessions, events, invoices, { from: date, to: date });
}