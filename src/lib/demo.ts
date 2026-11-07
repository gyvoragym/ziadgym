import { readPreviewSession } from './preview-session';
import { savePreviewClientProgram } from './preview-client-programs';
import { PROTOTYPE_STORAGE_PREFIX, prototypeStorage } from './prototype-storage';
import { useSyncExternalStore } from "react";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { invitationStatus } from "./validation";
import { initialState, defaultGymHours, type State, type StaffMember, type Workout } from "./store";
import { gymEvents } from './gym-events';
import { appendGymEvents } from './gym-notifications-demo';
import { billingMonths, gymPrices, savePrices, platformPlanSchema, defaultPlatformPlans, gymDatesSchema, planDefaults, type PlatformPlan, type subscriptionPriceSchema } from './platform-subscriptions';
import { generateId } from "./utils";
import { demoIdentity, demoIdentityMatches, ensureDemoIdentity } from './demo-identities';
import { accountQrLookupId } from './account-qr-payload';
import { validateMembershipChanges } from './membership-link';
import { gymToday } from './gym-reporting';
import { readSampleRequests } from './prototype-scenario';
import { deletePrototypeAccount, listPrototypeAccounts, updatePrototypeAccount } from './prototype-accounts';

/**
 * Prototype-only demo layer. Completely isolated from production auth and the
 * Cloud backend: demo sessions and demo data live in localStorage only and
 * never touch Supabase. No real payments, emails, or SMS are involved.
 */

export type DemoSessionKind = "super" | "owner" | "individual";
export type DemoSession = DemoSessionKind | null;

const SESSION_KEY = "ironhaus-demo-session";

export type DemoSessionInfo = {
  kind: DemoSessionKind;
  email: string;
  name?: string;
  directAccess?: boolean;
};

export function getDemoSessionInfo(): DemoSessionInfo | null {
  const prototype = readPreviewSession();
  if (prototype) return { kind: prototype.type === 'dashboard' ? 'super' : prototype.type === 'gym' ? 'owner' : 'individual', email: prototype.scenarioKey ?? 'reviewer@example.test', name: prototype.name, directAccess: true };
  try {
    const v = prototypeStorage().getItem(SESSION_KEY);
    if (!v) return null;
    if (v === "super" || v === "owner") return { kind: v, email: "" }; // legacy hardcoded demo accounts
    const o = JSON.parse(v) as DemoSessionInfo;
    return o && (o.kind === "super" || o.kind === "owner" || o.kind === "individual") ? o : null;
  } catch {
    return null;
  }
}

export function getDemoSession(): DemoSession {
  return getDemoSessionInfo()?.kind ?? null;
}

export function setDemoSession(
  s: DemoSession,
  email = "",
  details: Pick<DemoSessionInfo, "name" | "directAccess"> = {},
) {
  try {
    if (s) {
      email = email.trim().toLowerCase();
      prototypeStorage().setItem(SESSION_KEY, JSON.stringify({ kind: s, email, ...details }));
      if(s==='individual') rememberDemoClient(demoUserId(email), details.name || 'Demo Member', email, getDemoAccounts().find(a=>a.email===email)?.phone || '');
    }
    else prototypeStorage().removeItem(SESSION_KEY);
  } catch {
    /* private mode */
  }
}

export const DEMO_ACCOUNTS = [
  {
    session: "super" as const,
    name: "zeyad salama",
    identifier: "zeyadsalama",
    password: "zeyadsalama",
  },
  {
    session: "owner" as const,
    name: "zeyad salama1",
    identifier: "gym email",
    password: "zeyad salama1",
  },
];

/** Returns the demo session for exact demo credentials, else null. */
export function matchDemoAccount(name: string, identifier: string, password: string): DemoSession {
  const n = name.trim().toLowerCase();
  const i = identifier.trim().toLowerCase();
  const hit = DEMO_ACCOUNTS.find(
    (a) => a.name === n && a.identifier === i && a.password === password,
  );
  return hit ? hit.session : null;
}

/* ---------------- Demo account registry (prototype sign-up) ---------------- */

export type DemoAccountType = "gym" | "individual" | "dashboard";

export type DemoAccount = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  type: DemoAccountType;
  /** Gym Account chose Skip — demo access to the owner dashboard. */
  skipped: boolean;
  /** Gym Account submitted a subscription request. */
  requestPending: boolean;
  deletedAt?: string;
  trialStartedAt?: string;
};

const ACCOUNTS_KEY = "ironhaus-demo-accounts-v1";

export function getDemoAccounts(): DemoAccount[] {
  try {
    const raw = prototypeStorage().getItem(ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw) as DemoAccount[];
  } catch {
    /* corrupted storage -> empty */
  }
  return [];
}

