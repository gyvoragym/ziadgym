import { demoClientDirectory, rememberDemoClient } from "./demo";
import { ensureOfflineDemoIdentity } from "./demo-identities";
import { prototypeStorage } from "./prototype-storage";
import type { PreviewAccountType } from "./preview-session";

const directoryKey = "gyvora-local-prototype-account-directory";

export type PrototypeDirectoryAccount = {
  id: string;
  type: "gym" | "individual";
  gyvora_id: string;
  full_name: string;
  email: string;
  phone: string;
  created_at: string;
};

function readDirectory(): PrototypeDirectoryAccount[] {
  try {
    const data: unknown = JSON.parse(prototypeStorage().getItem(directoryKey) ?? "[]");
    return Array.isArray(data) ? (data as PrototypeDirectoryAccount[]) : [];
  } catch {
    return [];
  }
}

function writeDirectory(rows: PrototypeDirectoryAccount[]) {
  prototypeStorage().setItem(directoryKey, JSON.stringify(rows));
}

export function saveLocalPrototypeAccount(input: {
  type: Exclude<PreviewAccountType, "dashboard">;
  scenarioKey: string;
  name: string;
  email: string;
  phone: string;
}) {
  const id = `preview-${input.scenarioKey.trim().toLowerCase()}`;
  const kind = input.type === "gym" ? "G" : "C";
  const row: PrototypeDirectoryAccount = {
    id,
    type: input.type,
    gyvora_id: ensureOfflineDemoIdentity(kind, id),
    full_name:
      input.name.trim() || (input.type === "gym" ? "Prototype Gym Owner" : "Prototype Client"),
    email: input.email.trim(),
    phone: input.phone.trim(),
    created_at: new Date().toISOString(),
  };
  const rows = readDirectory();
  const previous = rows.find((account) => account.id === id);
  writeDirectory(
    previous
      ? rows.map((account) =>
          account.id === id ? { ...row, created_at: previous.created_at } : account,
        )
      : [row, ...rows],
  );
  if (input.type === "individual") {
    rememberDemoClient(id, row.full_name, row.email, row.phone);
  }
  return row;
}

export function rememberScannedPrototypeAccount(
  profile: Pick<PrototypeDirectoryAccount, "type" | "gyvora_id" | "full_name" | "email" | "phone">,
) {
  const rows = readDirectory();
  const previous = rows.find((account) => account.gyvora_id === profile.gyvora_id);
  const row: PrototypeDirectoryAccount = {
    id: previous?.id ?? `scanned-${profile.gyvora_id}`,
    ...profile,
    created_at: previous?.created_at ?? new Date().toISOString(),
  };
  writeDirectory(
    previous
      ? rows.map((account) => (account.gyvora_id === row.gyvora_id ? row : account))
      : [row, ...rows],
  );
  return row;
}

export function localPrototypeAccounts() {
  const rows = readDirectory();
  const clients = demoClientDirectory();
  return rows.map((row) => {
    if (row.type !== "individual") return row;
    const client = clients.find((entry) => entry.id === row.id);
    if (!client) return row;
    return {
      ...row,
      full_name: client.name,
      email: client.email,
      phone: client.phone,
    };
  });
}

export function findLocalPrototypeAccountByQr(value: string) {
  const normalized = value
    .trim()
    .replace(/^ironhaus:member:/, "")
    .replace(/^gyvora:/i, "");
  return (
    localPrototypeAccounts().find(
      (account) => account.gyvora_id.toLowerCase() === normalized.toLowerCase(),
    ) ?? null
  );
}
