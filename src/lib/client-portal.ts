import { prototypeStorage } from './prototype-storage';
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCloud } from "@/components/CloudProvider";
import {
  demoUserId,
  getDemoSession,
  getDemoState,
  readDemoGym,
  rememberDemoMemberships,
} from "./demo";
import type { Member, Workout, Plan, Gym } from "./store";
import { demoIdentity } from './demo-identities';
import { membershipStatus } from './membership-link';
import { parseAccountQrPayload } from './account-qr-payload';

export type ClientGym = {
  id: string;
  gyvoraId?: string | undefined;
  name: string;
  location: string;
  image: string;
  description: string;
};
export type MembershipSnapshot = Member & { gym: string; gymId: string };
export type ClientLink = { gymId: string; favorite: boolean };
export function resolveGymLookup(value: string) {
  const input = value.trim();
  const profile = parseAccountQrPayload(input);
  if (input.startsWith("GYVORA:PROFILE:")) {
    return profile?.type === "gym" ? profile.gyvora_id : "";
  }
  return input.replace(/^ironhaus:gym:/i, "").trim();
}
export function findGymByLookup(directory: ClientGym[], value: string) {
  const lookup = resolveGymLookup(value).toLocaleLowerCase();
  if (!lookup) return undefined;
  return directory.find(
    (gym) =>
      gym.id.toLocaleLowerCase() === lookup ||
      gym.gyvoraId?.toLocaleLowerCase() === lookup,
  );
}
const key = (id: string) => `ironhaus-client-links:${id}`;
export function readClientLinks(id: string): ClientLink[] {
  try {
    return JSON.parse(prototypeStorage().getItem(key(id)) ?? "[]");
  } catch {
    return [];
  }
}
export function updateClientLink(
  id: string,
  gymId: string,
  action: "join" | "leave" | "favorite",
): ClientLink[] {
  const rows = readClientLinks(id);
  const found = rows.find((r) => r.gymId === gymId);
  const next =
    action === "leave"
      ? rows.filter((r) => r.gymId !== gymId)
      : found
        ? rows.map((r) =>
            r.gymId === gymId && action === "favorite" ? { ...r, favorite: !r.favorite } : r,
          )
        : [...rows, { gymId, favorite: false }];
  prototypeStorage().setItem(key(id), JSON.stringify(next));
  return next;
}
export function demoDirectory(): ClientGym[] {
  const prototypeGyms = Array.from({ length: prototypeStorage().length }, (_, index) => prototypeStorage().key(index))
    .flatMap(key => key?.startsWith('ironhaus-demo-gym:prototype-gym-') ? [key.slice('ironhaus-demo-gym:'.length)] : [])
    .map(id => {
      const scope = id.slice('prototype-gym-'.length);
      const approved = getDemoState().gyms.find(g => g.email === scope);
      return { id, name: approved?.name ?? readDemoGym(id).gym.name };
    });
  const list = [
    { id: "demo-gym", name: "IRONHAUS Performance Club" },
    { id: "demo-gym-north", name: "IRONHAUS North" },
    ...getDemoState().gyms,
    ...prototypeGyms,
  ];
  return list.map((g) => {
    const s = readDemoGym(g.id, g.id === "demo-gym");
    return {
      id: g.id,
      gyvoraId: demoIdentity('G',g.id),
      name: g.name,
      location: s.gym.location,
      image: s.gym.cover,
      description: s.gym.description,
    };
  });
}
export function demoMemberships(id: string): MembershipSnapshot[] {
  return demoDirectory().flatMap((g) => {
    const members = readDemoGym(g.id, g.id === "demo-gym").members;
    rememberDemoMemberships(g.id, g.name, members);
    return members
      .filter((m) => (m.clientId ?? demoUserId(m.email)) === id)
      .map((m) => ({ ...m, gym: g.name, gymId: g.id }));
  });
}
export function isCurrentMembership(m: MembershipSnapshot, date: string) {
  return ['Active', 'Expiring'].includes(membershipStatus(m, date));
}
export function useClientGyms() {
  const c = useCloud();
  const [directory, setDirectory] = useState<ClientGym[]>([]);
  const [links, setLinks] = useState<ClientLink[]>([]);
  const [memberships, setMemberships] = useState<MembershipSnapshot[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    setDirectory([]);
    setLinks([]);
    setMemberships([]);
    const id = c.profile?.id;
    if (!id) return;
    let active = true;
    if (getDemoSession()) {
      setDirectory(demoDirectory());
      setLinks(readClientLinks(id));
      setMemberships(demoMemberships(id));
      return;
    }
    const refresh = async () => {
      const [d, l, m] = await Promise.all([
        supabase.rpc("client_gym_directory"),
        supabase.from("client_gym_links").select("*").eq("user_id", id),
        supabase.from("gym_records").select("*").eq("kind", "members").eq("client_id", id),
      ]);
      if (!active) return;
      const err = d.error ?? l.error ?? m.error;
      setError(err?.message ?? "");
      const gyms = (d.data ?? []) as unknown as ClientGym[];
      setDirectory(gyms);
      setLinks((l.data ?? []).map((x) => ({ gymId: x.gym_id, favorite: x.favorite })));
      setMemberships(
        (m.data ?? []).map((x) => ({
          ...(x.data as unknown as Member),
          gymId: x.gym_id,
          gym: gyms.find((g) => g.id === x.gym_id)?.name ?? "Gym",
        })),
      );
    };
    void refresh().catch((e) => {
      if (active) setError(e instanceof Error ? e.message : "Could not load memberships.");
    });
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh().catch((e) => {
          if (active) setError(e instanceof Error ? e.message : "Could not refresh memberships.");
        });
      }
    }, 30_000);
    const onFocus = () => {
      void refresh().catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Could not refresh memberships.");
      });
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, [c.profile?.id, c.gyms]);
  async function change(gymId: string, action: "join" | "leave" | "favorite") {
    if (!c.profile) throw new Error("Sign in first");
    const id = c.profile.id;
    if (getDemoSession()) {
      setLinks(updateClientLink(id, gymId, action));
      return;
    }
    const current = links.find((l) => l.gymId === gymId);
    if(action !== 'leave') {
      const {data:allowed,error}=await supabase.rpc('client_has_gym_approval',{g:gymId});
      if(error)throw error;
      if(!allowed)throw new Error('A gym owner must add or approve you before you can join this gym.');
    }
    const result =
      action === "leave"
        ? await supabase.from("client_gym_links").delete().eq("user_id", id).eq("gym_id", gymId)
        : await supabase
            .from("client_gym_links")
            .upsert({
              user_id: id,
              gym_id: gymId,
              favorite: action === "favorite" ? !current?.favorite : (current?.favorite ?? false),
            });
    if (result.error) throw result.error;
    setLinks(
      action === "leave"
        ? links.filter((l) => l.gymId !== gymId)
        : [
            ...links.filter((l) => l.gymId !== gymId),
            {
              gymId,
              favorite: action === "favorite" ? !current?.favorite : (current?.favorite ?? false),
            },
          ],
    );
  }
  const joined = directory
    .filter((g) => links.some((l) => l.gymId === g.id) || memberships.some((m)=>m.gymId===g.id))
    .sort(
      (a, b) =>
        Number(links.find((l) => l.gymId === b.id)?.favorite ?? false) -
        Number(links.find((l) => l.gymId === a.id)?.favorite ?? false),
    );
  const accessible = directory.filter(
    (g) =>
      links.some((l) => l.gymId === g.id) ||
      memberships.some((m) => m.gymId === g.id) ||
      (getDemoSession() ? getDemoState().staffRoles.some((r) => r.userId === c.profile?.id && r.gymId === g.id) : c.gyms.some(r=>r.id===g.id)),
  );
  return { directory, links, joined, accessible, memberships, error, change };
}
export type ClientGymContent = {
  profile: Partial<Gym> & {currency?: string};
  plans: Plan[];
  workouts: Workout[];
  products: { id?: string; name: string; price: number; category?: string; image?: string | undefined }[];
  trainers: {name: string; specialty: string; bio: string; image?: string | undefined; notes?: string | undefined}[];
};
export async function clientGymContent(id: string): Promise<ClientGymContent> {
  if (getDemoSession()) {
    if (!demoDirectory().some(g => g.id === id)) throw new Error("This gym is unavailable");
    const s = readDemoGym(id, id === "demo-gym");
    return {
      profile: s.gym,
      plans: s.plans,
      workouts: s.workouts,
      products: s.products.map((p) => ({ name: p.name, price: p.price, image: p.image })),
      trainers: s.trainers.map((t) => ({
        name: t.name,
        specialty: t.specialty,
        bio: t.bio,
        notes: t.notes,
        image: t.image,
      })),
    };
  }
  const { data, error } = await supabase.rpc("client_gym_content", { g: id });
  if (error) throw error;
  return data as unknown as ClientGymContent;
}