function saveAccounts(list: DemoAccount[]) {
  try {
    prototypeStorage().setItem(ACCOUNTS_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}

/** Creates a demo account; returns the existing one when email+password match. */
export function registerDemoAccount(
  name: string,
  email: string,
  password: string,
  type: DemoAccountType,
  phone = '',
): DemoAccount {
  const e = email.trim().toLowerCase();
  const list = getDemoAccounts();
  const existing = list.find((a) => a.email === e);
  if (existing) {
    if (existing.password !== password)
      throw new Error("An account with this email already exists. Sign in instead.");
    return existing;
  }
  const acc: DemoAccount = {
    name: name.trim(),
    email: e,
    password,
    type,
    phone,
    skipped: false,
    requestPending: false,
  };
  saveAccounts([...list, acc]);
  return acc;
}

export function updateDemoAccount(
  email: string,
  patch: Partial<Pick<DemoAccount, "skipped" | "requestPending" | "deletedAt" | "trialStartedAt" | "password">>,
) {
  saveAccounts(getDemoAccounts().map((a) => (a.email === email ? { ...a, ...patch } : a)));
}

/** Finds a registered demo account by email + password. */
export function findDemoAccount(identifier: string, password: string): DemoAccount | null {
  const i = identifier.trim().toLowerCase();
  return getDemoAccounts().find((a) => a.email === i && a.password === password) ?? null;
}

/** The account behind the current demo session, or null for legacy hardcoded sessions. */
export function getDemoAccount(): DemoAccount | null {
  const info = getDemoSessionInfo();
  if (!info || !info.email || info.directAccess) return null;
  return getDemoAccounts().find((a) => a.email === info.email) ?? null;
}

export function sessionKindFor(type: DemoAccountType): DemoSessionKind {
  return type === "dashboard" ? "super" : type === "gym" ? "owner" : "individual";
}

/** Where a registered demo account lands after sign-in. */
export function demoDestination(
  acc: Pick<DemoAccount, "type" | "skipped"> & { email?: string },
): "/super-admin" | "/member" | "/dashboard" | "/subscription-request" {
  if (acc.type === "dashboard") return "/super-admin";
  if (acc.type === "individual") return "/member";
  if (acc.email && getDemoAccounts().find(a=>a.email===acc.email)?.deletedAt) return '/subscription-request';
  const status = "email" in acc ? demoRequestStatus(String(acc.email)) : null;
  if (status === "Rejected") return "/subscription-request";
  return acc.skipped || status === "Approved" ? "/dashboard" : "/subscription-request";
}

/* ---------------- Demo platform data (Super Admin) ---------------- */

export type GymRequest = {
  id: string;
  ownerName?: string;
  submittedAt?: string;
  gymName: string;
  phone: string;
  email: string;
  plan: string;
  planId?: string;
  billingType?: 'Monthly' | 'Annual';
  durationDays?: number;
  price?: number;
  requestDate: string;
  status: "Pending" | "Approved" | "Rejected";
  decisionNote?: string;
  decidedAt?: string;
};

export type ApprovedGym = {
  id: string;
  name: string;
  phone: string;
  email: string;
  plan: string;
  start: string;
  end: string;
  status: "Active" | "Frozen";
  monthlyPrice?: number;
  annualPrice?: number;
  annualPriceManual?: boolean;
  planId?: string | undefined;
  billingType?: 'Monthly' | 'Annual' | undefined;
  durationDays?: number | undefined;
  notes?: string;
  freezeNote?: string;
  deletedAt?: string | undefined;
  deletionNote?: string;
  deletionHistory?: {action:'deleted'|'restored';at:string;note:string}[];
};

export type DemoClient = { id: string; name: string; phone: string; photo: string; gyms: string[] };

export type RevenueEvent = { id: string; date: string; amount: number; gymName: string };
export type DemoInvitation = Database["public"]["Tables"]["staff_invitations"]["Row"] & {
  gym_name?: string;
};
export const expenseSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(100),
  amount: z.number().finite().positive(),
  date: z.string().date(),
  method: z.string().max(100),
  notes: z.string().max(2000),
  receipt: z.string().max(3000000).optional(),
  receiptName: z.string().max(255).optional(),
});
export type PlatformExpense = z.infer<typeof expenseSchema>;

export type DemoState = {
  platformPlans?: PlatformPlan[];
  platformPlansConfigured?: boolean;
  platformBranding?: { name: string; logo: string };
  platformWhatsapp?: string;
  requests: GymRequest[];
  gyms: ApprovedGym[];
  clients: DemoClient[];
  revenue: RevenueEvent[];
  expenses: PlatformExpense[];
  invitations: DemoInvitation[];
  sessionClients: Record<string, string>;
  staffRoles: DemoStaffRole[];
  programs: DemoProgram[];
  assignments: DemoAssignment[];
  adminMessages?: DemoAdminMessage[];
  clientFreeze?: Record<string, { note: string; at: string }>;
  clientDeletion?: Record<string, { note: string; at: string }>;
};
export type DemoAssignment = {
  id: string;
  requestKey: string;
  gymId: string;
  gymName: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  memberId: string;
  sentAt: string;
  program: Workout;
  status: "Pending" | "Saved" | "Deleted";
};
export type DemoStaffRole = StaffMember & {
  id: string;
  userId: string;
  gymId: string;
  gymName: string;
};
export type DemoProgram = {
  id: string;
  user_id: string;
  definition: Workout;
  completion: number[];
  created_at: string;
};
export const demoUserId = (email: string) =>
  email.trim().toLowerCase().startsWith('preview-')
    ? email.trim().toLowerCase()
    : `demo-user-${email.trim().toLowerCase() || "anonymous"}`;
/** Canonical ID is reserved centrally; legacy QR keys remain aliases only. */
export function demoMemberId(userId: string): string {
  return demoIdentity('C',userId) ?? '';
}
type LocalClient = {id:string;full_name:string;email:string;phone:string;photo?:string};
function localClients(): LocalClient[] {
  return JSON.parse(prototypeStorage().getItem('gyvora-demo-client-directory') ?? '[]') as LocalClient[];
}
export function rememberDemoClient(id:string,name:string,email:string,phone:string,photo='') {
  const rows=localClients();
  const previous=rows.find(r=>r.id===id);
  const row={id,full_name:name || previous?.full_name || 'Demo Member',email,phone:phone || previous?.phone || '',photo:photo || previous?.photo || ''};
  prototypeStorage().setItem('gyvora-demo-client-directory',JSON.stringify([...rows.filter(r=>r.id!==id),row]));
  ensureDemoIdentity('C',id);
}
export function prepareDemoIdentities() {
  for(const gym of [{id:'demo-gym'},{id:'demo-gym-north'},...getDemoState().gyms]) ensureDemoIdentity('G',gym.id);
  for(const client of getDemoState().clients) rememberDemoClient(client.id,client.name,'',client.phone);
  for(const account of getDemoAccounts()) if(account.type==='individual') rememberDemoClient(demoUserId(account.email),account.name,account.email,account.phone || '');
  const legacy=JSON.parse(prototypeStorage().getItem('ironhaus-demo-member-identities') ?? '{}') as Record<string,string>;
  for(const userId of Object.keys(legacy)) ensureDemoIdentity('C',userId);
  const gymIds=new Set(['demo-gym','demo-gym-north',...getDemoState().gyms.map(g=>g.id)]);
  for(let i=0;i<prototypeStorage().length;i++) { const key=prototypeStorage().key(i); if(key?.startsWith('ironhaus-demo-gym:'))gymIds.add(key.slice('ironhaus-demo-gym:'.length)); }
  for(const gymId of gymIds) {
    ensureDemoIdentity('G',gymId);
    for(const member of readDemoGym(gymId,gymId==='demo-gym').members) rememberDemoClient(member.clientId ?? demoUserId(member.email),member.name,member.email,member.phone);
  }
}
export function lookupDemoClient(gymId:string,value:string) {
  if(getDemoSession()!=='owner'||!(['demo-gym','demo-gym-north'].includes(gymId)||gymId.startsWith('prototype-gym-'))) throw new Error('Only the local gym owner can look up demo clients');
  const account=getDemoAccount();
  if(account&&!demoOwnerHasAccess(account))throw new Error('Gym access unavailable');
  const input=accountQrLookupId(value).toLowerCase();
  const legacy=JSON.parse(prototypeStorage().getItem('ironhaus-demo-member-identities') ?? '{}') as Record<string,string>;
  const digits=input.replace(/\D/g,'');
  const registered=readPreviewSession()?listPrototypeAccounts().filter(a=>a.type==='individual').map(a=>({id:a.id,full_name:a.name,email:a.email,phone:a.phone,photo:a.photo})): [];
  const clients=[...localClients(),...registered.filter(a=>!localClients().some(c=>c.id===a.id))];
  const matches=clients.filter(p=>p.id.toLowerCase()===input||demoIdentityMatches('C',p.id,input)||legacy[p.id]?.toLowerCase()===input||(p.email&&p.email.toLowerCase()===input)||p.full_name.toLowerCase()===input||(digits.length>=6&&p.phone.replace(/\D/g,'')===digits));
  if(matches.length>1)throw new Error('More than one account has this name. Use the intended GYVORA ID or email.');
  const p=matches[0];
  if(!p)throw new Error('No existing Local demo client found on this browser. Saved accounts require your signed-in gym owner session.');
  // Prototype identities stay browser-local; a reserved permanent ID is optional display data.
  const id=demoMemberId(p.id);
  return {...p,gyvora_id:id};
}
export type DemoMembershipHistory = {
  userId: string;
  gymId: string;
  gym: string;
  definition: State["members"][number];
};
export function readDemoMembershipHistory(userId: string): DemoMembershipHistory[] {
  try {
    return (
      JSON.parse(
        prototypeStorage().getItem("ironhaus-demo-membership-history") ?? "[]",
      ) as DemoMembershipHistory[]
    ).filter((r) => r.userId === userId);
  } catch {
    return [];
  }
}
export function rememberDemoMemberships(gymId: string, gym: string, members: State["members"]) {
  let rows: DemoMembershipHistory[] = [];
  try {
    rows = JSON.parse(prototypeStorage().getItem("ironhaus-demo-membership-history") ?? "[]");
  } catch {
    /* empty */
  }
  for (const m of members) {
    const userId = m.clientId ?? demoUserId(m.email);
    if (
      !rows.some(
        (r) =>
          r.userId === userId &&
          r.gymId === gymId &&
          r.definition.id === m.id &&
          r.definition.plan === m.plan &&
          r.definition.start === m.start &&
          r.definition.expiry === m.expiry,
      )
    ) {
      rows.push({ userId, gymId, gym, definition: structuredClone(m) });
    }
  }
  prototypeStorage().setItem("ironhaus-demo-membership-history", JSON.stringify(rows));
}

