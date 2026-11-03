import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCloud } from "@/components/CloudProvider";
import { ClientShell } from "@/components/ClientShell";
import { DataTable, td } from "@/components/kit";
import { getDemoSession, readDemoGym, demoUserId, readDemoMembershipHistory } from "@/lib/demo";
import { seo } from "@/lib/seo";
import { demoDirectory, useClientGyms } from "@/lib/client-portal";
import type { AttendanceEvent } from "@/lib/store";
export const Route = createFileRoute("/member/attendance")({
  head: () => seo("My attendance", "Your chronological IronHaus gym visits and check-in times."),
  component: Attendance,
});
function Attendance() {
  const c = useCloud();
  const p = useClientGyms();
  const [list, setList] = useState<Array<AttendanceEvent & { gym: string }>>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!c.profile) return;
    if (getDemoSession()) {
      const mine = demoDirectory().flatMap((g) => {
        const state = readDemoGym(g.id, g.id === "demo-gym");
        const ids = [...state.members
          .filter((m) => (m.clientId ?? demoUserId(m.email)) === c.profile?.id)
          .map((m) => m.id),...readDemoMembershipHistory(c.profile?.id??'').filter(r=>r.gymId===g.id).map(r=>r.definition.id)];
        return state.attendance
          .filter((e) => e.memberId && ids.includes(e.memberId))
          .map((e) => ({ ...e, gym: g.name }));
      });
      setList(mine.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)));
      setLoading(false);
      return;
    }
    void supabase
      .from("gym_records")
      .select("*")
      .eq("kind", "attendance")
      .eq("client_id", c.profile.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else
          setList(
            (data ?? [])
              .map((x) => ({
                ...(x.data as unknown as AttendanceEvent),
                gym: p.directory.find((g) => g.id === x.gym_id)?.name ?? "Gym",
              }))
              .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
          );
        setLoading(false);
      });
  }, [c.profile?.id, p.directory.length]);
  return (
    <ClientShell title="Attendance History">
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <DataTable head={["Gym Name", "Day and Date", "Check-in Time"]}>
        {list.map((x) => (
          <tr key={x.id}>
            <td className={td}>{x.gym}</td>
            <td className={td}>
              {new Date(x.date + "T12:00:00").toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </td>
            <td className={td}>{x.time}</td>
          </tr>
        ))}
      </DataTable>
      {!list.length && (
        <p className="py-8 text-muted-foreground">
          {loading ? "Loading visits…" : "No visits recorded yet."}
        </p>
      )}
    </ClientShell>
  );
}
