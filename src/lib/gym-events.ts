import { currencyOf } from './store';
import type { State } from './store';
import { generateId } from "./utils";
export type GymEvent = { id: string; type: string; description: string; page: string; createdAt: string };
export function expirationEvents(state: State, today: string): GymEvent[] {
 const end = new Date(`${today}T12:00:00`); end.setDate(end.getDate() + 7);
 const limit = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
 return state.members.filter(m => m.expiry <= limit).map(m => ({ id: `expiry:${m.id}:${m.expiry}:${m.expiry < today ? 'expired' : 'approaching'}`, type: 'Membership expiration', description: `${m.name} · Membership ${m.expiry < today ? 'expired' : 'expires'} on ${m.expiry}`, page: '/members', createdAt: `${today}T12:00:00` }));
}
export function gymEvents(previous: State, next: State, now = new Date().toISOString()): GymEvent[] {
 const events: GymEvent[] = [];
 const add = (type: string, description: string, page: string) => events.push({ id: generateId(), type, description, page, createdAt: now });
 for (const m of next.members) { const old = previous.members.find(x => x.id === m.id); if (!old) add('New member sign-ups', `${m.name} · Membership created (${m.plan}), ${m.start} – ${m.expiry}`, '/members'); else if (old.expiry !== m.expiry || old.start !== m.start || old.plan !== m.plan) add('Membership', `${m.name} · Membership renewed or updated (${m.plan}), expires ${m.expiry}`, '/members'); }
 for (const row of [...next.attendance, ...next.staffAttendance]) if (![...previous.attendance, ...previous.staffAttendance].some(x => x.id === row.id)) add('Attendance', `${row.name} · Check-in on ${row.date} at ${row.time}`, '/attendance');
 for (const row of next.sessions) { const old = previous.sessions.find(x => x.id === row.id); if (!old || JSON.stringify(old) !== JSON.stringify(row)) add('Session', `${row.name} · Session ${old ? 'updated' : 'created'} on ${row.date} (${row.type})`, '/sessions'); }
 for (const row of previous.sessions) if (!next.sessions.some(x => x.id === row.id)) add('Session', `${row.name} · Session cancelled (${row.date})`, '/sessions');
 for (const row of next.transactions) { const old = previous.transactions.find(x => x.id === row.id); if (row.entered && !row.deleted && (!old || JSON.stringify(old) !== JSON.stringify(row))) add(row.amount < 0 ? 'Expense' : 'Payment', `${row.name} · ${old ? 'Updated' : 'Recorded'} ${currencyOf(next.gym)} ${Math.abs(row.amount)} on ${row.date}`, '/finance'); }
 for (const row of next.products) { const old = previous.products.find(x => (x.id ?? x.name) === (row.id ?? row.name)); if (old && row.sales > old.sales) add('Product sale', `${row.name} · ${row.sales - old.sales} units sold · ${currencyOf(next.gym)} ${(row.sales - old.sales) * row.price}`, '/products'); if ((!old && row.qty <= row.min) || (old && old.qty > row.min && row.qty <= row.min)) add('Low stock alert', `${row.name} · Stock is down to ${row.qty} units (minimum ${row.min})`, '/products'); }
 return events;
}