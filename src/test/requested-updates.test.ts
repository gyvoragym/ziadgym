import { beforeEach, describe, it, expect } from "vitest";
import { findSessionClient } from "@/lib/session-client";
import { members } from "@/lib/mock";
import {
  getDemoState,
  createDemoInvitation,
  changeDemoInvitation,
  savePlatformExpense,
  deletePlatformExpense,
  filterExpenses,
  platformTotals,
  selectSessionClient,
} from "@/lib/demo";
import { prototypeStorage } from "@/lib/prototype-storage";
import { resetDemoTestState } from "./demo-fixtures";

beforeEach(() => resetDemoTestState());

describe("session client lookup", () => {
  it("matches an existing current-gym client by QR or Member ID without creating one", () => {
    const before = members.length;
    expect(findSessionClient(members, "ironhaus:member:M-1040")?.name).toBe("Omar Khaled");
    expect(findSessionClient(members, "M-1040")?.id).toBe("M-1040");
    expect(members.length).toBe(before);
  });
  it("rejects another gym or staff QR", () => {
    expect(findSessionClient(members.slice(1), "ironhaus:member:M-1040")).toBeUndefined();
    expect(findSessionClient(members, "ironhaus:staff:M-1040")).toBeUndefined();
    expect(findSessionClient(members, "")).toBeUndefined();
  });
  it("persists client selection separately per gym", () => {
    selectSessionClient("gym-a", "M-1040");
    selectSessionClient("gym-b", "M-1041");
    expect(getDemoState().sessionClients["gym-a"]).toBe("M-1040");
    expect(
      JSON.parse(prototypeStorage().getItem("ironhaus-demo-data-v1") ?? "{}").sessionClients["gym-b"],
    ).toBe("M-1041");
  });
});
describe("prototype invitations", () => {
  it("saves invitee and gym details without adding staff", () => {
    const row = createDemoInvitation(
      "invite-a",
      "Gym A",
      "Reception Person",
      "person@test.com",
      "Reception",
    );
    expect(row.full_name).toBe("Reception Person");
    expect(row.email).toBe("person@test.com");
    expect(row.gym_id).toBe("invite-a");
    expect(row.status).toBe("Pending");
    expect(new Date(row.expires_at).getTime()).toBeGreaterThan(new Date(row.created_at).getTime());
    expect(row.accepted_by).toBeNull();
  });
  it("prevents duplicate active email, role and gym invitations", () => {
    createDemoInvitation("dup-a", "Gym A", "Same", "same@test.com", "Trainer");
    expect(() =>
      createDemoInvitation("dup-a", "Gym A", "Same", "SAME@test.com", "Trainer"),
    ).toThrow("active invitation");
    expect(createDemoInvitation("dup-b", "Gym B", "Same", "same@test.com", "Trainer").gym_id).toBe(
      "dup-b",
    );
  });
  it("cancels pending invitations and does not renew cancelled invitations", () => {
    const row = createDemoInvitation("cancel-a", "Gym A", "Cancel", "cancel@test.com", "Admin");
    changeDemoInvitation("cancel-a", row.id, "cancel");
    expect(getDemoState().invitations.find((i) => i.id === row.id)?.status).toBe("Cancelled");
    expect(() => changeDemoInvitation("cancel-a", row.id, "resend")).toThrow();
  });
  it("resends only invitations belonging to the selected gym", () => {
    const row = createDemoInvitation("renew-a", "Gym A", "Renew", "renew@test.com", "Reception");
    expect(() => changeDemoInvitation("other-gym", row.id, "resend")).toThrow();
    changeDemoInvitation("renew-a", row.id, "resend");
    expect(getDemoState().invitations.find((i) => i.id === row.id)?.status).toBe("Pending");
  });
});
describe("platform demo expenses", () => {
  const expense = {
    id: "expense-test",
    name: "Hosting",
    category: "Software",
    amount: 1200,
    date: "2026-10-18",
    method: "Card",
    notes: "Platform hosting",
  };
  it("persists, edits and deletes an expense without touching gym records", () => {
    savePlatformExpense(expense);
    expect(
      JSON.parse(prototypeStorage().getItem("ironhaus-demo-data-v1") ?? "{}").expenses.find(
        (e: { id: string }) => e.id === "expense-test",
      ).amount,
    ).toBe(1200);
    savePlatformExpense({ ...expense, amount: 1500 });
    expect(getDemoState().expenses.find((e) => e.id === "expense-test")?.amount).toBe(1500);
    deletePlatformExpense("expense-test");
    expect(getDemoState().expenses.some((e) => e.id === "expense-test")).toBe(false);
  });
  it("filters by search, category and inclusive date range", () => {
    expect(
      filterExpenses([expense], "hosting", "Software", "2026-10-18", "2026-10-18"),
    ).toHaveLength(1);
    expect(filterExpenses([expense], "", "Marketing", "", "")).toHaveLength(0);
    expect(filterExpenses([expense], "", "", "2026-10-19", "")).toHaveLength(0);
  });
  it("calculates selected-period demo net as revenue minus expenses, including negative net", () => {
    const r = [{ id: "r", date: "2026-10-18", amount: 800, gymName: "Demo Gym" }];
    expect(platformTotals(r, [expense], new Date("2026-10-01"), new Date("2026-10-31"))).toEqual({
      revenue: 800,
      expenses: 1200,
      net: -400,
    });
  });
});