export const PLAN_PRICES: Record<string, number> = { Basic: 800, Premium: 2100, VIP: 7200 };
export const PLAN_MONTHS: Record<string, number> = { Basic: 1, Premium: 3, VIP: 12 };
export const DEFAULT_PLATFORM_WHATSAPP = '+201094536260';

export function isSeededDashboardRecord(id: string) {
  return /^(?:req-[1-3]|gym-[1-4]|cli-[1-6])$/.test(id);
}

const seed: DemoState = {
  expenses: [],
  invitations: [],
  sessionClients: {},
  staffRoles: [],
  programs: [],
  assignments: [],
  requests: [
    {
      id: "req-1",
      gymName: "Titan Strength Club",
      phone: "+20 100 222 8871",
      email: "owner@titanstrength.com",
      plan: "Premium",
      requestDate: "2026-10-14",
      status: "Pending",
    },
    {
      id: "req-2",
      gymName: "Pulse Fitness Studio",
      phone: "+20 111 905 4432",
      email: "hello@pulsefit.com",
      plan: "Basic",
      requestDate: "2026-10-16",
      status: "Pending",
    },
    {
      id: "req-3",
      gymName: "Atlas Performance Lab",
      phone: "+20 122 480 1190",
      email: "info@atlasperf.com",
      plan: "VIP",
      requestDate: "2026-10-17",
      status: "Pending",
    },
  ],
  gyms: [
    {
      id: "gym-1",
      name: "IRONHAUS Performance Club",
      phone: "+20 100 555 0192",
      email: "owner@ironhaus.gym",
      plan: "VIP",
      start: "2026-01-01",
      end: "2026-12-31",
      status: "Active",
    },
    {
      id: "gym-2",
      name: "IRONHAUS North",
      phone: "+20 100 555 7741",
      email: "north@ironhaus.gym",
      plan: "Premium",
      start: "2026-06-01",
      end: "2026-08-31",
      status: "Active",
    },
    {
      id: "gym-3",
      name: "IronWorks Downtown",
      phone: "+20 101 730 2284",
      email: "contact@ironworks.fit",
      plan: "Basic",
      start: "2026-09-15",
      end: "2026-10-15",
      status: "Frozen",
    },
    {
      id: "gym-4",
      name: "Vertex Athletic Club",
      phone: "+20 112 664 9023",
      email: "team@vertexclub.com",
      plan: "Premium",
      start: "2026-03-10",
      end: "2026-06-10",
      status: "Active",
    },
  ],
  clients: [
    {
      id: "cli-1",
      name: "Omar Khaled",
      phone: "+20 103 400 1337",
      photo: "",
      gyms: ["IRONHAUS Performance Club"],
    },
    {
      id: "cli-2",
      name: "Layla Hassan",
      phone: "+20 100 414 1674",
      photo: "",
      gyms: ["IRONHAUS Performance Club", "Vertex Athletic Club"],
    },
    {
      id: "cli-3",
      name: "Youssef Adel",
      phone: "+20 101 428 2011",
      photo: "",
      gyms: ["IRONHAUS North"],
    },
    {
      id: "cli-4",
      name: "Mariam Fathy",
      phone: "+20 102 442 2348",
      photo: "",
      gyms: ["IRONHAUS Performance Club", "IRONHAUS North"],
    },
    {
      id: "cli-5",
      name: "Karim Nabil",
      phone: "+20 103 456 2685",
      photo: "",
      gyms: ["Vertex Athletic Club"],
    },
    {
      id: "cli-6",
      name: "Salma Tarek",
      phone: "+20 106 484 3359",
      photo: "",
      gyms: ["IRONHAUS Performance Club"],
    },
  ],
  revenue: [
    { id: "rev-1", date: "2026-01-01", amount: 7200, gymName: "IRONHAUS Performance Club" },
    { id: "rev-2", date: "2026-03-10", amount: 2100, gymName: "Vertex Athletic Club" },
    { id: "rev-3", date: "2026-06-01", amount: 2100, gymName: "IRONHAUS North" },
    { id: "rev-4", date: "2026-09-15", amount: 800, gymName: "IronWorks Downtown" },
    { id: "rev-5", date: "2026-10-02", amount: 2100, gymName: "Vertex Athletic Club" },
    { id: "rev-6", date: "2026-10-11", amount: 800, gymName: "IRONHAUS North" },
  ],
};

const DATA_KEY = "ironhaus-demo-data-v1";
const listeners = new Set<() => void>();

function load(): DemoState {
  try {
    const raw = prototypeStorage().getItem(DATA_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<DemoState>;
      const state = { ...structuredClone(seed), ...saved } as DemoState;
      if (!state.platformPlansConfigured && !state.platformPlans?.length) {
        state.platformPlans = structuredClone(defaultPlatformPlans);
      }
      return state;
    }
  } catch {
    /* corrupted or unavailable storage -> reseed */
  }
  return { ...structuredClone(seed), platformPlans: structuredClone(defaultPlatformPlans) };
}

