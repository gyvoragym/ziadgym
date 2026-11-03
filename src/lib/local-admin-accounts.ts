export type LocalAdminAccount = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  accountType: "gym" | "individual";
  qrId: string;
  createdAt: string;
  isActive: boolean;
};

function isLocalAdminAccount(value: unknown): value is LocalAdminAccount {
  if (!value || typeof value !== "object") return false;
  const account = value as Record<string, unknown>;
  return (
    typeof account["id"] === "string" &&
    typeof account["fullName"] === "string" &&
    typeof account["phone"] === "string" &&
    typeof account["email"] === "string" &&
    (account["accountType"] === "gym" || account["accountType"] === "individual") &&
    typeof account["qrId"] === "string" &&
    typeof account["createdAt"] === "string" &&
    typeof account["isActive"] === "boolean"
  );
}

export async function fetchLocalAdminAccounts(token: string): Promise<LocalAdminAccount[]> {
  if (!token) throw new Error("Administrator session expired. Sign in again.");
  const apiBase = (import.meta.env["VITE_GYVORA_API_URL"] || "").replace(/\/+$/, "");
  const response = await fetch(`${apiBase}/api/admin/users`, {
    headers: { authorization: `Bearer ${token}` },
    credentials: "include",
  });
  const result = await response.json().catch(() => ({})) as {
    error?: string;
    users?: unknown;
  };
  if (!response.ok) throw new Error(result.error || "Could not load registered accounts.");
  if (!Array.isArray(result.users) || !result.users.every(isLocalAdminAccount)) {
    throw new Error("The accounts service returned invalid data.");
  }
  return result.users;
}
