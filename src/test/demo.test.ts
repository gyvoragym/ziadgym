import { describe, it, expect, beforeEach } from "vitest";
import {
  matchDemoAccount, approveRequest, rejectRequest, editGym, setGymStatus, deleteGym,
  editClient, removeClientGym, deleteClient, getDemoState, periodRange, inRange,
  registerDemoAccount, findDemoAccount, updateDemoAccount, getDemoAccounts, demoDestination, sessionKindFor, setDemoSession,
  isSeededDashboardRecord,
} from "@/lib/demo";

describe("dashboard demo records", () => {
  it("identifies only the built-in gym, client, and request rows", () => {
    for (const id of ["req-1", "req-2", "req-3", "gym-1", "gym-4", "cli-1", "cli-6"]) {
      expect(isSeededDashboardRecord(id)).toBe(true);
    }
    for (const id of ["prototype-gym-new", "demo-user-client@example.com", "req-custom"]) {
      expect(isSeededDashboardRecord(id)).toBe(false);
    }
  });
});

describe("demo accounts", () => {
  it("matches the super admin demo credentials", () => {
    expect(matchDemoAccount("zeyad salama", "zeyadsalama", "zeyadsalama")).toBe("super");
  });
  it("matches the gym owner demo credentials", () => {
    expect(matchDemoAccount("zeyad salama1", "gym email", "zeyad salama1")).toBe("owner");
  });
  it("rejects wrong passwords and unknown users", () => {
    expect(matchDemoAccount("zeyad salama", "zeyadsalama", "wrong")).toBeNull();
    expect(matchDemoAccount("someone", "else", "x")).toBeNull();
  });
});

describe("demo platform store", () => {
  let reqId: string;
  beforeEach(() => {
    const pending = getDemoState().requests.find((r) => r.status === "Pending");
    reqId = pending?.id ?? "";
  });

  it("approving a request moves it to Approved Gyms with matching plan dates", () => {
    const before = getDemoState();
    const req = before.requests.find((r) => r.id === reqId)!;
    approveRequest(reqId);
    const after = getDemoState();
    expect(after.requests.find((r) => r.id === reqId)?.status).toBe("Approved");
    const gym = after.gyms.find((g) => g.name === req.gymName);
    expect(gym).toBeDefined();
    expect(gym?.plan).toBe(req.plan);
    expect(after.revenue.some((r) => r.gymName === req.gymName)).toBe(true);
  });

  it("rejecting a request does not create a gym", () => {
    const pending = getDemoState().requests.find((r) => r.status === "Pending");
    if (!pending) return;
    rejectRequest(pending.id);
    expect(getDemoState().requests.find((r) => r.id === pending.id)?.status).toBe("Rejected");
    expect(getDemoState().gyms.some((g) => g.email === pending.email && g.name === pending.gymName && g.start === new Date().toISOString().slice(0, 10))).toBe(false);
  });

  it("freeze and reactivate toggle subscription status without deleting the gym", () => {
    const gym = getDemoState().gyms[0]!;
    setGymStatus(gym.id, "Frozen");
    expect(getDemoState().gyms.find((g) => g.id === gym.id)?.status).toBe("Frozen");
    setGymStatus(gym.id, "Active");
    expect(getDemoState().gyms.find((g) => g.id === gym.id)?.status).toBe("Active");
  });

  it("editing a gym plan recalculates the subscription end date", () => {
    const gym = getDemoState().gyms[0]!;
    editGym(gym.id, { name: gym.name, plan: "Basic" });
    const updated = getDemoState().gyms.find((g) => g.id === gym.id)!;
    expect(updated.plan).toBe("Basic");
    expect(updated.end).not.toBe(gym.end);
    editGym(gym.id, { name: gym.name, plan: gym.plan });
  });

  it("deleting a gym retains records and suspends only that gym", () => {
    const gym = getDemoState().gyms.at(-1);
    if(!gym)throw new Error('Missing test gym');
    const count = getDemoState().gyms.length;
    setDemoSession('super');
    deleteGym(gym.id);
    expect(getDemoState().gyms.length).toBe(count);
    expect(getDemoState().gyms.find((g) => g.id === gym.id)?.deletedAt).toBeTruthy();
    expect(getDemoState().gyms.filter(g=>g.deletedAt)).toHaveLength(1);
  });

  it("removing a client from one gym keeps their other memberships", () => {
    const multi = getDemoState().clients.find((c) => c.gyms.length > 1)!;
    const removed = multi.gyms[0]!;
    removeClientGym(multi.id, removed);
    const after = getDemoState().clients.find((c) => c.id === multi.id)!;
    expect(after.gyms).not.toContain(removed);
    expect(after.gyms.length).toBe(multi.gyms.length - 1);
  });

  it("deleting a client removes the whole client", () => {
    const c = getDemoState().clients[getDemoState().clients.length - 1]!;
    deleteClient(c.id);
    expect(getDemoState().clients.some((x) => x.id === c.id)).toBe(false);
  });

  it("editing a client updates name and phone", () => {
    const c = getDemoState().clients[0]!;
    editClient(c.id, { name: "Edited Name", phone: "+20 000 000 0000" });
    const after = getDemoState().clients.find((x) => x.id === c.id)!;
    expect(after.name).toBe("Edited Name");
    editClient(c.id, { name: c.name, phone: c.phone });
  });
});

