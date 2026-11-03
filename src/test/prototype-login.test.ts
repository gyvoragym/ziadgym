import { beforeEach, describe, expect, it } from "vitest";
import { enterPrototype, getPrototypePreference, savePrototypePreference } from "@/lib/prototype-login";
import { getDemoAccount, getDemoSessionInfo, registerDemoAccount, updateDemoAccount } from "@/lib/demo";

describe("destination-based prototype login", () => {
  beforeEach(() => localStorage.clear());

  it("sends a new Gym Account to the subscription screen before the dashboard", () => {
    expect(enterPrototype({ destination: "gym", name: "zy", email: "zy" }, false)).toBe("/subscription-request");
    expect(getDemoSessionInfo()).toEqual({ kind: "owner", name: "zy", email: "zy" });
    expect(getDemoAccount()?.password).toBe("");
  });

  it("skipped Gym Account goes straight to the dashboard on later sign-ins", () => {
    enterPrototype({ destination: "gym", name: "S", email: "s@x" }, false);
    updateDemoAccount("s@x", { skipped: true });
    expect(enterPrototype({ destination: "gym", name: "S", email: "s@x" }, false)).toBe("/dashboard");
  });

  it("allows blank Client / Individual entry", () => {
    expect(enterPrototype({ destination: "individual", name: "", email: "" }, false)).toBe("/member");
    expect(getDemoSessionInfo()?.kind).toBe("individual");
  });

  it("allows blank Dashboard entry", () => {
    expect(enterPrototype({ destination: "dashboard", name: "", email: "" }, false)).toBe("/super-admin");
    expect(getDemoSessionInfo()?.kind).toBe("super");
  });

  it("routes a registered Gym Account by its request status, other destinations stay direct", () => {
    registerDemoAccount("Previous owner", "ab", "old", "gym");
    expect(enterPrototype({ destination: "individual", name: "New client", email: "ab" }, false)).toBe("/member");
    expect(getDemoAccount()).toBeNull();
    expect(enterPrototype({ destination: "gym", name: "Owner", email: "ab" }, false)).toBe("/subscription-request");
    expect(getDemoAccount()?.email).toBe("ab");
    expect(enterPrototype({ destination: "gym", name: "Owner", email: "new@x" }, false)).toBe("/subscription-request");
  });

  it("remembers only destination and display details", () => {
    const details = { destination: "dashboard" as const, name: "zy", email: "xy" };
    enterPrototype(details, true);
    expect(getPrototypePreference()).toEqual(details);
    expect(getDemoSessionInfo()?.name).toBe("zy");
    expect(localStorage.getItem("ironhaus-prototype-login-preference")).not.toContain("password");
  });

  it("clears the preference when Remember Me is disabled without ending demo access", () => {
    const details = { destination: "gym" as const, name: "ab", email: "cd" };
    enterPrototype(details, true);
    savePrototypePreference(details, false);
    expect(getPrototypePreference()).toBeNull();
    expect(getDemoSessionInfo()?.kind).toBe("owner");
  });
});