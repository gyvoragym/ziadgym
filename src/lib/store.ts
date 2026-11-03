import { useSyncExternalStore } from "react";
import {
  gym as gymSeed,
  members as membersSeed,
  trainers as trainersSeed,
} from "./mock";

export type Member = (typeof membersSeed)[number] & {
  clientId?: string;
  /** 'registered' links to a real account via clientId; 'manual' is a gym-owned record only. */
  source?: 'registered' | 'manual';
  gyvoraId?: string | undefined;
  memberQrId?: string | undefined;
  planPrice?: number;
  createdByName?: string;
  subscriptionEventId?: string;
};
export type Product = {
  id?: string | undefined;
  image?: string | undefined;
  name: string;
  qty: number;
  price: number;
  sales: number;
  min: number;
};
export type TrainerDay = { day: string; available: boolean; start: string; end: string };
export type Trainer = (typeof trainersSeed)[number] & { schedule?: TrainerDay[]; notes?: string | undefined; previousNames?: string[] | undefined };
export type Invoice = {
  id: string;
  number?: number | undefined;
  name: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  type: string;
  method: string;
  attachment?: string | undefined;
  deleted?: boolean | undefined;
  entered?: boolean | undefined;
};
export type Plan = {
  id: string;
  name: string;
  duration: string;
  durationMonths?: number;
  price: number;
  features: string[];
  featured?: boolean;
};
export type Workout = {
  id?: string | undefined;
  name: string;
  trainer: string;
  notes: string;
  exercises: { name: string; sets: number; reps: string; image?: string | undefined }[];
};
export type StaffMember = {
  id?: string;
  userId?: string;
  name: string;
  role: string;
  email: string;
  phone?: string;
  permissions?: string[];
};
export type Session = {
  id: string;
  name: string;
  trainer: string;
  price: number;
  date: string;
  type: string;
  method: string;
  memberId?: string | undefined;
};
export type AttendanceEvent = {
  id: string;
  name: string;
  role?: string;
  date: string;
  time: string;
  memberId?: string;
  staffId?: string;
  method: "QR" | "Manual";
};
export type RecurringExpense = {
  id: string;
  name: string;
  category: string;
  frequency: "Weekly" | "Monthly" | "Yearly" | "Custom";
  next: string;
  start: string;
  amount: number;
  /** Occurrence date (value of `next`) already recorded as paid — blocks double payment. */
  lastPaidOccurrence?: string | undefined;
};
export type DayHours = { day: string; open: string; close: string; closed: boolean };
export const defaultGymHours = (): DayHours[] =>
  ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => ({
    day,
    open: "08:00",
    close: "23:00",
    closed: false,
  }));

export type Gym = typeof gymSeed & {
  logo: string;
  cover: string;
  gallery: GalleryItem[];
  coords?: { lat: number; lng: number };
  hoursByDay: DayHours[];
  preferences?: GymPreferences;
};

export type State = {
  gym: Gym;
  members: Member[];
  products: Product[];
  trainers: Trainer[];
  plans: Plan[];
  workouts: Workout[];
  staff: StaffMember[];
  sessions: Session[];
  attendance: AttendanceEvent[];
  staffAttendance: AttendanceEvent[];
  recurring: RecurringExpense[];
  transactions: Invoice[];
  membershipEvents?: import('./gym-reporting').MembershipEvent[];
};

export const initialState: State = {
  gym: {
    ...gymSeed,
    name: "",
    code: "",
    tagline: "",
    description: "",
    location: "",
    hours: "",
    phone: "",
    whatsapp: "",
    facilities: [],
    services: [],
    logo: "",
    cover: "",
    gallery: [],
    hoursByDay: defaultGymHours(),
  },
  members: [],
  products: [],
  trainers: [],
  plans: [],
  workouts: [],
  staff: [],
  sessions: [],
  attendance: [],
  staffAttendance: [],
  recurring: [],
  transactions: [],
};
let state: State = structuredClone(initialState);

const listeners = new Set<() => void>();
let persist: ((changes: Partial<State>) => Promise<void>) | undefined;
export function bindPersistence(handler: typeof persist) {
  persist = handler;
}
export function hydrateState(next: State) {
  state = next;
  listeners.forEach((l) => l());
}
export function setState(fn: (s: State) => Partial<State>) {
  void saveState(fn).catch(() => {});
}
export async function saveState(fn: (s: State) => Partial<State>) {
  const changes = fn(state);
  if (persist) {
    await persist(changes);
    return;
  }
  state = { ...state, ...changes };
  listeners.forEach((l) => l());
}
export function getState() {
  return state;
}
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => sel(state),
    () => sel(state),
  );
}

/** Stock rule: 0 → Out of stock, below 10 → Low stock. */
export function stockStatus(qty: number): "Out of stock" | "Low stock" | "In stock" {
  if (qty <= 0) return "Out of stock";
  if (qty < 10) return "Low stock";
  return "In stock";
}

/** Registering a session for a limited member uses one session (never below 0). */
export function consumeSession(m: Member): Member {
  if (m.type !== "Limited") return m;
  return { ...m, sessionsLeft: Math.max(0, m.sessionsLeft - 1) };
}

export function fmt12(t: string) {
  const [h = 0, mi = 0] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${String(hh).padStart(2, "0")}:${String(mi).padStart(2, "0")} ${ap}`;
}

export const readFile = (f: File) =>
  new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.readAsDataURL(f);
  });

export const CURRENCIES = ["EGP", "USD", "SAR", "AED"] as const;
export type Currency = (typeof CURRENCIES)[number];
export type GymPreferences = { currency: Currency; language: "English" | "العربية"; notifications: Record<string, boolean>; timeZone?: string };
export const defaultPreferences: GymPreferences = { currency: "EGP", language: "English", notifications: {} };
/** Display-only currency label from the saved gym settings; amounts are never converted. */
export function currencyOf(g: Partial<Gym> | undefined = state.gym): Currency {
  const c = (g as { preferences?: Partial<GymPreferences> } | undefined)?.preferences?.currency;
  return c && (CURRENCIES as readonly string[]).includes(c) ? c : "EGP";
}
export const money = (n: number, c: Currency = currencyOf()) => `${c} ${Math.abs(n).toLocaleString("en-US")}`;
export function useCurrency() { return useStore((s) => currencyOf(s.gym)); }

/** Gallery entries: legacy plain paths or captioned photos saved in the gym record. */
export type GalleryPhoto = { id: string; path: string; caption: string };
export type GalleryItem = string | GalleryPhoto;
export const toPhoto = (g: GalleryItem, i: number): GalleryPhoto => typeof g === 'string' ? { id: `legacy-${i}-${g.slice(-24)}`, path: g, caption: '' } : { id: g.id, path: g.path, caption: g.caption ?? '' };
