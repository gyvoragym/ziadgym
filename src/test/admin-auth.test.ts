import { describe, expect, it } from "vitest";
import { matchesAdminContactLogin, matchesAdminLogin, matchesAnyAdminContactLogin } from "@/lib/admin-auth";

const configuration = {
  name: "GYVORA",
  email: "admin@example.test",
  phone: "+201094536260",
  password: "a-test-only-password",
};

describe("platform admin prototype login", () => {
  it("matches email, phone and password when the optional name is not configured", () => {
    const { name: _name, ...withoutName } = configuration;
    expect(
      matchesAdminLogin(
        {
          email: "ADMIN@example.test",
          phone: "20 10 94536260",
          password: configuration.password,
        },
        withoutName,
      ),
    ).toBe(true);
  });

  it("rejects any missing or incorrect credential and an empty configuration", () => {
    expect(matchesAdminLogin({ ...configuration, password: "wrong" }, configuration)).toBe(false);
    expect(matchesAdminLogin(configuration, undefined)).toBe(false);
    expect(matchesAdminLogin(configuration, { ...configuration, phone: "" })).toBe(false);
  });

  it("checks the name when one is configured", () => {
    expect(matchesAdminLogin({ ...configuration, name: "wrong name" }, configuration)).toBe(false);
    expect(matchesAdminLogin({ ...configuration, name: " gyvora " }, configuration)).toBe(true);
  });

  it("authenticates the hidden administrator using its registered phone or email", () => {
    expect(matchesAdminContactLogin(configuration.phone, configuration.password, configuration)).toBe(true);
    expect(matchesAdminContactLogin("admin@example.test", configuration.password, configuration)).toBe(true);
    expect(matchesAdminContactLogin("01094536260", configuration.password, configuration)).toBe(true);
    expect(matchesAdminContactLogin(configuration.phone, "wrong", configuration)).toBe(false);
    expect(matchesAdminContactLogin(configuration.phone, configuration.password, undefined)).toBe(false);
  });

  it("checks both entered contacts so an unrelated phone does not hide the admin email", () => {
    expect(
      matchesAnyAdminContactLogin(
        ["01000000000", configuration.email],
        configuration.password,
        configuration,
      ),
    ).toBe(true);
    expect(
      matchesAnyAdminContactLogin(
        ["01000000000", "another@example.test"],
        configuration.password,
        configuration,
      ),
    ).toBe(false);
  });
});
