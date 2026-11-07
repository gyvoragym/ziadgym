import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, DataTable, td } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRScanner } from "@/components/QRScanner";
import { seo } from "@/lib/seo";
import {
  findLocalPrototypeAccountByQr,
  localPrototypeAccounts,
  rememberScannedPrototypeAccount,
  type PrototypeDirectoryAccount,
} from "@/lib/prototype-account-directory";
import { ScanLine } from "lucide-react";
import { parseAccountQrPayload } from "@/lib/account-qr-payload";

export const Route = createFileRoute("/super-admin/prototype-signups")({
  head: () =>
    seo(
      "Prototype signups",
      "Review shared prototype Gym and Client profiles and look them up by QR code.",
    ),
  component: PrototypeSignups,
});

function PrototypeSignups() {
  const [accounts, setAccounts] = useState<PrototypeDirectoryAccount[]>([]);
  const [selected, setSelected] = useState<PrototypeDirectoryAccount | null>(null);
  const [query, setQuery] = useState("");
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    const refresh = () => setAccounts(localPrototypeAccounts());
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return accounts.filter(
      (account) =>
        !needle ||
        [account.full_name, account.email, account.phone, account.gyvora_id, account.type].some(
          (value) => value.toLowerCase().includes(needle),
        ),
    );
  }, [accounts, query]);

  function scan(value: string) {
    const profile = parseAccountQrPayload(value);
    if (profile) {
      const account = rememberScannedPrototypeAccount(profile);
      setSelected(account);
      setAccounts(localPrototypeAccounts());
      return true;
    }
    const account = findLocalPrototypeAccountByQr(value);
    if (!account) throw new Error("No saved prototype profile matches this QR or GYVORA ID.");
    setSelected(account);
    return true;
  }

  function refreshAccounts() {
    setAccounts(localPrototypeAccounts());
  }

  return (
    <div>
      <PageHeader
        title="Prototype Signups"
        subtitle="Demo profiles saved in this browser. They are not verified real accounts and have no production access."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshAccounts}>
              Refresh
            </Button>
            <Button variant="outline" onClick={() => setScanOpen(true)}>
              <ScanLine className="h-4 w-4" />
              Scan QR
            </Button>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, phone, email or GYVORA ID"
          className="max-w-md"
        />
        <span className="text-sm text-muted-foreground">{accounts.length} saved profiles</span>
      </div>
      <DataTable head={["Type", "Name", "Phone", "Email", "Unique GYVORA ID", "Created"]}>
        {filtered.map((account) => (
          <tr
            key={account.id}
            className={selected?.id === account.id ? "bg-secondary/50" : undefined}
          >
            <td className={td}>{account.type === "gym" ? "Gym" : "Client"}</td>
            <td className={td}>
              <button
                className="text-left font-medium hover:text-primary"
                onClick={() => setSelected(account)}
              >
                {account.full_name}
              </button>
            </td>
            <td className={td}>{account.phone || "—"}</td>
            <td className={td}>{account.email || "—"}</td>
            <td className={td}>
              <button
                className="break-all font-mono text-primary hover:underline"
                onClick={() => setSelected(account)}
              >
                {account.gyvora_id}
              </button>
            </td>
            <td className={td}>{new Date(account.created_at).toLocaleString()}</td>
          </tr>
        ))}
      </DataTable>
      {!filtered.length && (
        <p className="py-5 text-sm text-muted-foreground">No matching prototype profiles.</p>
      )}
      {selected && (
        <section
          className="mt-6 rounded-lg border bg-card p-5"
          aria-label="Scanned profile details"
        >
          <h2 className="text-lg font-semibold">Profile found</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Account type</dt>
              <dd>{selected.type === "gym" ? "Gym" : "Client"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd>{selected.full_name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{selected.phone || "Not provided"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{selected.email || "Not provided"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">GYVORA ID</dt>
              <dd className="break-all font-mono">{selected.gyvora_id}</dd>
            </div>
          </dl>
        </section>
      )}
      <QRScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={scan}
        title="Scan a prototype account QR"
        manualLabel="GYVORA ID or QR value"
      />
    </div>
  );
}