describe("period ranges", () => {
  it("last 7 days spans 7 calendar days", () => {
    const { from, to } = periodRange("7d");
    const days = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
    expect(days(to) - days(from)).toBe(6);
  });
  it("last month stays within the previous month", () => {
    const { from, to } = periodRange("lastMonth");
    expect(from.getDate()).toBe(1);
    expect(to.getMonth()).toBe(from.getMonth());
  });
  it("inRange includes boundary dates", () => {
    const { from, to } = periodRange("month");
    expect(inRange(new Date().toISOString().slice(0, 10), from, to)).toBe(true);
    expect(inRange("1999-01-01", from, to)).toBe(false);
  });
});

describe("demo account registry", () => {
  it("registers an account and finds it by email + password", () => {
    const acc = registerDemoAccount("Test User", "test@demo.com", "password123", "gym");
    expect(acc.type).toBe("gym");
    expect(acc.skipped).toBe(false);
    expect(findDemoAccount("test@demo.com", "password123")?.email).toBe("test@demo.com");
    expect(findDemoAccount("test@demo.com", "wrongpass")).toBeNull();
  });
  it("rejects a duplicate email with a different password", () => {
    registerDemoAccount("Dup", "dup@demo.com", "password123", "individual");
    expect(() => registerDemoAccount("Dup", "dup@demo.com", "otherpass1", "gym")).toThrow();
    expect(registerDemoAccount("Dup", "dup@demo.com", "password123", "individual").type).toBe("individual");
  });
  it("routes each account type to its area", () => {
    expect(demoDestination({ type: "dashboard", skipped: false })).toBe("/super-admin");
    expect(demoDestination({ type: "individual", skipped: false })).toBe("/member");
    expect(demoDestination({ type: "gym", skipped: false })).toBe("/subscription-request");
    expect(demoDestination({ type: "gym", skipped: true })).toBe("/dashboard");
  });
  it("keeps a pending request after Skip and persists account state", () => {
    registerDemoAccount("Skipper", "skip@demo.com", "password123", "gym");
    updateDemoAccount("skip@demo.com", { requestPending: true });
    updateDemoAccount("skip@demo.com", { skipped: true });
    const acc = findDemoAccount("skip@demo.com", "password123")!;
    expect(acc.requestPending).toBe(true);
    expect(acc.skipped).toBe(true);
    expect(demoDestination(acc)).toBe("/dashboard");
    expect(getDemoAccounts().some((a) => a.email === "skip@demo.com")).toBe(true);
  });
  it("maps account types to session kinds", () => {
    expect(sessionKindFor("dashboard")).toBe("super");
    expect(sessionKindFor("gym")).toBe("owner");
    expect(sessionKindFor("individual")).toBe("individual");
  });
});
