import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCloud } from "@/components/CloudProvider";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  getDemoSession,
  markDemoAdminMessageRead,
  pendingDemoAssignments,
  pendingDemoInvitations,
  useDemoStore,
} from "@/lib/demo";
import { listAccountMessages, markAccountMessagesRead } from "@/lib/account-messages.functions";
import {
  listLocalAccountMessages,
  markLocalAccountMessagesRead,
} from "@/lib/local-account-messages";
import { readPreviewSession } from "@/lib/preview-session";

type CloudInvitation = Database["public"]["Tables"]["staff_invitations"]["Row"];
type CloudMessage = Awaited<ReturnType<typeof listAccountMessages>>[number];
type ClientMessage = {
  id: string;
  body: string;
  created_at: string;
  read: boolean;
};

export function useClientNotifications() {
  const cloud = useCloud();
  const demo = !!getDemoSession();
  const preview = readPreviewSession();
  const localAccount = !demo && !!preview && preview.type !== "dashboard";
  const allInvitations = useDemoStore((state) => state.invitations);
  const allAssignments = useDemoStore((state) => state.assignments);
  const adminMessages = useDemoStore((state) => state.adminMessages);
  const allDemoMessages = useMemo(
    () => (adminMessages ?? []).filter((message) => message.to === cloud.profile?.id),
    [adminMessages, cloud.profile?.id],
  );
  const fetchMessages = useServerFn(listAccountMessages);
  const markCloudMessagesRead = useServerFn(markAccountMessagesRead);
  const query = useQuery({
    queryKey: ["client-notifications", cloud.profile?.id],
    enabled: !demo && !!cloud.profile,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (localAccount) {
        return { invitations: [] as CloudInvitation[], messages: await listLocalAccountMessages() };
      }
      const [invitationResult, messages] = await Promise.all([
        supabase.rpc("my_staff_invitations"),
        fetchMessages(),
      ]);
      if (invitationResult.error) throw invitationResult.error;
      return {
        invitations: (invitationResult.data ?? []) as unknown as CloudInvitation[],
        messages,
      };
    },
  });

  const invitations = demo
    ? pendingDemoInvitations(cloud.profile?.email ?? "", allInvitations)
    : (query.data?.invitations ?? []).filter((invitation) => invitation.status === "Pending");
  const assignments =
    demo && cloud.profile ? pendingDemoAssignments(cloud.profile.id, allAssignments) : [];
  const messages: ClientMessage[] =
    demo || localAccount
      ? [
          ...allDemoMessages.map((message) => ({
            id: message.id,
            body: message.body,
            created_at: message.createdAt,
            read: (message.readBy ?? []).includes(cloud.profile?.id ?? ""),
          })),
          ...(localAccount
            ? (
                (query.data?.messages ?? []) as Awaited<ReturnType<typeof listLocalAccountMessages>>
              ).map((message) => ({
                id: `local-${message.id}`,
                body: message.body,
                created_at: message.created_at,
                read: !!message.read_at,
              }))
            : []),
        ]
      : ((query.data?.messages ?? []) as CloudMessage[]).map((message) => ({
          id: message.id,
          body: message.body,
          created_at: message.created_at,
          read: !!message.read_at,
        }));

  async function markMessageRead(messageId: string) {
    if (!cloud.profile) throw new Error("Sign in to read this message");
    if (demo) markDemoAdminMessageRead(cloud.profile.id, messageId);
    else if (localAccount && messageId.startsWith("local-")) {
      await markLocalAccountMessagesRead([messageId.slice(6)]);
    } else if (localAccount) markDemoAdminMessageRead(cloud.profile.id, messageId);
    else await markCloudMessagesRead({ data: { ids: [messageId] } });
    if (!demo) await query.refetch();
  }

  async function refetch() {
    if (!demo) await query.refetch();
  }

  return {
    invitations,
    assignments,
    messages,
    unreadCount:
      invitations.length + assignments.length + messages.filter((message) => !message.read).length,
    isLoading: !demo && query.isPending,
    error: !demo ? query.error : null,
    refetch,
    markMessageRead,
  };
}
