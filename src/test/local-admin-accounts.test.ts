import { describe, expect, it, vi } from "vitest";
import { fetchLocalAdminAccounts } from "@/lib/local-admin-accounts";

describe("local admin account API client", () => {
  it("uses the signed admin session and validates account rows", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        users: [{
          id: "client-id",
          fullName: "Client Name",
          phone: "+201000000000",
          email: "client@example.com",
          accountType: "individual",
          qrId: "private-qr-id",
          createdAt: "2026-10-30T12:00:00.000Z",
          isActive: true,
        }],
      }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    try {
      await expect(fetchLocalAdminAccounts("signed-token")).resolves.toMatchObject([
        { id: "client-id", accountType: "individual", fullName: "Client Name" },
      ]);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users",
        expect.objectContaining({ headers: { authorization: "Bearer signed-token" } }),
      );
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("surfaces API errors and rejects malformed rows", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    try {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Administrator access required." }), { status: 403 }));
      await expect(fetchLocalAdminAccounts("expired")).rejects.toThrow("Administrator access required.");
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ users: [{}] }), { status: 200 }));
      await expect(fetchLocalAdminAccounts("signed-token")).rejects.toThrow("invalid data");
    } finally {
      fetchMock.mockRestore();
    }
  });
});
