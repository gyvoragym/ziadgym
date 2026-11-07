import { describe, it, expect } from "vitest";
import { currencyOf, money } from "@/lib/store";
describe("gym currency display", () => {
  it("defaults to EGP", () => expect(currencyOf({})).toBe("EGP"));
  it("uses the saved currency without converting amounts", () => expect(money(1500, currencyOf({ preferences: { currency: "USD", language: "English", notifications: {} } }))).toBe("USD 1,500"));
});
