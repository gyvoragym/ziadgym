import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ScanLine } from "lucide-react";
import { QRScanner } from "@/components/QRScanner";
import { useCloud } from "@/components/CloudProvider";
import { getDemoSession, useDemoStore, selectSessionClient } from "@/lib/demo";
import { findSessionClient } from "@/lib/session-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DataTable, Field, PageHeader, Panel, selectCls, td } from "@/components/kit";
import { useStore, saveState, consumeSession, type Session } from "@/lib/store";
import { GymPeriodFilter } from '@/components/GymPeriodFilter';
import { filterGymPeriod, gymRange, localDate, type GymPeriod } from '@/lib/gym-period';
import { sessionSchema } from "@/lib/validation";
import { money as egp, currencyOf } from "@/lib/store";
import { toast } from "sonner";
import { seo } from "@/lib/seo";
import { generateId } from "@/lib/utils";
import { gymToday, sessionTotal } from '@/lib/gym-reporting';
export const Route = createFileRoute("/_gym/sessions")({
  head: () => seo("Daily sessions", "Register, edit and manage IronHaus daily sessions."),
  component: Sessions,
});
const blank = (): Session => ({
  id: generateId(),
  name: "",
  trainer: "",
  price: 150,
  date: localDate(),
  type: "Personal Training",
  method: "Cash",
});
function Sessions() {
  const members = useStore((s) => s.members);
  const trainers = useStore((s) => s.trainers);
  const sessions = useStore((s) => s.sessions);
  const gym = useStore(s => s.gym);
  const today = gymToday(gym);
  const [period, setPeriod] = useState<GymPeriod>('today');
  const [custom, setCustom] = useState({ from: today, to: today });
  const filtered = filterGymPeriod(sessions, gymRange(period, new Date(`${today}T12:00:00`), custom));
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<Session>(() => ({ ...blank(), date: today }));
  const [editing, setEditing] = useState<Session | null>(null);
  const c = useCloud();
  const [scan, setScan] = useState(false);
  const [selected, setSelected] = useState("");
  const savedClient = useDemoStore((s) => s.sessionClients[c.gymId] ?? "");
  useEffect(() => {
    if (getDemoSession() && savedClient) {
      const member = members.find((m) => m.id === savedClient);
      if (member) {
        setSelected(member.id);
        setF((x) => ({ ...x, name: member.name, memberId: member.id }));
      }
    }
  }, [c.gymId, savedClient, members]);
  const match =
    members.find((m) => m.id === (editing ? f.memberId : selected)) ??
    members.find((m) => m.name.toLowerCase() === f.name.trim().toLowerCase());
  const up = (p: Partial<Session>) => setF((x) => ({ ...x, ...p }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = sessionSchema.safeParse({ ...f, memberId: match?.id });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check session details");
      return;
    }
    if (!editing && match?.type === "Limited" && match.sessionsLeft <= 0) {
      toast.error(`${match.name} has no sessions left`);
      return;
    }
    setBusy(true);
    try {
    await saveState((s) => ({
      sessions: editing
        ? s.sessions.map((x) => (x.id === editing.id ? parsed.data : x))
        : [parsed.data, ...s.sessions],
      ...(!editing && match?.type === "Limited"
        ? { members: s.members.map((m) => (m.id === match.id ? consumeSession(m) : m)) }
        : {}),
    }));
    setEditing(null);
    setF({ ...blank(), date: today });
    toast.success('Session saved');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not save session'); }
    finally { setBusy(false); }
  }
  function lookup(value: string) {
    const member = findSessionClient(members, value);
    if (!member) return false;
    setSelected(member.id);
    up({ name: member.name, memberId: member.id });
    if (getDemoSession()) selectSessionClient(c.gymId, member.id);
    toast.success(`${member.name} selected`);
    return true;
  }
  const fields = (
    <>
      <Field label="Client Name">
        <Input
          aria-label="Client Name"
          required
          maxLength={100}
          list="session-members"
          value={f.name}
          onChange={(e) => {
            setSelected("");
            up({ name: e.target.value, memberId: undefined });
            if (getDemoSession()) selectSessionClient(c.gymId, "");
          }}
        />
        <datalist id="session-members">
          {members.map((m) => (
            <option key={m.id}>{m.name}</option>
          ))}
        </datalist>
        {match && (
          <div className="space-y-1 border-l-2 border-primary py-2 pl-3 text-sm">
            <p className="font-semibold">
              {match.name} · {match.id}
            </p>
            <p className="break-all text-muted-foreground">
              {match.email} · {match.phone}
            </p>
            <p className="text-muted-foreground">
              {match.plan} · {match.type} · Expires {match.expiry}
            </p>
          </div>
        )}
        {match?.type === "Limited" && (
          <span className="text-xs text-primary">{match.sessionsLeft} sessions left</span>
        )}
      </Field>
      <Field label="Trainer">
        <select
          className={selectCls}
          value={f.trainer}
          onChange={(e) => up({ trainer: e.target.value })}
        >
          <option value="">No trainer</option>
          {trainers.map((t) => (
            <option key={t.id}>{t.name}</option>
          ))}
        </select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Session Price (${currencyOf()})`}>
          <Input
            type="number"
            required
            min={0}
            step="0.01"
            value={f.price}
            onChange={(e) => up({ price: Number(e.target.value) })}
          />
        </Field>
        <Field label="Session Date">
          <Input
            type="date"
            required
            value={f.date}
            onChange={(e) => up({ date: e.target.value })}
          />
        </Field>
        <Field label="Session type">
          <Input
            required
            maxLength={100}
            value={f.type}
            onChange={(e) => up({ type: e.target.value })}
          />
        </Field>
        <Field label="Payment">
          <select
            className={selectCls}
            value={f.method}
            onChange={(e) => up({ method: e.target.value })}
          >
            {["Cash", "Card", "Wallet"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
      </div>
    </>
  );
  return (
    <>
      <PageHeader
        title="Daily sessions"
        actions={
          <Button onClick={() => setScan(true)}>
            <ScanLine className="h-4 w-4" />
            Scan client QR
          </Button>
        }
      />
      <QRScanner
        open={scan}
        onClose={() => setScan(false)}
        onScan={lookup}
        title="Scan client QR"
        manualLabel="Member ID"
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Register session" className="min-w-0 lg:col-span-2">
          <form className="space-y-4" onSubmit={save}>
            {!editing && fields}
            <Button type="submit" disabled={Boolean(editing) || busy} className="w-full">
              {busy ? 'Saving…' : 'Save session'}
            </Button>
          </form>
        </Panel>
        <Panel title="Sessions" className="min-w-0 lg:col-span-3">
          <GymPeriodFilter period={period} onPeriod={setPeriod} custom={custom} onCustom={setCustom}/>
          <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"><span className="text-muted-foreground">Total Sessions: {filtered.length}</span><span className="font-semibold">Total Price: {egp(sessionTotal(filtered), currencyOf(gym))}</span></div>
          <DataTable head={["#", "Client", "Trainer", "Date", "Price", "Actions"]}>
            {filtered.map((s, index) => (
              <tr key={s.id}>
                <td className={td}>{index + 1}</td>
                <td className={td}>{s.name}</td>
                <td className={td}>{s.trainer}</td>
                <td className={td}>{s.date}</td>
                <td className={td}>{egp(s.price)}</td>
                <td className={td}>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditing(s);
                      setF({ ...s });
                    }}
                  >
                    Edit session
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
          {!filtered.length && (
            <p className="py-6 text-sm text-muted-foreground">No sessions in this period.</p>
          )}
        </Panel>
      </div>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(v) => {
          if (!v) {
            setEditing(null);
            setF(blank());
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit session</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={save}>
            {editing && fields}
            <DialogFooter>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  if (!editing || !window.confirm("Delete this session?")) return;
                  setBusy(true);
                  try {
                  await saveState((s) => ({ sessions: s.sessions.filter((x) => x.id !== editing.id) }));
                  setEditing(null);
                  setF(blank());
                  toast.success('Session cancelled');
                  } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not cancel session'); }
                  finally { setBusy(false); }
                }}
              >
                Delete
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setF(blank());
                }}
              >
                Cancel
              </Button>
              <Button disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
