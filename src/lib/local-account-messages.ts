import { readPreviewSession } from "./preview-session";

export type LocalAccountMessage = {
  id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

function apiBase() {
  return (import.meta.env["VITE_GYVORA_API_URL"] || "").replace(/\/+$/, "");
}

async function responseJson(response: Response) {
  const result = await response.json().catch(() => ({})) as {
    error?: string;
    messages?: unknown;
    message?: unknown;
  };
  if (!response.ok) throw new Error(result.error || "Could not access account messages.");
  return result;
}

function isMessage(value: unknown): value is LocalAccountMessage {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row["id"] === "string" &&
    typeof row["body"] === "string" &&
    typeof row["created_at"] === "string" &&
    (typeof row["read_at"] === "string" || row["read_at"] === null)
  );
}

export async function sendLocalAdminMessage(targetId: string, body: string) {
  const token = readPreviewSession()?.adminToken;
  if (!token) throw new Error("Administrator session expired. Sign in again.");
  const response = await fetch(`${apiBase()}/api/admin/users/${encodeURIComponent(targetId)}/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ body }),
  });
  const result = await responseJson(response);
  if (!isMessage(result.message)) throw new Error("The message service returned invalid data.");
}

export async function listLocalAccountMessages(): Promise<LocalAccountMessage[]> {
  const response = await fetch(`${apiBase()}/api/users/me/messages`, {
    credentials: "include",
  });
  const result = await responseJson(response);
  if (!Array.isArray(result.messages) || !result.messages.every(isMessage)) {
    throw new Error("The message service returned invalid data.");
  }
  return result.messages;
}

export async function markLocalAccountMessagesRead(ids: string[]) {
  const response = await fetch(`${apiBase()}/api/users/me/messages/read`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ids }),
  });
  await responseJson(response);
}