let demoState: DemoState = load();
export function resetPrototypeData() {
  demoState = load();
  if (readPreviewSession()) {
    const samples = readSampleRequests();
    const rows = Object.entries(samples).map(([scope, sample]) => {
      const id = `prototype-${scope}`;
      const saved = demoState.requests.find(r => r.id === id);
      const ownerName = listPrototypeAccounts().find(account => account.id === `preview-gym-${scope}`)?.name ?? 'Prototype account';
      return {...sample, id, ownerName, email:scope, phone:sample.phone ?? '', submittedAt:sample.requestDate, ...(saved ? {gymName:saved.gymName, plan:saved.plan, status:saved.status, decisionNote:saved.decisionNote, decidedAt:saved.decidedAt} : {})};
    });
    demoState.requests = [...rows, ...demoState.requests.filter(r => !r.id.startsWith('prototype-'))];
    demoState.gyms = demoState.gyms.map(g => { const s = samples[g.email]; return s?.phone ? {...g, phone: s.phone} : g; });
    prototypeStorage().setItem(DATA_KEY, JSON.stringify(demoState));
  }
  listeners.forEach(l => l());
}

function commit(next: DemoState) {
  demoState = next;
  try {
    prototypeStorage().setItem(DATA_KEY, JSON.stringify(next));
  } catch {
    /* storage full/unavailable: keep in-memory */
  }
  listeners.forEach((l) => l());
}

export function useDemoStore<T>(sel: (s: DemoState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      const sync = (e: StorageEvent) => {
        const key = e.key?.startsWith(PROTOTYPE_STORAGE_PREFIX)
          ? e.key.slice(PROTOTYPE_STORAGE_PREFIX.length)
          : e.key;
        if (e.key === null || key === DATA_KEY || key === ACCOUNTS_KEY) {
          demoState = load();
          listeners.forEach(fn => fn());
        }
      };
      window.addEventListener('storage',sync);
      return () => {listeners.delete(l);window.removeEventListener('storage',sync);};
    },
    () => sel(demoState),
    () => sel(demoState),
  );
}

export function getDemoState() {
  return demoState;
}

export function savePlatformBranding(input: { name: string; logo: string }) {
  if (getDemoSession() !== 'super') throw new Error('Administrator prototype access required');
  const row = z.object({ name: z.string().trim().min(1).max(100), logo: z.string().max(8000) }).parse(input);
  commit({ ...demoState, platformBranding: row });
}

