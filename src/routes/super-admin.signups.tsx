import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { DataTable, PageHeader, td } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { seo } from "@/lib/seo";
import { listPlatformSignups } from "@/lib/platform-signups.functions";
import { readPreviewSession } from "@/lib/preview-session";
import { fetchLocalAdminAccounts } from "@/lib/local-admin-accounts";

type Signup = {
  id: string;
  name: string;
  email: string;
  phone: string;
  accountType: string;
  gyvoraId: string;
  provider: string;
  createdAt: string;
  qrId?: string;
};

export const Route = createFileRoute("/super-admin/signups")({
  head: () =>
    seo(
      "New signups",
      "Review real GYVORA accounts registered through the connected authentication service.",
    ),
  component: PlatformSignups,
});

function PlatformSignups() {
  const fetchSignups = useServerFn(listPlatformSignups);
  const [accounts, setAccounts] = useState<Signup[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [accountWindow, setAccountWindow] = useState("newest 500 accounts shown");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const localAdminToken = readPreviewSession()?.adminToken;
      if (localAdminToken) {
        const users = await fetchLocalAdminAccounts(localAdminToken);
        setAccountWindow("all registered accounts shown");
        const cairoDate = (date: Date) => new Intl.DateTimeFormat("en-CA", {
          timeZone: "Africa/Cairo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(date);
        const today = cairoDate(new Date());
        setAccounts(users.map((user) => ({
          id: user.id,
          name: user.fullName,
          email: user.email,
          phone: user.phone,
          accountType: user.accountType,
          gyvoraId: "",
          qrId: user.qrId,
          provider: "GYVORA account service",
          createdAt: user.createdAt,
        })));
        setTodayCount(users.filter((user) => cairoDate(new Date(user.createdAt)) === today).length);
      } else {
        const result = await fetchSignups({});
        setAccountWindow("newest 500 accounts shown");
        setAccounts(result.accounts);
        setTodayCount(result.todayCount);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load new signups.");
    } finally {
      setLoading(false);
    }
  }, [fetchSignups]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <div>
      <PageHeader
        title="New Signups"
        subtitle={`${todayCount} account${todayCount === 1 ? "" : "s"} registered today · ${accountWindow}`}
        actions={
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />
      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <DataTable head={["Type", "Name", "Phone", "Email", "Provider", "GYVORA / QR ID", "Registered"]}>
        {accounts.map((account) => (
          <tr key={account.id}>
            <td className={td}>
              {account.accountType === "owner" || account.accountType === "gym"
                ? "Gym"
                : account.accountType === "client" || account.accountType === "individual"
                  ? "Client"
                  : account.accountType}
            </td>
            <td className={td}>{account.name || "—"}</td>
            <td className={td}>{account.phone || "—"}</td>
            <td className={td}>{account.email || "—"}</td>
            <td className={td}>{account.provider}</td>
            <td className={td}>{account.gyvoraId || account.qrId || "—"}</td>
            <td className={td}>{new Date(account.createdAt).toLocaleString()}</td>
          </tr>
        ))}
      </DataTable>
      {!loading && !error && !accounts.length && (
        <p className="py-6 text-muted-foreground">No registered accounts found.</p>
      )}
    </div>
  );
}
