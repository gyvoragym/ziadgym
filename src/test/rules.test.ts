import { describe, expect, it } from "vitest";
import { consumeSession, stockStatus, getState } from "@/lib/store";

describe("stock status", () => {
  it("quantity 0 is out of stock", () => expect(stockStatus(0)).toBe("Out of stock"));
  it("quantity below 10 is low stock", () => expect(stockStatus(9)).toBe("Low stock"));
  it("quantity 10 is in stock", () => expect(stockStatus(10)).toBe("In stock"));
});

describe("session counter", () => {
  const base = getState().members[0]!;
  it("decreases limited sessions by one", () => {
    expect(consumeSession({ ...base, type: "Limited", sessionsTotal: 20, sessionsLeft: 20 }).sessionsLeft).toBe(19);
  });
  it("never goes below zero", () => {
    expect(consumeSession({ ...base, type: "Limited", sessionsTotal: 20, sessionsLeft: 0 }).sessionsLeft).toBe(0);
  });
});