/** Latest submitted request status for a demo account (Skip never changes it). */
export function demoRequestStatus(email: string): GymRequest["status"] | null {
  return demoState.requests.find(r => r.email === email && r.submittedAt)?.status ?? null;
}
/** Owner may enter the dashboard after Skip (demo access) or Super Admin approval. */
export function demoOwnerHasAccess(acc: Pick<DemoAccount, "email" | "skipped">) {
  if (getDemoAccounts().find(a=>a.email===acc.email)?.deletedAt) return false;
  if (demoState.gyms.some(g=>g.email===acc.email && g.deletedAt)) return false;
  if (demoState.gyms.some(g=>g.email===acc.email && g.status==='Frozen')) return false;
  const status = demoRequestStatus(acc.email);
  if (status === "Rejected") return false;
  const gym = demoState.gyms.find(g => g.email === acc.email);
  if (status === "Approved" && gym?.end && gym.end <= new Date().toISOString().slice(0, 10)) return false;
  const saved=getDemoAccounts().find(a=>a.email===acc.email);
  if(status==='Pending'&&saved?.trialStartedAt)return Date.now()<new Date(saved.trialStartedAt).getTime()+60*60*1000;
  return acc.skipped || status === "Approved";
}
export function savePlatformWhatsapp(input: string) {
  if (getDemoSession() !== 'super') throw new Error('Administrator prototype access required');
  const v = input.trim();
  if (v && !/^\+?[0-9 ()-]{6,20}$/.test(v)) throw new Error('Enter a WhatsApp number with country code, digits only.');
  commit({ ...demoState, platformWhatsapp: v });
}
export function whatsappLink(number: string, text: string) {
  let digits = number.replace(/\D/g, '');
  if (/^0\d{10}$/.test(digits)) digits = `20${digits.slice(1)}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function savePlatformPlan(input: PlatformPlan) {
  if (getDemoSession() !== 'super') throw new Error('Administrator prototype access required');
  const row=platformPlanSchema.parse(input);
  const plans=demoState.platformPlans??defaultPlatformPlans;
  commit({...demoState,platformPlansConfigured:true,platformPlans:plans.some(p=>p.id===row.id)?plans.map(p=>p.id===row.id?row:p):[...plans,row]});
}
export function deletePlatformPlan(id: string) {
  if (getDemoSession() !== 'super') throw new Error('Administrator prototype access required');
  const plans=demoState.platformPlans??defaultPlatformPlans;
  const plan=plans.find(p=>p.id===id);
  if (!plan) throw new Error('Plan no longer exists');
  if (demoState.gyms.some(g=>g.planId===id||(!g.planId&&g.plan===plan.name))) throw new Error('This plan is assigned to a gym. Change its subscription before deleting the plan.');
  commit({...demoState,platformPlansConfigured:true,platformPlans:plans.filter(p=>p.id!==id)});
}

export function submitDemoGymRequest(gymName: string, plan: string) {
  const s = getDemoSessionInfo();
  if (s?.kind !== 'owner') throw new Error('Gym owner account required');
  if (getDemoAccount()?.deletedAt) throw new Error('Gym account deleted');
  const name = z.string().trim().min(1).max(100).parse(gymName);
  const selectedPlan = (demoState.platformPlans ?? defaultPlatformPlans).find(candidate => candidate.id === plan || candidate.name === plan);
  if (!selectedPlan) throw new Error('Select an available subscription plan.');
  const existing = demoState.requests.find(r => r.email === s.email && r.status === 'Pending' && r.submittedAt);
  if (existing) return existing;
  const now = new Date().toISOString();
  const row: GymRequest = {id:generateId(),gymName:name,ownerName:s.name || getDemoAccount()?.name || 'Name not recorded',email:s.email,phone:getDemoAccount()?.phone ?? '',plan:selectedPlan.name,planId:selectedPlan.id,billingType:selectedPlan.billingType,durationDays:selectedPlan.durationDays,price:selectedPlan.price,requestDate:now.slice(0,10),submittedAt:now,status:'Pending'};
  commit({...demoState,requests:[row,...demoState.requests]});
  return row;
}

export function selectSessionClient(gymId: string, memberId: string) {
  commit({ ...demoState, sessionClients: { ...demoState.sessionClients, [gymId]: memberId } });
}

export function savePlatformExpense(expense: PlatformExpense) {
  const row = expenseSchema.parse(expense);
  commit({
    ...demoState,
    expenses: demoState.expenses.some((e) => e.id === row.id)
      ? demoState.expenses.map((e) => (e.id === row.id ? row : e))
      : [row, ...demoState.expenses],
  });
}
export function deletePlatformExpense(id: string) {
  commit({ ...demoState, expenses: demoState.expenses.filter((e) => e.id !== id) });
}
export function filterExpenses(
  rows: PlatformExpense[],
  search: string,
  category: string,
  from: string,
  to: string,
) {
  return rows.filter(
    (e) =>
      (!search || `${e.name} ${e.notes}`.toLowerCase().includes(search.toLowerCase())) &&
      (!category || e.category === category) &&
      (!from || e.date >= from) &&
      (!to || e.date <= to),
  );
}
export function platformTotals(
  revenue: RevenueEvent[],
  expenses: PlatformExpense[],
  from: Date,
  to: Date,
) {
  const income = revenue
    .filter((r) => inRange(r.date, from, to))
    .reduce((sum, r) => sum + r.amount, 0);
  const spent = expenses
    .filter((e) => inRange(e.date, from, to))
    .reduce((sum, e) => sum + e.amount, 0);
  return { revenue: income, expenses: spent, net: income - spent };
}

export function createDemoInvitation(
  gymId: string,
  gymName: string,
  name: string,
  email: string,
  role: "Admin" | "Reception" | "Trainer",
  options?: { userId?: string; permissions?: string[] },
) {
  const normalized = email.trim()
    ? z.string().trim().email().max(255).parse(email).toLowerCase()
    : "";
  const fullName = z.string().trim().min(1).max(100).parse(name);
  const userId = options?.userId ?? null;
  if (!normalized && !userId)
    throw new Error("Resolve an existing client account before sending the invitation");
  if (
    demoState.invitations.some(
      (i) =>
        i.gym_id === gymId &&
        i.role === role &&
        invitationStatus(i.status, i.expires_at) === "Pending" &&
        ((normalized && i.email === normalized) || (userId && i.invited_user_id === userId)),
    )
  )
    throw new Error(
      "An active invitation already exists for this client and role. Resend it from Invitations.",
    );
  const row: DemoInvitation = {
    id: generateId(),
    gym_id: gymId,
    gym_name: gymName,
    full_name: fullName,
    email: normalized,
    role,
    status: "Pending",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    accepted_by: null,
    invited_user_id: userId,
    permissions:
      options?.permissions ??
      (role === "Admin"
        ? ["Members", "Attendance", "Sessions", "Payments", "Finance", "Workout programs"]
        : role === "Reception"
          ? ["Members", "Attendance", "Sessions", "Payments"]
          : ["Members", "Workout programs"]),
  };
  commit({ ...demoState, invitations: [row, ...demoState.invitations] });
  return row;
}
export function changeDemoInvitation(gymId: string, id: string, action: "resend" | "cancel") {
  const row = demoState.invitations.find((i) => i.id === id && i.gym_id === gymId);
  if (!row || !["Pending", "Expired"].includes(invitationStatus(row.status, row.expires_at)))
    throw new Error("Invitation unavailable");
  if (action === "cancel" && invitationStatus(row.status, row.expires_at) !== "Pending")
    throw new Error("Only pending invitations can be cancelled");
  commit({
    ...demoState,
    invitations: demoState.invitations.map((i) =>
      i.id === id && i.gym_id === gymId
        ? {
            ...i,
            ...(action === "cancel"
              ? { status: "Cancelled" }
              : {
                  status: "Pending",
                  created_at: new Date().toISOString(),
                  expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
                }),
          }
        : i,
    ),
  });
}

/** All local client account IDs that belong to the current individual session. */
function sessionClientIds(email: string): Set<string> {
  const ids = new Set<string>();
  const normalized = email.trim().toLowerCase();
  if (normalized) ids.add(demoUserId(normalized));
  const preview = readPreviewSession();
  if (preview?.type === "individual") ids.add(preview.id);
  for (const c of localClients()) if (normalized && c.email.toLowerCase() === normalized) ids.add(c.id);
  return ids;
}
export function pendingDemoInvitations(email: string, rows = demoState.invitations) {
  const normalized = email.trim().toLowerCase();
  const ids = sessionClientIds(email);
  return rows.filter(
    (i) =>
      invitationStatus(i.status, i.expires_at) === "Pending" &&
      ((normalized && i.email.toLowerCase() === normalized) ||
        (i.invited_user_id !== null && ids.has(i.invited_user_id))),
  );
}
export function respondDemoInvitation(id: string, accept: boolean) {
  const info = getDemoSessionInfo();
  if (!info || info.kind !== "individual") throw new Error("Open your member account to respond");
  const row = pendingDemoInvitations(info.email).find((i) => i.id === id);
  if (!row) throw new Error("Invitation unavailable for this account");
  const userId = row.invited_user_id ?? demoUserId(info.email);
  const role: DemoStaffRole = {
    id: row.id,
    userId,
    gymId: row.gym_id,
    gymName: row.gym_name ?? "Gym",
    name: info.name || row.full_name,
    email: row.email,
    role: row.role,
    permissions: [...row.permissions],
  };
  commit({
    ...demoState,
    invitations: demoState.invitations.map((i) =>
      i.id === id
        ? { ...i, status: accept ? "Accepted" : "Declined", accepted_by: accept ? userId : null }
        : i,
    ),
    staffRoles: accept
      ? [
          ...demoState.staffRoles.filter((r) => !(r.gymId === row.gym_id && r.userId === userId)),
          role,
        ]
      : demoState.staffRoles,
  });
  appendGymEvents(row.gym_id, [{ id: `invitation-response:${id}`, type: 'Staff invitation', description: `${row.full_name} · Invitation ${accept ? 'accepted' : 'declined'} (${row.role})`, page: '/staff', createdAt: new Date().toISOString() }]);
}

export function readDemoGym(gymId: string, withSeed = false): State {
  let stored: State | undefined;
  try {
    const raw =
      prototypeStorage().getItem(`ironhaus-demo-gym:${gymId}`) ??
      (gymId === "demo-gym" ? prototypeStorage().getItem("ironhaus-demo-gym-state") : null);
    if (raw) stored = JSON.parse(raw) as State;
  } catch {
    /* Use an empty gym or the owner seed. */
  }
  const base =
    stored ??
    (withSeed && gymId === "demo-gym"
      ? structuredClone(initialState)
      : {
          ...structuredClone(initialState),
          members: [],
          plans: [],
          products: [],
          trainers: [],
          workouts: [],
          staff: [],
          sessions: [],
          attendance: [],
          staffAttendance: [],
          recurring: [],
          transactions: [],
        });
  const local = base.staff.map((s) => ({
    ...s,
    id: s.id ?? `seed:${s.email}`,
    userId: s.userId ?? demoUserId(s.email),
  }));
  const associations = demoState.staffRoles.filter((r) => r.gymId === gymId);
  return {
    ...base,
    gym: {
      ...base.gym,
      hoursByDay: base.gym.hoursByDay?.length ? base.gym.hoursByDay : defaultGymHours(),
    },
    members: base.members.map(m=>({...m,clientId:m.clientId ?? demoUserId(m.email),gyvoraId:demoMemberId(m.clientId ?? demoUserId(m.email)) || undefined})),
    transactions:
      base.transactions ??
      (withSeed && gymId === "demo-gym" ? structuredClone(initialState.transactions) : []),
    staff: [
      ...local.filter((s) => !associations.some((r) => r.userId === s.userId)),
      ...associations,
    ],
  };
}
export function writeDemoGym(gymId: string, state: State) {
  const submitted = state;
  const account=getDemoAccount();
  if(getDemoSession()==='owner'&&account&&!demoOwnerHasAccess(account))throw new Error('Gym access unavailable');
  const previous = readDemoGym(gymId, gymId === "demo-gym");
  // Pricing plans and other gym records must not run membership side effects.
  const membersChanged = JSON.stringify(state.members) !== JSON.stringify(previous.members);
  if (membersChanged) {
    validateMembershipChanges(previous.members, state.members);
    const events = [...(previous.membershipEvents ?? [])];
    state = { ...state, members: state.members.map(m => {
      const old = previous.members.find(row => row.id === m.id);
      const isSubscription = !old || (m.subscriptionEventId && m.subscriptionEventId !== old.subscriptionEventId);
      const price = isSubscription ? state.plans.find(p => p.name === m.plan)?.price ?? 0 : old?.planPrice;
      if (isSubscription) events.push({ id: m.subscriptionEventId ?? generateId(), memberId: m.id, kind: old ? 'renewed' : 'created', date: gymToday(state.gym), price: price ?? 0 });
      return price === undefined ? m : { ...m, planPrice: price };
    }), membershipEvents: events };
    state={...state,members:state.members.map(m=>({...m,...(m.clientId?{gyvoraId:demoMemberId(m.clientId)||undefined}: {})}))};
    rememberDemoMemberships(gymId, previous.gym.name, previous.members);
    rememberDemoMemberships(gymId, state.gym.name, state.members);
  }
  prototypeStorage().setItem(`ironhaus-demo-gym:${gymId}`, JSON.stringify(state));
  Object.assign(submitted, state);
  if (gymId === "demo-gym") prototypeStorage().setItem("ironhaus-demo-gym-state", JSON.stringify(state));
  appendGymEvents(gymId, gymEvents(previous, state));
}
export function changeDemoStaff(
  gymId: string,
  id: string,
  patch: Partial<Pick<StaffMember, "name" | "phone" | "role" | "permissions">> | null,
) {
  if (getDemoSession() !== "owner") throw new Error("Only gym owners can manage staff");
  const state = readDemoGym(gymId, true);
  const row = state.staff.find((s) => s.id === id);
  if (!row || row.role === "Owner") throw new Error("Staff member unavailable");
  writeDemoGym(gymId, {
    ...state,
    staff: patch
      ? state.staff.map((s) => (s.id === id ? { ...s, ...patch } : s))
      : state.staff.filter((s) => s.id !== id),
  });
  commit({
    ...demoState,
    staffRoles: patch
      ? demoState.staffRoles.map((r) => (r.gymId === gymId && r.id === id ? { ...r, ...patch } : r))
      : demoState.staffRoles.filter((r) => !(r.gymId === gymId && r.id === id)),
  });
}
export function saveDemoProgram(userId: string, definition: Workout, id?: string) {
  if (getDemoSession() !== "individual" || demoUserId(getDemoSessionInfo()?.email ?? "") !== userId)
    throw new Error("Your own programs only");
  const row: DemoProgram = {
    id: id ?? generateId(),
    user_id: userId,
    definition: structuredClone(definition),
    completion: [],
    created_at: new Date().toISOString(),
  };
  if (id && !demoState.programs.some((p) => p.id === id && p.user_id === userId))
    throw new Error("Program unavailable");
  commit({
    ...demoState,
    programs: id
      ? demoState.programs.map((p) => (p.id === id && p.user_id === userId ? row : p))
      : [row, ...demoState.programs],
  });
}
export function changeDemoProgram(id: string, completion: number[] | null) {
  const userId = demoUserId(getDemoSessionInfo()?.email ?? "");
  const row = demoState.programs.find((p) => p.id === id && p.user_id === userId);
  if (getDemoSession() !== "individual" || !row) throw new Error("Program unavailable");
  commit({
    ...demoState,
    programs:
      completion === null
        ? demoState.programs.filter((p) => p.id !== id)
        : demoState.programs.map((p) => (p.id === id ? { ...p, completion } : p)),
  });
}

const today = () => new Date().toISOString().slice(0, 10);

function addMonths(iso: string, months: number) {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function approveRequest(id: string) {
  const req = demoState.requests.find((r) => r.id === id);
  if (!req || !['Pending','Rejected'].includes(req.status)) return;
  if(getDemoAccounts().find(a=>a.email===req.email)?.deletedAt) throw new Error('Deleted gym accounts cannot be approved');
  const existingGym=demoState.gyms.find(g=>g.email===req.email);
  const start = today();
  const offeredPlan=(demoState.platformPlans??defaultPlatformPlans).find(p=>p.id===req.planId || p.name===req.plan);
  const billingType=req.billingType??offeredPlan?.billingType;
  const durationDays=req.durationDays??offeredPlan?.durationDays;
  const price=req.price??offeredPlan?.price;
  const agreement = billingType && durationDays && price !== undefined
    ? planDefaults({id:req.planId??offeredPlan?.id??`request-${req.id}`,name:req.plan,billingType,price,durationDays},start)
    : null;
  const monthlyPrice=agreement?.monthlyPrice??gymPrices({plan:req.plan}).monthlyPrice;
  const annualPrice=agreement?.annualPrice??gymPrices({plan:req.plan}).annualPrice;
  const end=agreement?.end??addMonths(start,billingMonths(req.plan));
  const gym: ApprovedGym = {
    id: generateId(),
    name: req.gymName,
    phone: req.phone,
    email: req.email,
    plan: req.plan,
    start,
    end,
    status: "Active",
    ...gymPrices({ plan: req.plan }),
    monthlyPrice,
    annualPrice,
    ...(agreement?{plan:agreement.plan,planId:agreement.planId,billingType:agreement.billingType,durationDays:agreement.durationDays,annualPriceManual:agreement.annualPriceManual}:{}),
  };
  commit({
    ...demoState,
    requests: demoState.requests.map((r) => (r.id === id ? { ...r, status: "Approved", decidedAt: start } : r)),
    gyms: existingGym?demoState.gyms:[gym, ...demoState.gyms],
    revenue: [
      { id: generateId(), date: start, amount: billingType === 'Annual' ? annualPrice : billingType === 'Monthly' ? monthlyPrice : PLAN_PRICES[req.plan] ?? 0, gymName: req.gymName },
      ...demoState.revenue,
    ],
  });
}

export function rejectRequest(id: string, note = '') {
  commit({
    ...demoState,
    requests: demoState.requests.map((r) => (r.id === id && r.status === "Pending" ? { ...r, status: "Rejected", decidedAt: today(), decisionNote:note.trim().slice(0,1000) } : r)),
  });
}

export function editGym(id: string, patch: { name: string; plan: string; start?: string; end?: string; notes?: string; planId?: string | undefined; applyPlan?: boolean } & Partial<z.infer<typeof subscriptionPriceSchema>>) {
  const current = demoState.gyms.find(g => g.id === id);
  if (!current) throw new Error('Gym no longer exists');
  const name=z.string().trim().min(1).max(100).parse(patch.name);
  const selected=patch.applyPlan?(demoState.platformPlans??defaultPlatformPlans).find(p=>p.id===patch.planId):undefined;
  if(patch.applyPlan&&patch.planId&&!selected)throw new Error('Plan no longer exists');
  const start=patch.start??current.start;
  const defaults=selected?planDefaults(selected,start):{};
  const prices = savePrices({ ...gymPrices(current), ...defaults, ...patch });
  const dates=gymDatesSchema.parse({start,end:patch.end??('end' in defaults?defaults.end:patch.plan===current.plan?current.end:addMonths(start,billingMonths(patch.plan))),notes:patch.notes??current.notes??''});
  const legacyReset=patch.applyPlan&&!selected?{planId:undefined,billingType:undefined,durationDays:undefined}:{};
  commit({
    ...demoState,
    requests: demoState.requests.map(r => r.email === current.email && r.status === 'Approved' ? {...r, gymName:name, plan:patch.plan} : r),
    gyms: demoState.gyms.map((g) =>
      g.id === id
        ? {
            ...g,
            ...defaults,
            ...legacyReset,
            name,
            plan: patch.plan,
            ...dates,
            ...prices,
          }
        : g,
    ),
  });
}

export function setGymStatus(id: string, status: "Active" | "Frozen", note = '') {
  if(readPreviewSession() && getDemoSession() !== 'super') throw new Error('Administrator prototype access required');
  commit({ ...demoState, gyms: demoState.gyms.map((g) => (g.id === id ? { ...g, status, freezeNote:status==='Frozen'?note.trim().slice(0,1000):'' } : g)) });
}

export function deleteGym(id: string, note = '') {
  if(getDemoSession()!=='super')throw new Error('Administrator prototype access required');
  const gym=demoState.gyms.find(g=>g.id===id);if(!gym)return;
  if(gym.deletedAt)throw new Error('Gym is already deleted');
  const deletedAt=new Date().toISOString();
  const reason=z.string().trim().max(1000).parse(note);
  commit({...demoState,gyms:demoState.gyms.map(g=>g.id===id?{...g,deletedAt,deletionNote:reason,deletionHistory:[...(g.deletionHistory??[]),{action:'deleted',at:deletedAt,note:reason}]}:g)});
}

export function restoreGym(id:string) {
  if(getDemoSession()!=='super')throw new Error('Administrator prototype access required');
  const gym=demoState.gyms.find(g=>g.id===id);if(!gym?.deletedAt)throw new Error('Gym is not deleted');
  commit({...demoState,gyms:demoState.gyms.map(g=>g.id===id?{...g,deletedAt:undefined,deletionHistory:[...(g.deletionHistory??[]),{action:'restored',at:new Date().toISOString(),note:g.deletionNote??''}]}:g),requests:demoState.requests.map(r=>r.email===gym.email?{...r,status:'Approved'}:r)});
}

export function editClient(id: string, patch: { name: string; phone: string }) {
  if(readPreviewSession()) {
    updatePrototypeAccount(id, patch);
    prototypeStorage().setItem('gyvora-demo-client-directory', JSON.stringify(localClients().map(client =>
      client.id === id ? {...client, full_name:patch.name, phone:patch.phone} : client,
    )));
  }
  commit({
    ...demoState,
    clients: demoState.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  });
}

/** Removes one gym membership; the client and their other gyms stay. */
export function removeClientGym(clientId: string, gymName: string) {
  commit({
    ...demoState,
    clients: demoState.clients.map((c) =>
      c.id === clientId ? { ...c, gyms: c.gyms.filter((g) => g !== gymName) } : c,
    ),
  });
}

export function deleteClient(id: string) {
  if(readPreviewSession()) {
    deletePrototypeAccount(id);
    prototypeStorage().setItem('gyvora-demo-client-directory', JSON.stringify(localClients().filter(client => client.id !== id)));
  }
  commit({ ...demoState, clients: demoState.clients.filter((c) => c.id !== id) });
}

/* ---------------- Admin messages & client freeze (demo) ---------------- */

export type DemoAdminMessage = { id: string; to: string; body: string; createdAt: string; readBy?: string[] };

/** Sends a browser-local demo message to a client (by demo user id) or gym owner (by gym email). */
export function sendDemoAdminMessage(to: string, body: string) {
  if (getDemoSession() !== 'super') throw new Error('Administrator prototype access required');
  const text = body.trim();
  if (!text || text.length > 2000) throw new Error('Message must be 1-2000 characters');
  commit({ ...demoState, adminMessages: [{ id: generateId(), to, body: text, createdAt: new Date().toISOString() }, ...(demoState.adminMessages ?? [])] });
}

export function demoAdminMessagesFor(key: string): DemoAdminMessage[] {
  return (demoState.adminMessages ?? []).filter((m) => m.to === key);
}

export function markDemoAdminMessageRead(recipientId: string, messageId: string) {
  const info = getDemoSessionInfo();
  if (!info || !["individual", "owner"].includes(info.kind))
    throw new Error("Open your account to read messages");
  const isRecipient =
    info.kind === "individual"
      ? sessionClientIds(info.email).has(recipientId)
      : info.email.trim().toLowerCase() === recipientId.trim().toLowerCase();
  if (!isRecipient)
    throw new Error("You can only read messages sent to your account");
  const message = (demoState.adminMessages ?? []).find(
    (row) => row.id === messageId && row.to === recipientId,
  );
  if (!message) throw new Error("Message unavailable for this account");
  commit({
    ...demoState,
    adminMessages: (demoState.adminMessages ?? []).map((row) =>
      row.id === messageId
        ? { ...row, readBy: [...new Set([...(row.readBy ?? []), recipientId])] }
        : row,
    ),
  });
}

/** Reversible demo client freeze; account and data are retained. */
export function setDemoClientFrozen(clientId: string, frozen: boolean, note: string) {
  if (getDemoSession() !== 'super') throw new Error('Administrator prototype access required');
  const next = { ...(demoState.clientFreeze ?? {}) };
  if (frozen) next[clientId] = { note: note.trim().slice(0, 1000), at: new Date().toISOString() };
  else delete next[clientId];
  commit({ ...demoState, clientFreeze: next });
}

export function demoClientFrozen(clientId: string): { note: string; at: string } | null {
  return demoState.clientFreeze?.[clientId] ?? null;
}

export function setDemoClientDeleted(clientId: string, note: string) {
  if (getDemoSession() !== 'super') throw new Error('Administrator prototype access required');
  const next = { ...(demoState.clientDeletion ?? {}) };
  next[clientId] = { note: note.trim().slice(0, 1000), at: new Date().toISOString() };
  commit({ ...demoState, clientDeletion: next });
}

export function demoClientDeleted(clientId: string): { note: string; at: string } | null {
  return demoState.clientDeletion?.[clientId] ?? null;
}

/** Browser-local directory of demo client accounts known on this device. */
export function demoClientDirectory(): { id: string; name: string; email: string; phone: string; photo: string }[] {
  const local = localClients().map((c) => ({ id: c.id, name: c.full_name, email: c.email, phone: c.phone, photo: c.photo ?? '' }));
  const registered = readPreviewSession() ? listPrototypeAccounts().filter(a => a.type === 'individual').map(a => ({
    id: a.id,
    name: a.name,
    email: a.email,
    phone: a.phone,
    photo: a.photo,
  })) : [];
  return [...local, ...registered.filter(account => !local.some(client => client.id === account.id))];
}

/* ---------------- Period filtering ---------------- */

export type Period =
  "today" | "yesterday" | "7d" | "month" | "lastMonth" | "year" | "lastYear" | "custom";

export const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 Days" },
  { id: "month", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "year", label: "This Year" },
  { id: "lastYear", label: "Last Year" },
  { id: "custom", label: "Custom Range" },
];

export function periodRange(
  p: Period,
  custom?: { from: string; to: string },
): { from: Date; to: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  switch (p) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "7d": {
      const f = new Date(now);
      f.setDate(f.getDate() - 6);
      return { from: startOfDay(f), to: endOfDay(now) };
    }
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case "lastMonth":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
    case "lastYear":
      return {
        from: new Date(now.getFullYear() - 1, 0, 1),
        to: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
      };
    case "custom": {
      const from = custom?.from ? new Date(custom.from + "T00:00:00") : startOfDay(now);
      const to = custom?.to ? new Date(custom.to + "T23:59:59") : endOfDay(now);
      return { from, to };
    }
  }
}

export function inRange(iso: string, from: Date, to: Date) {
  const t = new Date(iso + (iso.length === 10 ? "T12:00:00" : "")).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

/** Owners, or trainers/admins of this gym, may send workouts to that gym's own members only. */
export function sendDemoAssignment(input: {
  requestKey: string;
  gymId: string;
  gymName: string;
  memberId: string;
  program: Workout;
}) {
  const info = getDemoSessionInfo();
  if (!info) throw new Error("Sign in first");
  const senderId = demoUserId(info.email);
  const staff = demoState.staffRoles.find((r) => r.gymId === input.gymId && r.userId === senderId);
  const allowed =
    info.kind === "owner" ||
    (info.kind === "individual" && !!staff && ["Trainer", "Admin", "Owner"].includes(staff.role));
  if (!allowed) throw new Error("Only this gym's trainers or owner can send workouts");
  const existing = demoState.assignments.find((a) => a.requestKey === input.requestKey);
  if (existing) return existing;
  const member = readDemoGym(input.gymId, input.gymId === "demo-gym").members.find(
    (m) => m.id === input.memberId,
  );
  if (!member) throw new Error("This client is not a member of the current gym");
  const row: DemoAssignment = {
    id: generateId(),
    requestKey: input.requestKey,
    gymId: input.gymId,
    gymName: input.gymName,
    senderId,
    senderName: staff?.name || info.name || getDemoAccount()?.name || "Gym Owner",
    recipientId: member.clientId ?? demoUserId(member.email),
    recipientName: member.name,
    memberId: member.id,
    sentAt: new Date().toISOString(),
    program: structuredClone({
      ...input.program,
      trainer: input.program.trainer.trim() || staff?.name || info.name || "Gym Owner",
    }),
    status: "Pending",
  };
  commit({ ...demoState, assignments: [row, ...demoState.assignments] });
  return row;
}
export function pendingDemoAssignments(userId: string, rows = demoState.assignments) {
  return rows.filter((a) => a.recipientId === userId && a.status === "Pending");
}
/** Save copies the snapshot into the recipient's own programs; Delete only dismisses the notification. */
export function respondDemoAssignment(id: string, save: boolean) {
  if (getDemoSession() !== "individual") throw new Error("Open your client account to respond");
  const preview = readPreviewSession();
  const userId = preview?.type === "individual"
    ? preview.id
    : demoUserId(getDemoSessionInfo()?.email ?? "");
  const row = demoState.assignments.find((a) => a.id === id && a.recipientId === userId);
  if (!row || row.status !== "Pending") throw new Error("Workout unavailable");
  if (save && preview?.type === "individual")
    savePreviewClientProgram(userId, structuredClone(row.program));
  const copy: DemoProgram | null = save && !preview
    ? {
        id: generateId(),
        user_id: userId,
        definition: { ...structuredClone(row.program), id: generateId() },
        completion: [],
        created_at: new Date().toISOString(),
      }
    : null;
  commit({
    ...demoState,
    assignments: demoState.assignments.map((a) =>
      a.id === id ? { ...a, status: save ? "Saved" : "Deleted" } : a,
    ),
    programs: copy ? [copy, ...demoState.programs] : demoState.programs,
  });
}

export function setDemoDeletionNote(id:string, note:string) {
  if(getDemoSession()!=='super')throw new Error('Administrator prototype access required');
  if(note.length>1000)throw new Error('Reason is too long');
  if(!demoState.gyms.some(g=>g.id===id&&g.deletedAt))throw new Error('Gym is not deleted');
  commit({...demoState,gyms:demoState.gyms.map(g=>g.id===id?{...g,deletionNote:note.trim()}:g)});
}
