import { createServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPlatformSignups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("is_super_admin");
    if (roleError || !allowed) throw new Error("Administrator access required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const users: User[] = [];
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error("Could not load registered accounts.");
      users.push(...data.users);
      if (data.users.length < 1000) break;
      if (page === 100)
        throw new Error("The account list is too large to load safely. Contact support.");
    }

    const sorted = users
      .filter((user) => !!user.phone || typeof user.user_metadata["phone"] === "string")
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const cairoDateFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const cairoDate = (date: Date) => {
      const dateParts = cairoDateFormatter.formatToParts(date);
      return `${dateParts.find((part) => part.type === "year")?.value}-${dateParts.find((part) => part.type === "month")?.value}-${dateParts.find((part) => part.type === "day")?.value}`;
    };
    const today = cairoDate(new Date());
    const todayCount = sorted.filter(
      (user) => cairoDate(new Date(user.created_at)) === today,
    ).length;
    const latest = sorted.slice(0, 500);
    const ids = latest.map((user) => user.id);
    const { data: profiles, error: profileError } = ids.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id,account_type,full_name,email,phone,gyvora_id")
          .in("id", ids)
      : { data: [], error: null };
    if (profileError) throw new Error("Could not load registered account profiles.");

    return {
      todayCount,
      accounts: latest.map((user) => {
        const profile = profiles?.find((row) => row.id === user.id);
        const identities = user.identities ?? [];
        return {
          id: user.id,
          name:
            profile?.full_name ||
            String(user.user_metadata["full_name"] ?? user.user_metadata["name"] ?? ""),
          email:
            profile?.email ||
            (user.email?.endsWith("@accounts.gyvora.invalid") ? "" : user.email || ""),
          phone: profile?.phone || user.phone || "",
          accountType:
            profile?.account_type || String(user.user_metadata["account_type"] ?? "client"),
          gyvoraId: profile?.gyvora_id ?? "",
          provider: String(user.app_metadata["provider"] ?? identities[0]?.provider ?? "unknown"),
          createdAt: user.created_at,
        };
      }),
    };
  });
