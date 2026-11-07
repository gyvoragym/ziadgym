import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouter, useRouterState, useHydrated, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { bindPersistence, hydrateState, getState, initialState, defaultGymHours, type State } from "@/lib/store";
import { gym as gymSeed } from "@/lib/mock";
import { saveRecords, getStaff, getReportingEvents } from "@/lib/cloud.functions";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { readOwnerProfile } from '@/lib/owner-profile';
import { expirationEvents } from '@/lib/gym-events';
import { appendGymEvents } from '@/lib/gym-notifications-demo';
import { localDate } from '@/lib/gym-period';
import { isClientPortalPath } from '@/lib/membership-link';
import { getOwnerGate } from '@/lib/owner-gate.functions';
import { listAccountMessages } from '@/lib/account-messages.functions';
import { ownerSubscriptionExpired, trialActive, trialExpired, trialRemainingMs, formatRemaining, type OwnerGate } from '@/lib/trial';
import { DEFAULT_PLATFORM_WHATSAPP, whatsappLink, rememberDemoClient } from '@/lib/demo';
import { MessageCircle } from 'lucide-react';
import { DemoOwnerGate } from './DemoOwnerGate';
import { PrototypeGymTrialBoundary } from './PrototypeGymTrialBoundary';
import { ensureOfflineDemoIdentity } from '@/lib/demo-identities';
import { readPreviewSession, savePreviewSession } from '@/lib/preview-session';
import { clearPrototypeStorage, prototypeStorage } from '@/lib/prototype-storage';
import { readSampleRequest } from '@/lib/prototype-scenario';
import { isSupabaseClientConfigured } from "@/lib/supabase-availability";
import {
  getDemoSession,
  getDemoSessionInfo,
  getDemoAccount,
  demoOwnerHasAccess,
  demoRequestStatus,
  useDemoStore,
  setDemoSession,
  demoUserId,
  demoClientFrozen,
  demoClientDirectory,
  demoMemberId,
  getDemoState,
  readDemoGym,
  writeDemoGym,
  prepareDemoIdentities,
  resetPrototypeData,
} from "@/lib/demo";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type GymRow = Database["public"]["Tables"]["gyms"]["Row"];
type Context = {
  profile: Profile | null;
  gyms: GymRow[];
  gymId: string;
  role: string;
  permissions: string[];
  verified: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  selectGym: (id: string) => Promise<string>;
  logout: () => Promise<void>;
};
const CloudContext = createContext<Context>({
  profile: null,
  gyms: [],
  gymId: "",
  role: "",
  permissions: [],
  verified: false,
  loading: true,
  refresh: async () => {},
  selectGym: async () => "",
  logout: async () => {},
});
export const useCloud = () => useContext(CloudContext);
export function CloudProvider({ children }: { children: ReactNode }) {
  const generation = useRef(0);
  const router = useRouter();
  const save = useServerFn(saveRecords);
  const staffFetch = useServerFn(getStaff);
  const reportingFetch = useServerFn(getReportingEvents);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [gymId, setGymId] = useState("");
  const [role, setRole] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [verified, setVerified] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  async function loadGym(id: string): Promise<string> {
    if (!gyms.some((g) => g.id === id)) throw new Error("Gym access required");
    if (getDemoSession()) {
      bindPersistence(undefined);
      const owner = getDemoSession() === "owner";
      const association = getDemoState().staffRoles.find(
        (r) => r.gymId === id && r.userId === profile?.id,
      );
      setGymId(id);
      setRole(owner ? "Owner" : (association?.role ?? "Client"));
      setPermissions(owner ? [] : (association?.permissions ?? []));
      hydrateState(readDemoGym(id, owner));
      if (owner) appendGymEvents(id, expirationEvents(getState(), localDate()));
      if (owner)
        bindPersistence(async (changes) => {
          const next = { ...getState(), ...changes };
          writeDemoGym(id, next);
          hydrateState(next);
        });
      return owner ? "Owner" : (association?.role ?? "Client");
    }
    const current = ++generation.current;
    setGymId("");
    bindPersistence(undefined);
    const { data: rows, error } = await supabase.from("gym_records").select("*").eq("gym_id", id);
    if (error) throw error;
    const { data: r } = await supabase
      .from("user_roles")
      .select("*")
      .eq("gym_id", id)
      .eq("user_id", profile?.id ?? "")
      .maybeSingle();
    const selectedRole = r?.role ?? "";
    setRole((prev) => (prev === "super_admin" ? prev : selectedRole));
    setPermissions(r?.permissions ?? []);
    const base: State = {
      gym: {
        ...gymSeed,
        name: gyms.find((g) => g.id === id)?.name ?? "",
        logo: "",
        cover: "",
        gallery: [],
        hoursByDay: defaultGymHours(),
      },
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
    };
    for (const row of rows ?? []) {
      if (row.kind === "gym") base.gym = { ...base.gym, ...row.data as unknown as State["gym"] };
      else if (row.kind in base && row.kind !== "staff") {
        const key = row.kind as Exclude<keyof State, "gym">;
        const data = row.data as Record<string, unknown>;
        (base[key] as unknown[]).push(key === 'members' ? { ...data, email: data['email'] ?? '' } : data);
      }
    }
    base.gym.name = gyms.find(g => g.id === id)?.name ?? base.gym.name;
    if (!base.gym.hoursByDay?.length) base.gym.hoursByDay = defaultGymHours();
    if (r?.role !== "Client") {
      try {
        base.staff = await staffFetch({ data: { gymId: id } });
      } catch {
        base.staff = [];
      }
    }
    if (current !== generation.current) return selectedRole;
    base.membershipEvents = r?.role === 'Owner' || r?.permissions?.some(p => p === 'Members' || p === 'Dashboard') ? await reportingFetch({data:{gymId:id}}) : [];
    hydrateState(base);
    setGymId(id);
    let savedRows = rows ?? [];
    bindPersistence(async (changes) => {
      try {
        const formatted = Object.entries(changes)
          .filter(([k]) => k !== "staff")
          .map(([kind, value]) => ({
            kind,
            expected: savedRows.filter((r) => r.kind === kind).map((r) => r.data),
            rows: (kind === "gym" ? [value] : (value as unknown[])).map((v, i) => {
              const obj = v as Record<string, unknown>;
              return {
                ...obj,
                id: obj["id"] ?? (kind === "gym" ? "profile" : (obj["name"] ?? String(i))),
              };
            }),
          }));
        const result = await save({
          data: {
            gymId: id,
            changes: formatted as Array<{
              kind:
                | "gym"
                | "members"
                | "products"
                | "trainers"
                | "plans"
                | "workouts"
                | "sessions"
                | "attendance"
                | "staffAttendance"
                | "recurring"
                | "transactions";
              rows: Record<string, unknown>[];
              expected: Record<string, unknown>[];
            }>,
          },
        });
        savedRows = result.records as typeof savedRows;
        const next = { ...getState(), ...changes };
        if (changes.members) next.membershipEvents = await reportingFetch({data:{gymId:id}});
        for (const kind of Object.keys(changes)) {
          const current = result.records?.filter((r) => r.kind === kind).map((r) => {
            const data = r.data as Record<string, unknown>;
            return kind === 'members' ? { ...data, email: data['email'] ?? '' } : data;
          }) ?? [];
          if (kind === "gym") {
            const first = current[0];
            if (first) next.gym = first as unknown as State["gym"];
          } else if (kind in next) {
            (next as unknown as Record<string, unknown>)[kind] = current;
          }
        }
        if (current === generation.current) hydrateState(next);
        toast.success("Changes saved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save changes");
        throw e;
      }
    });
    return selectedRole;
  }
  async function refresh() {
    setLoading(true);
    const prototype = readPreviewSession();
    if (prototype) {
      generation.current++;
      bindPersistence(undefined);
      resetPrototypeData();
      setProfile(null);
      setGyms([]);
      setGymId('');
      setRole('');
      setPermissions([]);
      setVerified(false);
      setIsAdmin(false);
      const id = prototype.id;
      const type = prototype.type;
      const workspaceId = type === 'gym' ? `prototype-gym-${prototype.scenarioKey ?? id}` : 'demo-gym';
      const identityKind = type === 'gym' ? 'G' : type === 'individual' ? 'C' : null;
      const identityLocalId = type === 'gym' ? workspaceId : id;
      const permanentId = prototype.gyvoraId ?? (identityKind ? ensureOfflineDemoIdentity(identityKind, identityLocalId) : '');
      const demoGymId = type === 'individual' ? ensureOfflineDemoIdentity('G', 'demo-gym') : permanentId;
      const savedWorkspace = prototypeStorage().getItem(`ironhaus-demo-gym:${workspaceId}`);
      const base: State = savedWorkspace ? JSON.parse(savedWorkspace) : structuredClone(initialState);
      const sampleRequest = readSampleRequest();
      if (sampleRequest) base.gym.name = sampleRequest.gymName;
      const approvedGym = type === 'gym' ? getDemoState().gyms.find(g => g.email === prototype.scenarioKey) : undefined;
      if (approvedGym) base.gym.name = approvedGym.name;
      // Persist the fresh workspace seed so the first real save diffs against it
      // instead of recording every seed record as new activity.
      if (!savedWorkspace && type === 'gym') prototypeStorage().setItem(`ironhaus-demo-gym:${workspaceId}`, JSON.stringify(base));
      if (type === 'individual') {
        base.members = [];
        rememberDemoClient(id, prototype.name, prototype.email ?? '', prototype.contact ?? '', prototype.photo ?? '');
      }
      hydrateState(base);
      setProfile({id,full_name:prototype.name,email:prototype.email ?? '',phone:prototype.contact ?? '',photo:prototype.photo ?? '',account_type:type === 'gym' ? 'owner' : 'client',gyvora_id:permanentId} as Profile);
      const prototypeGyms = type === 'individual'
        ? getDemoState().staffRoles
            .filter((staffRole) => staffRole.userId === id)
            .map((staffRole) => {
              const gymState = readDemoGym(staffRole.gymId);
              return {
                id: staffRole.gymId,
                name: gymState.gym.name || staffRole.gymName,
                owner_id: '',
                created_at: '',
                frozen_at: null,
                freeze_note: '',
                deleted_at: null,
                deletion_note: '',
                deletion_history: [],
                admin_note: '',
                gyvora_id: ensureOfflineDemoIdentity('G', staffRole.gymId),
              };
            })
        : [];
      const primaryGym = type === 'dashboard' ? [] : [{
        id: workspaceId,
        name: base.gym.name,
        owner_id: id,
        created_at: '',
        frozen_at: null,
        freeze_note: '',
        deleted_at: null,
        deletion_note: '',
        deletion_history: [],
        admin_note: '',
        gyvora_id: demoGymId,
      }];
      setGyms([...primaryGym, ...prototypeGyms.filter((gym) => !primaryGym.some((primary) => primary.id === gym.id))]);
      setGymId(type === 'gym' ? workspaceId : '');
      if (type === 'gym') bindPersistence(async changes => {
        resetPrototypeData();
        const currentGym = getDemoState().gyms.find(g => g.email === prototype.scenarioKey);
        if (currentGym?.deletedAt || currentGym?.status === 'Frozen' || readSampleRequest()?.status === 'Rejected') throw new Error('This prototype gym is suspended.');
        const next = {...getState(), ...changes};
        writeDemoGym(workspaceId, next);
        hydrateState(next);
      });
      setRole(type === 'dashboard' ? 'super_admin' : type === 'gym' ? 'Owner' : 'Client');
      setPermissions([]); setVerified(true); setIsAdmin(false); setLoading(false);
      return;
    }
    if (!isSupabaseClientConfigured()) {
      generation.current++;
      bindPersistence(undefined);
      setProfile(null);
      setGyms([]);
      setGymId('');
      setRole('');
      setPermissions([]);
      setVerified(false);
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        generation.current++;
        setRole("");
        setPermissions([]);
        setIsAdmin(false);
        setProfile(null);
        setVerified(false);
        setGyms([]);
        setGymId("");
        bindPersistence(undefined);
        return;
      }
      const { data: p, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      setProfile(p);
      setVerified(true);
      {
        const { data: g } = await supabase.from("gyms").select("*");
        setGyms(g ?? []);
        const { data: admin } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "super_admin")
          .maybeSingle();
        setIsAdmin(!!admin);
        setRole(admin ? "super_admin" : p.account_type === "owner" ? "Owner" : "Client");
      }
    } catch (e) {
      generation.current++; bindPersistence(undefined); setProfile(null); setGyms([]); setGymId(""); setRole(""); setPermissions([]); setIsAdmin(false); setVerified(false);
      toast.error(e instanceof Error ? e.message : "Could not load your account");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh().catch(() => {});
    const syncPrototype = (event: StorageEvent) => {
      if (readPreviewSession() && event.key?.startsWith('gyvora-isolated-prototype:')) void refresh().catch(() => {});
    };
    window.addEventListener('storage', syncPrototype);

    const subscription = isSupabaseClientConfigured()
      ? supabase.auth.onAuthStateChange((event) => {
          if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) return;
          queueMicrotask(() => {
            void refresh().catch(() => {});
            void router.invalidate();
          });
        }).data.subscription
      : null;
    return () => {
      window.removeEventListener('storage', syncPrototype);
      subscription?.unsubscribe();
      bindPersistence(undefined);
    };
  }, []);
  useEffect(() => {
    if (profile && verified && !isAdmin && gyms.length === 1 && !getDemoSession())
      void loadGym(gyms[0]?.id ?? "").catch((e) => toast.error(String(e)));
  }, [profile?.id, verified, gyms, isAdmin]);
  async function logout() {
    await router.options.context?.queryClient.cancelQueries();
    router.options.context?.queryClient.clear();
    if (readPreviewSession()) {
      savePreviewSession(null); clearPrototypeStorage(); resetPrototypeData(); bindPersistence(undefined);
      setProfile(null); setGyms([]); setGymId(''); setRole(''); setPermissions([]); setVerified(false);
      await router.navigate({to:'/',replace:true});
      return;
    }
    savePreviewSession(null);
    const demo = getDemoSession();
    setDemoSession(null);
    bindPersistence(undefined);
    setGymId("");
    if (demo) {
      generation.current++;
      setProfile(null);
      setGyms([]);
      setRole("");
      setPermissions([]);
      setVerified(false);
      setLoading(false);
    } else {
      if (isSupabaseClientConfigured()) await supabase.auth.signOut();
      await refresh();
    }
    await router.navigate({ to: "/", replace: true });
  }
  return (
    <CloudContext.Provider
      value={{
        profile,
        gyms,
        gymId,
        role,
        permissions,
        verified,
        loading,
        refresh,
        selectGym: loadGym,
        logout,
      }}
    >
      {children}
    </CloudContext.Provider>
  );
}
export function AccessBoundary({ children }: { children: ReactNode }) {
  const c = useCloud();
  const loadAccountMessages = useServerFn(listAccountMessages);
  const [disabledMessages, setDisabledMessages] = useState<Awaited<ReturnType<typeof listAccountMessages>>>([]);
  const [disabledMessagesError, setDisabledMessagesError] = useState('');
  const [disabledMessagesLoading, setDisabledMessagesLoading] = useState(false);
  const hydrated = useHydrated();
  const path = useRouterState({ select: (s) => s.location.pathname });
  useDemoStore((s) => s.requests); // re-check gym access when request decisions load or change
  useDemoStore((s) => s.gyms);
  useDemoStore((s) => s.clientFreeze);
  const clientDeletion = useDemoStore((s) => s.clientDeletion);
  const adminMessages = useDemoStore((s) => s.adminMessages);
  const platformWhatsapp = useDemoStore((s) => s.platformWhatsapp);
  useEffect(() => {
    if (!c.profile?.disabled_at) {
      setDisabledMessages([]);
      setDisabledMessagesError('');
      setDisabledMessagesLoading(false);
      return;
    }
    let active = true;
    setDisabledMessagesLoading(true);
    setDisabledMessagesError('');
    void loadAccountMessages().then(messages => {
      if (active) setDisabledMessages(messages);
    }).catch(error => {
      if (active) setDisabledMessagesError(error instanceof Error ? error.message : 'Could not load account messages.');
    }).finally(() => {
      if (active) setDisabledMessagesLoading(false);
    });
    return () => { active = false; };
  }, [c.profile?.id, c.profile?.disabled_at, loadAccountMessages]);
  const publicPaths = ["/", "/register", "/auth", "/reset-password", "/forgot-password", "/client-sign-in", "/demo-signup", "/demo-recovery"];
  if (publicPaths.includes(path)) return children;
  if (!hydrated) return <div className="p-12 text-muted-foreground">Loading your account…</div>;
  const preview = readPreviewSession();
  if (preview) {
    if (c.loading || !c.profile) return <div className="p-12 text-muted-foreground">Opening prototype…</div>;
    if (preview.type === 'individual') {
      const email = preview.scenarioKey?.trim().toLowerCase() ?? '';
      const directoryId = demoClientDirectory().find(client => email && client.email.toLowerCase() === email)?.id;
      const clientIds = [...new Set([preview.id, demoUserId(email), directoryId].filter((id): id is string => !!id))];
      const deletion = clientIds.map(id => clientDeletion?.[id]).find(Boolean);
      const freeze = clientIds.map(id => demoClientFrozen(id)).find(Boolean);
      if (deletion || freeze) {
        const messages = (adminMessages ?? []).filter(message => clientIds.includes(message.to));
        return <div className="mx-auto max-w-md p-10">
          <h1 className="text-2xl">{deletion ? 'Client account banned' : 'Client account frozen'}</h1>
          <p className="mt-2 text-muted-foreground">{deletion ? 'This account has been banned by the administrator. Client pages and data are unavailable.' : 'This account has been frozen by the administrator. Client pages and data are unavailable until it is unfrozen.'}</p>
          {(deletion?.note || freeze?.note) && <p className="mt-4 whitespace-pre-wrap break-words rounded-md border bg-card p-4 text-sm"><span className="font-medium">Reason: </span>{deletion?.note || freeze?.note}</p>}
          {messages.map(message => <p key={message.id} className="mt-3 whitespace-pre-wrap break-words rounded-md border bg-card p-4 text-sm">{message.body}</p>)}
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><MessageCircle className="h-4 w-4 shrink-0 text-primary"/>{platformWhatsapp?<a className="text-primary" href={whatsappLink(platformWhatsapp,'Hello, my client account is suspended.')} target="_blank" rel="noopener noreferrer">Contact us on WhatsApp.</a>:"WhatsApp contact isn't set yet — please contact the platform administrator."}</p>
          <Button className="mt-6" onClick={()=>void c.logout()}>Log out</Button>
        </div>;
      }
    }
    const allowed = preview.type === 'dashboard' ? path.startsWith('/super-admin') : preview.type === 'individual' ? isClientPortalPath(path) : !path.startsWith('/super-admin') && !isClientPortalPath(path);
    const content = preview.type === 'gym' && path !== '/subscription-request' ? <PrototypeGymTrialBoundary>{children}</PrototypeGymTrialBoundary> : children;
    return <>{allowed ? content : <div className="p-12"><p>This page belongs to another prototype account type.</p><Button asChild className="mt-4"><Link to="/">Back to login</Link></Button></div>}</>;
  }
  if (c.loading) return <div className="p-12 text-muted-foreground">Loading your account…</div>;
  if (!c.profile)
    return (
      <div className="mx-auto max-w-md p-10">
        <h1 className="text-2xl">Sign in to GYVORA</h1>
        <Button asChild className="mt-6">
          <Link to="/">Sign in</Link>
        </Button>
      </div>
    );
  if(c.profile.disabled_at)return <div className="mx-auto max-w-md p-10"><h1 className="text-2xl">Account deactivated</h1><p className="mt-2 text-muted-foreground">This account has been disabled by the administrator.</p>{c.profile.freeze_note?.trim()?<p className="mt-4 whitespace-pre-wrap break-words rounded-md border bg-card p-4 text-sm"><span className="font-medium">Reason: </span>{c.profile.freeze_note}</p>:null}{disabledMessagesLoading&&<p role="status" className="mt-4 text-sm text-muted-foreground">Loading administrator messages…</p>}{disabledMessagesError&&<p role="alert" className="mt-4 text-sm text-destructive">{disabledMessagesError}</p>}{disabledMessages.map(message=><p key={message.id} className="mt-3 whitespace-pre-wrap break-words rounded-md border bg-card p-4 text-sm">{message.body}</p>)}<Button className="mt-6" onClick={()=>void c.logout()}>Log out</Button></div>;
  if(c.profile.frozen_at && c.profile.account_type !== 'owner' && c.role !== 'super_admin')return <div className="mx-auto max-w-md p-10"><h1 className="text-2xl">Account frozen</h1><p className="mt-2 text-muted-foreground">Your account has been frozen by the administrator. Client pages and data are unavailable until it is reactivated.</p>{c.profile.freeze_note?.trim()?<p className="mt-4 whitespace-pre-wrap break-words rounded-md border bg-card p-4 text-sm"><span className="font-medium">Reason: </span>{c.profile.freeze_note}</p>:null}<Button className="mt-6" onClick={()=>void c.logout()}>Log out</Button></div>;
  if (
    isClientPortalPath(path) ||
    path === "/subscription-request" ||
    path === "/super-admin" ||
    (c.role === "super_admin" && path.startsWith("/super-admin/")) ||
    (path === "/gyms" && c.profile.account_type !== 'owner')
  )
    return children;
  if (c.profile.account_type === 'owner' && c.role !== 'super_admin')
    return <OwnerGateBoundary>{children}</OwnerGateBoundary>;
  if (!c.gymId)
    return (
      <div className="p-10">
        <h1 className="text-2xl">Select your gym</h1>
        <Button asChild className="mt-6">
          <Link
            to={
              c.profile.account_type === "owner" && c.gyms.length === 0
                ? "/subscription-request"
                : "/gyms"
            }
          >
            Continue
          </Link>
        </Button>
      </div>
    );
  if (c.role === "Client")
    return (
      <div className="p-10">
        <h1 className="text-2xl">Gym staff access required</h1>
        <Button asChild className="mt-6">
          <Link to="/member">My account</Link>
        </Button>
      </div>
    );
  return children;
}

