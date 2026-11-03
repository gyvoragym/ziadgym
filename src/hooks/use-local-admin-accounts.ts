import { useCallback, useEffect, useState } from "react";
import { fetchLocalAdminAccounts, type LocalAdminAccount } from "@/lib/local-admin-accounts";
import { readPreviewSession } from "@/lib/preview-session";

export function useLocalAdminAccounts() {
  const token = readPreviewSession()?.adminToken ?? "";
  const [accounts, setAccounts] = useState<LocalAdminAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!token) {
      setAccounts([]);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setAccounts(await fetchLocalAdminAccounts(token));
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setError(message === "Administrator access required." ? "" : message || "تعذر تحميل الحسابات المسجلة.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
    if (!token) return;
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh, token]);

  return { accounts, loading, error, refresh };
}
