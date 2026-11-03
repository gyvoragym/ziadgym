import { beforeEach, describe, expect, it } from "vitest";
import { registrationSchema } from "@/lib/registration";
import { approveRequest, demoDestination, demoOwnerHasAccess, getDemoState, registerDemoAccount, setDemoSession, submitDemoGymRequest, updateDemoAccount } from "@/lib/demo";

describe("Gym Account demo registration and subscription", () => {
  beforeEach(() => localStorage.clear());

  it("requires contact for normal Gym Account signup", () => {
    expect(registrationSchema.safeParse({ full_name: "Fake Gym", phone: "", email: "", password: "whatever1", account_type: "gym" }).success).toBe(false);
  });

  it("Send creates one pending request even when sent twice", () => {
    registerDemoAccount("Owner", "o@x", "password1", "gym");
    setDemoSession("owner", "o@x", { name: "Owner" });
    const before = getDemoState().requests.length;
    submitDemoGymRequest("Gym", "Monthly Plan");
    submitDemoGymRequest("Gym", "Annual Plan");
    expect(getDemoState().requests.length).toBe(before + 1);
    expect(getDemoState().requests[0]?.status).toBe("Pending");
  });

  it("Skip grants demo access but keeps the request Pending", () => {
    const acc = registerDemoAccount("Owner2", "o2@x", "password1", "gym");
    setDemoSession("owner", "o2@x");
    submitDemoGymRequest("Gym", "Monthly Plan");
    expect(demoOwnerHasAccess(acc)).toBe(false);
    updateDemoAccount("o2@x", { skipped: true });
    expect(demoOwnerHasAccess({ ...acc, skipped: true })).toBe(true);
    expect(getDemoState().requests.find(r => r.email === "o2@x")?.status).toBe("Pending");
  });

  it("approved account goes to the dashboard without Skip", () => {
    const acc = registerDemoAccount("Owner3", "o3@x", "password1", "gym");
    setDemoSession("owner", "o3@x");
    const req = submitDemoGymRequest("Gym", "Annual Plan");
    approveRequest(req.id);
    expect(demoDestination(acc)).toBe("/dashboard");
  });
});

import { rejectRequest } from "@/lib/demo";
describe("rejected gym requests", () => {
  it("keep a skipped account out of the dashboard after rejection", () => {
    localStorage.clear();
    const acc = registerDemoAccount("Rej Gym", "rej@example.com", "password1", "gym");
    setDemoSession("owner", "rej@example.com");
    submitDemoGymRequest("Rej Gym", "Monthly Plan");
    updateDemoAccount("rej@example.com", { skipped: true });
    const id = getDemoState().requests.find(r => r.email === "rej@example.com")!.id;
    rejectRequest(id);
    expect(getDemoState().requests.find(r => r.id === id)!.status).toBe("Rejected");
    expect(demoOwnerHasAccess({ email: "rej@example.com", skipped: true })).toBe(false);
    expect(demoDestination({ ...acc, skipped: true })).toBe("/subscription-request");
  });
});
