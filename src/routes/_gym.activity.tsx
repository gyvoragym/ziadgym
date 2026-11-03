import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DataTable, PageHeader, Panel, td } from "@/components/kit";
import { useCloud } from "@/components/CloudProvider";
import { getDemoSession } from "@/lib/demo";
import { readGymEvents } from "@/lib/gym-notifications-demo";
import { getGymNotices } from "@/lib/gym-notifications.functions";
import { gymToday } from "@/lib/gym-reporting";
import { useStore } from "@/lib/store";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_gym/activity")({
  head: () => seo("Activity logs", "A full audit trail of actions taken by your staff."),
  component: Activity,
});

function Activity() {
  const cloud = useCloud();
  const gym = useStore((state) => state.gym);
  const fetchNotices = useServerFn(getGymNotices);
  const demo = !!getDemoSession();
  const {
    data: events = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["gym-activity-log", cloud.gymId, demo],
    enabled: !!cloud.gymId,
    queryFn: () =>
      demo
        ? readGymEvents(cloud.gymId)
        : fetchNotices({ data: { gymId: cloud.gymId, day: gymToday(gym) } }),
  });
  const activity = events.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <PageHeader title="Activity logs" subtitle="Every action, by every user" />
      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          Could not load activity. Please try again.
        </p>
      )}
      <Panel>
        <DataTable head={["Type", "Action", "Date", "Time"]}>
          {activity.map((event) => (
            <tr key={event.id}>
              <td className={`${td} font-medium`}>{event.type}</td>
              <td className={td}>{event.description}</td>
              <td className={`${td} text-muted-foreground`}>{event.createdAt.slice(0, 10)}</td>
              <td className={`${td} text-muted-foreground`}>
                {new Date(event.createdAt).toLocaleTimeString()}
              </td>
            </tr>
          ))}
          {!isLoading && !error && !activity.length && (
            <tr>
              <td className={`${td} text-muted-foreground`} colSpan={4}>
                No activity recorded yet.
              </td>
            </tr>
          )}
          {isLoading && (
            <tr>
              <td className={`${td} text-muted-foreground`} colSpan={4}>
                Loading activity…
              </td>
            </tr>
          )}
        </DataTable>
      </Panel>
    </>
  );
}
