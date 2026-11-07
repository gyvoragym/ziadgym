import { readPreviewSession } from "./preview-session";

export type LocalAdminAccount = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  accountType: "gym" | "individual";
  qrId: string;
  createdAt: string;
  isActive: boolean;
  status: "active" | "frozen" | "deleted";
  adminNote: string;
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
    typeof account["isActive"] === "boolean" &&
    (account["status"] === undefined || ["active", "frozen", "deleted"].includes(String(account["status"]))) &&
    (account["adminNote"] === undefined || typeof account["adminNote"] === "string")
  );
}

async function responseJson(response: Response) {
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error || "Could not update registered account.");
  return result;
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
  return result.users.map(account => ({
    ...account,
    status: account.status ?? (account.isActive ? "active" : "deleted"),
    adminNote: account.adminNote ?? "",
  }));
}

async function adminRequest(path: string, method: string, body: Record<string, unknown>) {
  const token = readPreviewSession()?.adminToken;
  if (!token) throw new Error("Administrator session expired. Sign in again.");
  const apiBase = (import.meta.env["VITE_GYVORA_API_URL"] || "").replace(/\/+$/, "");
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return responseJson(response);
}

export async function updateLocalAdminAccount(id: string, details: { name: string; email: string; phone: string }) {
  await adminRequest(`/api/admin/users/${encodeURIComponent(id)}`, "PATCH", details);
}

export async function manageLocalAdminAccount(id: string, action: "freeze" | "unfreeze" | "delete", note = "", message = "") {
  await adminRequest(`/api/admin/users/${encodeURIComponent(id)}/lifecycle`, "POST", { action, note, message });
}
