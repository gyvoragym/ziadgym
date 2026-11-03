import { prototypeStorage } from './prototype-storage';
import { z } from 'zod';
import { getDemoSessionInfo, getDemoAccounts, getDemoState, useDemoStore, submitDemoGymRequest } from './demo';
import { readPreviewSession } from './preview-session';

export const adminProfileSchema = z.object({ full_name: z.string().trim().min(1).max(100), email: z.string().trim().email().max(255).transform(v => v.toLowerCase()), photo: z.string().max(8000) });
export type AdminProfile = z.infer<typeof adminProfileSchema>;
export type PlatformNotification = { id: string; requestId: string; gymName: string; ownerName: string; plan: string; date: string; status: string; read: boolean };
function adminKey() {
  const s = getDemoSessionInfo();
  if (s?.kind === 'super') return s.email.trim().toLowerCase() || 'anonymous';
  const preview = readPreviewSession();
  if (preview?.type === 'dashboard' && preview.adminToken) return preview.id;
  throw new Error('Administrator access required');
}
export function readAdminProfile(): AdminProfile | null { const key = adminKey(); return JSON.parse(prototypeStorage().getItem(`ironhaus-admin-profile:${key}`) ?? 'null'); }
export function saveAdminProfile(input: AdminProfile) {
  const key = adminKey(); const row = adminProfileSchema.parse(input);
  if (getDemoAccounts().some(a => a.email.toLowerCase() === row.email && a.email.toLowerCase() !== key)) throw new Error('This email is already used by another prototype account.');
  for (let i=0;i<prototypeStorage().length;i++) { const k=prototypeStorage().key(i); if(k?.startsWith('ironhaus-admin-profile:') && k !== `ironhaus-admin-profile:${key}`) { const p=JSON.parse(prototypeStorage().getItem(k) ?? 'null'); if(p?.email===row.email)throw new Error('This email is already used by another prototype account.'); } }
  prototypeStorage().setItem(`ironhaus-admin-profile:${key}`, JSON.stringify(row)); return row;
}
export function demoAdminNotifications(): PlatformNotification[] {
  const key = adminKey(); const read: string[] = JSON.parse(prototypeStorage().getItem(`ironhaus-admin-read:${key}`) ?? '[]');
  return getDemoState().requests.filter(r => r.submittedAt).map(r => ({ id:r.id,requestId:r.id,gymName:r.gymName,ownerName:r.ownerName || 'Name not recorded',plan:r.plan,date:r.submittedAt || r.requestDate,status:r.status,read:read.includes(r.id) }));
}
export function markDemoAdminRead(ids: string[]) { const key=adminKey(); const existing: string[]=JSON.parse(prototypeStorage().getItem(`ironhaus-admin-read:${key}`)??'[]'); const valid=new Set(demoAdminNotifications().map(n=>n.id)); prototypeStorage().setItem(`ironhaus-admin-read:${key}`,JSON.stringify([...new Set([...existing,...ids.filter(id=>valid.has(id))])])); }
export { submitDemoGymRequest, useDemoStore };