/** Server-enforced gate for gym owners: freeze, rejection and the one-hour pending-approval trial. */
function OwnerGateBoundary({ children }: { children: ReactNode }) {
  const c = useCloud();
  const getGate = useServerFn(getOwnerGate);
  const [whatsapp,setWhatsapp]=useState(DEFAULT_PLATFORM_WHATSAPP);
  const [gate, setGate] = useState<OwnerGate | null>(null);
  const [failed, setFailed] = useState(false);
  const fetchedAt = useRef(0);
  const [, tick] = useState(0);
  const elapsed = () => (fetchedAt.current ? Date.now() - fetchedAt.current : 0);

  useEffect(() => {
    let on = true;
    setFailed(false);
    const load=()=>getGate({})
      .then((g) => { if (on) { fetchedAt.current = Date.now(); setGate(g); } })
      .catch(() => { if (on) setFailed(true); });
    void load();
    void supabase.from('platform_settings').select('whatsapp').eq('id',true).maybeSingle().then(({data})=>{if(on)setWhatsapp(data?.whatsapp || DEFAULT_PLATFORM_WHATSAPP);});
    const poll=setInterval(()=>void load(),10000);
    const focus=()=>void load();window.addEventListener('focus',focus);
    return () => { on = false;clearInterval(poll);window.removeEventListener('focus',focus); };
  }, [c.profile?.id,c.gymId]);

  useEffect(() => {
    if (!gate || (!trialActive(gate, elapsed()) && !gate.subscriptionEnd)) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [gate?.trialEndsAt, gate?.subscriptionEnd]);

  if (failed)
    return (
      <div className="mx-auto max-w-md p-10">
        <h1 className="text-2xl">Could not verify your gym access</h1>
        <p className="mt-2 text-muted-foreground">Please try again.</p>
        <Button className="mt-6" onClick={() => void c.refresh()}>Reload</Button>
      </div>
    );
  if (!gate) return <div className="p-12 text-muted-foreground">Loading your account…</div>;
  const contact = (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
      {whatsapp ? (
        <span>Need help? <a className="text-primary" href={whatsappLink(whatsapp, `Hello, my gym account (${gate.gymName ?? 'my gym'}) is suspended and I need assistance.`)} target="_blank" rel="noopener noreferrer">Contact us on WhatsApp.</a></span>
      ) : (
        <span>Need help? WhatsApp contact isn't set yet — please reach out to the platform administrator.</span>
      )}
    </p>
  );

  if(gate.deleted)return <div className="mx-auto max-w-md p-10"><h1 className="text-2xl">Gym account suspended</h1><p className="mt-2 text-muted-foreground">Your gym has been banned or suspended by the administrator. Gym features are unavailable until it is restored.</p>{gate.deletionNote?.trim()&&<p className="mt-4 whitespace-pre-wrap break-words text-sm">Reason: {gate.deletionNote}</p>}<div className="mt-4">{contact}</div><Button className="mt-6" onClick={()=>void c.logout()}>Log out</Button></div>;

  if (gate.frozen)
    return (
      <div className="mx-auto max-w-md p-10">
        <h1 className="text-2xl">Gym account frozen</h1>
        <p className="mt-2 text-muted-foreground">Your gym account has been frozen by the administrator. The Gym Owner dashboard is unavailable until the account is reactivated.</p>
        {gate.freezeNote.trim() && (
          <p className="mt-4 rounded-md border bg-card p-4 text-sm"><span className="font-medium">Reason: </span>{gate.freezeNote}</p>
        )}
        <p className="mt-4 text-sm text-muted-foreground">Contact an administrator to learn more.</p>
        <div className="mt-2">{contact}</div>
        <Button className="mt-6" variant="outline" onClick={() => void c.logout()}>Log out</Button>
      </div>
    );

  if (gate.requestStatus === 'Rejected')
    return (
      <div className="mx-auto max-w-md p-10">
        <h1 className="text-2xl">Subscription request rejected</h1>
        <p className="mt-2 text-muted-foreground">Your request was rejected, so the Gym Owner dashboard is unavailable. Contact the administrator.</p>
        {gate.decisionNote?.trim() && <p className="mt-4 whitespace-pre-wrap break-words rounded-md border bg-card p-4 text-sm"><span className="font-medium">Reason: </span>{gate.decisionNote}</p>}
        <Button asChild className="mt-6"><Link to="/subscription-request">View subscription</Link></Button>
      </div>
    );

  if (gate.requestStatus === 'Approved' && (gate.subscriptionExpired || ownerSubscriptionExpired(gate, elapsed())))
    return (
      <div className="mx-auto max-w-md p-10">
        <h1 className="text-2xl">Subscription expired</h1>
        <p className="mt-2 text-muted-foreground">
          Your gym subscription ended{gate.subscriptionEnd ? ` on ${gate.subscriptionEnd}` : ''}. Dashboard access is unavailable. Contact platform support to renew your subscription.
        </p>
        <div className="mt-4">{contact}</div>
        <Button className="mt-6" variant="outline" onClick={() => void c.logout()}>Log out</Button>
      </div>
    );

  if (gate.requestStatus === 'Pending') {
    if (trialExpired(gate, elapsed()))
      return (
        <div className="mx-auto max-w-md p-10">
          <h1 className="text-2xl">Trial ended</h1>
          <p className="mt-2 text-muted-foreground">Your trial period has ended. Your request is awaiting administrator approval.</p>
          <div className="mt-6 flex gap-2">
            <Button asChild variant="outline"><Link to="/subscription-request">View subscription</Link></Button>
            <Button variant="outline" onClick={() => void c.logout()}>Log out</Button>
          </div>
        </div>
      );
    if (trialActive(gate, elapsed()))
      return (
        <>
          <div role="status" className="border-b bg-secondary px-4 py-2 text-center text-xs text-muted-foreground">
            Trial access · {formatRemaining(trialRemainingMs(gate, elapsed()))} remaining — your subscription request is still Pending approval.
          </div>
          {children}
        </>
      );
    return (
      <div className="mx-auto max-w-md p-10">
        <h1 className="text-2xl">Subscription approval pending</h1>
        <p className="mt-2 text-muted-foreground">The Gym Owner dashboard is unavailable until your subscription request is approved.</p>
        <Button asChild className="mt-6"><Link to="/subscription-request">View subscription</Link></Button>
      </div>
    );
  }

  if(gate.requestStatus!=='Approved'&&!gate.gymId)return <div className="mx-auto max-w-md p-10"><h1 className="text-2xl">Subscription required</h1><Button asChild className="mt-6"><Link to="/subscription-request">Choose a subscription</Link></Button></div>;
  return children;
}
