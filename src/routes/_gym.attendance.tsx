import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, saveState, type Member } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRScanner } from "@/components/QRScanner";
import { DataTable, PageHeader, Panel, StatusPill, td } from "@/components/kit";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MemberDialog } from "@/components/MemberDialog";
import { toast } from "sonner";
import { seo } from "@/lib/seo";
import { useServerFn } from "@tanstack/react-start";
import { lookupClient } from "@/lib/cloud.functions";
import { useCloud } from "@/components/CloudProvider";
import { getDemoSession, demoUserId, demoMemberId } from "@/lib/demo";
import { recordMemberCheckIn } from "@/lib/client-attendance";
import { GymPeriodFilter } from '@/components/GymPeriodFilter';
import { filterGymPeriod, gymRange, localDate, type GymPeriod } from '@/lib/gym-period';
import { membershipSessionsUsed, membershipStatus } from '@/lib/membership-link';
import { gymToday } from '@/lib/gym-reporting';
export const Route = createFileRoute("/_gym/attendance")({
  head: () => seo("Attendance", "Record real member visits with manual and QR check-in."),
  component: Attendance,
});
function Attendance() {
  const c = useCloud();
  const lookup = useServerFn(lookupClient);
  const members = useStore((s) => s.members);
  const gym = useStore((s) => s.gym);
  const today = gymToday(gym);
  const list = useStore((s) => s.attendance);
  const staffList = useStore(s => s.staffAttendance);
  const [period, setPeriod] = useState<GymPeriod>('today');
  const [custom, setCustom] = useState({ from: localDate(), to: localDate() });
  const filtered = filterGymPeriod([...list, ...staffList], gymRange(period, new Date(), custom)).sort((a,b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const [q, setQ] = useState("");
  const [scan, setScan] = useState(false);
  const [expired, setExpired] = useState<Member | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [confirmed, setConfirmed] = useState<{ name: string; status: string; expiry: string } | null>(null);
  async function check(m: Member, method: "QR" | "Manual") {
    const status = membershipStatus(m, today);
    if (status === 'Expired') {
      setExpired(m);
      return method === 'QR';
    }
    if (status === 'Upcoming') {
      toast.error('Membership has not started yet.');
      return method === 'QR';
    }
    try {
      await saveState((s) => recordMemberCheckIn(s.attendance, s.members, m.id, method, today));
      setQ("");
      toast.success("Check-in recorded");
      const days = Math.ceil((Date.parse(`${m.expiry}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86400000);
      const lastLimitedSession = m.type === 'Limited' && m.sessionsLeft <= 1;
      setConfirmed({ name: m.name, status: lastLimitedSession ? 'Expired' : days <= 7 ? "Expiring" : "Active", expiry: m.expiry });
      window.setTimeout(() => setConfirmed(null), 5000);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record check-in");
      return false;
    }
  }
  return (
    <>
      {confirmed && <div role="status" className="confirm-reveal panel mb-6 flex items-center gap-4 border-success/40 p-4"><span className="confirm-check grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success/15 text-success"><Check className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="truncate font-semibold">{confirmed.name}</div><div className="text-xs text-muted-foreground">Checked in · membership until {confirmed.expiry}</div></div><StatusPill status={confirmed.status} /></div>}
      <PageHeader
        title="Attendance"
        actions={<Button onClick={() => setScan(true)}>Scan member QR</Button>}
      />
      <Panel title="Manual check-in">
        <Input
          maxLength={100}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search member"
        />
        {q && (
          <ul className="mt-4 space-y-2">
            {members
              .filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
              .slice(0, 8)
              .map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-4">
                  <span>{m.name} · {m.plan} · {m.type === 'Limited' ? `${membershipStatus(m, today) === 'Expired' ? 'Expired · ' : ''}${membershipSessionsUsed(m)}/${m.sessionsTotal}` : membershipStatus(m, today)}</span>
                  <Button size="sm" onClick={() => check(m, "Manual")}>
                    Check in
                  </Button>
                </li>
              ))}
          </ul>
        )}
      </Panel>
      <Panel title={period === 'today' ? "Today's attendance" : 'Attendance'} className="mt-6">
        <GymPeriodFilter period={period} onPeriod={setPeriod} custom={custom} onCustom={setCustom}/>
        <p className="mb-3 text-sm text-muted-foreground">Total attendance: {filtered.length}</p>
        <DataTable head={["#", "Member / Employee", "Date", "Time", "Method"]}>
          {filtered.map((x, index) => (
              <tr key={x.id}>
                <td className={td}>{index + 1}</td>
                <td className={td}>{x.name}</td>
                <td className={td}>{x.date}</td>
                <td className={td}>{x.time}</td>
                <td className={td}>{x.method}</td>
              </tr>
            ))}
        </DataTable>
        {!filtered.length && (
          <p className="py-6 text-sm text-muted-foreground">No check-ins in this period.</p>
        )}
      </Panel>
      <Dialog open={!!expired && !renewOpen} onOpenChange={(v) => { if (!v) setExpired(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Membership expired</DialogTitle></DialogHeader>
          <p className="break-words">{expired?.name}'s {expired?.type === 'Limited' && expired.sessionsLeft <= 0 ? 'session limit has been used' : `membership expired on ${expired?.expiry}`}. Renew it to record their check-in.</p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setExpired(null)}>Cancel</Button>
            <Button onClick={() => setRenewOpen(true)}>Renew</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <MemberDialog
        open={renewOpen && !!expired}
        onOpenChange={(v) => { setRenewOpen(v); if (!v) setExpired(null); }}
        member={expired}
        renew
        onSaved={(updated) => {
          setRenewOpen(false);
          setExpired(null);
          void check(updated, "QR");
        }}
      />
      <QRScanner
        open={scan}
        onClose={() => setScan(false)}
        onScan={async (value) => {
          const id = value.replace(/^ironhaus:member:/, "");
          let m = members.find((x) => x.id === id || x.memberQrId === id || x.gyvoraId === id);
          if (!m && getDemoSession())
            m = members.find((x) => demoMemberId(x.clientId ?? demoUserId(x.email)) === id);
          if (!m && !getDemoSession()) {
            try {
              const profile = await lookup({ data: { gymId: c.gymId, memberId: id } });
              m = members.find((x) => x.clientId === profile.id);
            } catch {
              /* no authorized match */
            }
          }
          if (!m) {
            toast.error("Member QR is not linked to this gym.");
            return false;
          }
          return await check(m, "QR");
        }}
      />
    </>
  );
}
