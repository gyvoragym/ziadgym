import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { ClientShell } from "@/components/ClientShell";
import { AssignedWorkouts } from "@/components/AssignedWorkouts";
import { useCloud } from "@/components/CloudProvider";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getDemoSession, respondDemoInvitation } from "@/lib/demo";
import { useClientNotifications } from "@/hooks/use-client-notifications";
import { seo } from "@/lib/seo";
import { toast } from "sonner";

export const Route = createFileRoute("/member/notifications")({
  head: () =>
    seo(
      "Client notifications",
      "Your gym invitations, administration messages and workout assignments.",
    ),
  component: Notifications,
});

function Notifications() {
  const cloud = useCloud();
  const navigate = useNavigate();
  const demo = !!getDemoSession();
  const notifications = useClientNotifications();
  const [busy, setBusy] = useState("");

  async function respond(id: string, accept: boolean) {
    setBusy(id);
    try {
      if (demo) {
        respondDemoInvitation(id, accept);
      } else {
        const { error } = await supabase.rpc("respond_invitation", {
          invitation_id: id,
          accept,
        });
        if (error) throw error;
      }
      await notifications.refetch();
      await cloud.refresh();
      toast.success(accept ? "Invitation accepted" : "Invitation declined");
      if (accept) await navigate({ to: "/member" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not respond to invitation");
    } finally {
      setBusy("");
    }
  }

  async function markRead(id: string) {
    setBusy(id);
    try {
      await notifications.markMessageRead(id);
      toast.success("Message marked as read");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update message");
    } finally {
      setBusy("");
    }
  }

  return (
    <ClientShell title="Notifications">
      {notifications.error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          Could not load notifications. Please refresh and try again.
        </p>
      )}
      {notifications.isLoading && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Loading notifications…
        </p>
      )}
      {notifications.messages.length > 0 && (
        <section className="mb-6 border-b pb-5">
          <h2 className="text-lg font-semibold">Messages from GYVORA Administration</h2>
          <ul className="mt-3 space-y-3">
            {notifications.messages.map((message) => (
              <li key={message.id} className="rounded-md border bg-card p-4">
                <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    From GYVORA Administration · {new Date(message.created_at).toLocaleString()}
                  </p>
                  {message.read ? (
                    <span className="text-xs text-muted-foreground">Read</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === message.id}
                      onClick={() => void markRead(message.id)}
                    >
                      <Check className="h-4 w-4" />
                      Mark as read
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <AssignedWorkouts />
      <div className="space-y-5">
        {notifications.invitations.map((invitation) => (
          <section key={invitation.id} className="border-b pb-5">
            <h2 className="text-lg font-semibold">
              {"gym_name" in invitation
                ? String(invitation.gym_name ?? "Gym")
                : cloud.gyms.find((gym) => gym.id === invitation.gym_id)?.name ?? "Gym"}
            </h2>
            <p className="mt-2">Invited as {invitation.role}</p>
            <p className="text-sm text-muted-foreground">
              {invitation.full_name} · {new Date(invitation.created_at).toLocaleDateString()} ·
              Expires {new Date(invitation.expires_at).toLocaleDateString()}
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                disabled={busy === invitation.id}
                onClick={() => void respond(invitation.id, true)}
              >
                Accept
              </Button>
              <Button
                variant="outline"
                disabled={busy === invitation.id}
                onClick={() => void respond(invitation.id, false)}
              >
                Decline
              </Button>
            </div>
          </section>
        ))}
      </div>
      {!notifications.isLoading &&
        !notifications.error &&
        !notifications.messages.length &&
        !notifications.invitations.length &&
        !notifications.assignments.length && (
          <p className="text-muted-foreground">No notifications yet.</p>
        )}
    </ClientShell>
  );
}
