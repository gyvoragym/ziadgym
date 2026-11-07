import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCloud } from "@/components/CloudProvider";
import { useClientGyms } from "@/lib/client-portal";
import { ClientGymCard } from "@/components/ClientGymCard";
import { getDemoSession, useDemoStore } from "@/lib/demo";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/mock";
import { toast } from "sonner";
import {
  QrCode,
  CalendarCheck,
  ClipboardList,
  Bell,
  Star,
  Plus,
  LogOut,
} from "lucide-react";
import { Avatar, StatusPill } from "@/components/kit";
import { seo } from "@/lib/seo";
import { AppBrand } from '@/components/AppBrand';
import { membershipDaysRemaining, membershipSessionsUsed, membershipStatus } from '@/lib/membership-link';
import { localDate } from '@/lib/gym-period';
import { useClientNotifications } from "@/hooks/use-client-notifications";

export const Route = createFileRoute("/member/")({
  head: () => seo("My account", "Your membership status, QR code and training at a glance."),
  component: MemberHome,
});

const actions = [
  { label: "My QR", icon: QrCode, to: "/member/qr" },
  { label: "Attendance History", icon: CalendarCheck, to: "/member/attendance" },
  { label: "Workout Program", icon: ClipboardList, to: "/member/workouts" },
  { label: "Join a Gym", icon: Plus, to: "/member/join" },
] as const;

function MemberHome() {
  const [day, setDay] = useState(localDate());
  useEffect(() => {
    const timer = window.setInterval(() => setDay(localDate()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const c = useCloud();
  const notifications = useClientNotifications();
  const p = useClientGyms();
  const roles = useDemoStore((s) => s.staffRoles);
  const orderedMemberships = [...p.memberships].sort((a, b) => b.start.localeCompare(a.start));
  const membership = orderedMemberships.find(m => !['Expired', 'Upcoming'].includes(membershipStatus(m, day)))
    ?? orderedMemberships.find(m => membershipStatus(m, day) !== 'Upcoming')
    ?? null;
  const status = membership ? membershipStatus(membership, day) : 'Not linked';
  const remaining = membership && membership.type !== 'Limited'
    ? membershipDaysRemaining(membership.expiry, day)
    : 0;
  const sessionsUsed = membership ? membershipSessionsUsed(membership) : 0;
  const progress = membership?.type === 'Limited'
    ? membership.sessionsTotal ? Math.min(100, sessionsUsed / membership.sessionsTotal * 100) : 0
    : 50;
  const staffGyms = c.gyms.filter(
    (gym) =>
      !p.joined.some((joined) => joined.id === gym.id) &&
      (!getDemoSession() || roles.some((role) => role.userId === c.profile?.id && role.gymId === gym.id)),
  );
  return (
    <div className="mx-auto min-h-screen max-w-md px-5 py-8">
      <AppBrand className="mb-6" />
      <div className="flex items-center justify-between">
        <Link to="/member/settings" className="flex items-center gap-3">
          <Avatar initials={initials(c.profile?.full_name ?? "")} />
          <div>
            <div className="text-xs text-muted-foreground">Good evening</div>
            <div className="font-display font-semibold">{c.profile?.full_name}</div>
          </div>
        </Link>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="icon">
            <Link to="/member/notifications" aria-label={notifications.unreadCount ? `Notifications (${notifications.unreadCount} unread)` : "Notifications"} className="relative">
              <Bell className="h-4 w-4" />
              {notifications.unreadCount > 0 && <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{notifications.unreadCount > 99 ? "99+" : notifications.unreadCount}</span>}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Sign out"
            onClick={() => void c.logout()}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {notifications.error && <p role="alert" className="mt-3 text-xs text-destructive">Could not load notifications.</p>}
      <div className="panel mt-6 p-6">
        <div className="flex items-center justify-between">
          <span className="eyebrow">{membership?.plan ?? "No membership"}</span>
          <StatusPill status={status} />
        </div>
        <div className="mt-6 flex items-end gap-2">
          <span className={`font-display font-semibold text-primary ${membership?.type === 'Limited' ? 'text-3xl' : 'text-5xl'}`}>{membership?.type === 'Limited' ? `${sessionsUsed}/${membership.sessionsTotal}` : remaining}</span>
          <span className="pb-2 text-sm text-muted-foreground">{membership?.type === 'Limited' ? 'sessions used / total' : 'days remaining'}</span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>{membership?.gym ?? "No membership gym"}</span>
          <span>{membership?.type === 'Limited' ? 'Session limit' : membership ? `Expires ${membership.expiry}` : ""}</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <Link
            key={a.label}
            to={a.to}
            className="panel flex flex-col gap-6 p-4 transition-colors hover:border-primary/40"
          >
            <a.icon className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">{a.label}</span>
          </Link>
        ))}
      </div>
      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">My Joined Gyms</h2>
        {p.joined.map((g) => (
          <ClientGymCard
            key={g.id}
            gym={g}
            actions={
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${p.links.find((l) => l.gymId === g.id)?.favorite ? "Unfavorite" : "Favorite"} ${g.name}`}
                  onClick={() => void p.change(g.id, "favorite")}
                >
                  <Star
                    className={
                      p.links.find((l) => l.gymId === g.id)?.favorite
                        ? "h-5 w-5 fill-primary text-primary"
                        : "h-5 w-5"
                    }
                  />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`Leave ${g.name}? You can rejoin later if the gym adds or approves you again.`))
                      void p.change(g.id, "leave").then(() => toast.success(`You left ${g.name}`)).catch((e) => toast.error(e instanceof Error ? e.message : String(e)));
                  }}
                >
                  Leave Gym
                </Button>
              </div>
            }
          />
        ))}
        {!p.joined.length && <p className="text-sm text-muted-foreground">No joined gyms yet.</p>}
        {!!staffGyms.length && <h2 className="pt-4 text-xl font-semibold">Gym Roles</h2>}
        {staffGyms.map((g) => (
            <ClientGymCard
              key={g.id}
              gym={
                p.directory.find((x) => x.id === g.id) ?? {
                  id: g.id,
                  name: g.name,
                  image: "",
                  location: "",
                  description: "",
                }
              }
              actions={
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-primary">
                    {roles.find((r) => r.userId === c.profile?.id && r.gymId === g.id)?.role ??
                      (c.role === "Client" ? "Staff" : c.role)}
                  </p>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/gyms">Open workspace</Link>
                  </Button>
                </div>
              }
            />
          ))}
      </section>
    </div>
  );
}
