import { describe, expect, it } from "vitest";
import { registrationSchema } from "@/lib/registration";
import {
  matchesAccountType,
  internalAuthEmail,
  normalizeContact,
  normalizeEgyptianMobile,
  phoneAuthEmail,
  temporaryVerificationEnabled,
  verifyTemporaryCode,
} from "@/lib/signup-verifier";
describe("unified persistent signup rules", () => {
  for (const account_type of ["gym", "individual"]) {
    it(`${account_type} requires a phone number and Gmail address`, () => {
      const row = { full_name: "Fictional Person", password: "test-password", account_type };
      expect(registrationSchema.safeParse(row).success).toBe(false);
      expect(
        registrationSchema.safeParse({
          ...row,
          phone: "+201012345678",
          email: "fictional@gmail.com",
        }).success,
      ).toBe(true);
      expect(
        registrationSchema.safeParse({ ...row, phone: "", email: "fictional@gmail.com" })
          .success,
      ).toBe(false);
      expect(
        registrationSchema.safeParse({
          ...row,
          phone: "+201012345678",
          email: "fictional@example.test",
        }).success,
      ).toBe(false);
    });
  }
  it("does not offer public administrator signup", () => {
    expect(
      registrationSchema.safeParse({
        full_name: "Fictional",
        password: "test-password",
        email: "f@gmail.com",
        account_type: "dashboard",
      }).success,
    ).toBe(false);
  });
  it("accepts only nonempty temporary codes in development", () => {
    expect(() => verifyTemporaryCode("anything", true)).not.toThrow();
    expect(() => verifyTemporaryCode("   ", true)).toThrow();
  });
  it("production builds fail closed even outside a production runtime", () => {
    expect(temporaryVerificationEnabled(false, "development")).toBe(false);
    expect(() =>
      verifyTemporaryCode("anything", temporaryVerificationEnabled(false, undefined)),
    ).toThrow();
  });
  it("production runtime disables temporary codes even for a development build", () => {
    expect(temporaryVerificationEnabled(true, "production")).toBe(false);
    expect(temporaryVerificationEnabled(true, "development")).toBe(true);
  });
  it("phone credentials use normalized international numbers", () => {
    expect(normalizeContact("phone", "+1 (202) 555-0199")).toBe("+12025550199");
    expect(normalizeContact("phone", "20 10 94536260")).toBe("+201094536260");
    expect(() => normalizeContact("phone", "2025550199")).toThrow();
  });
  it("maps phone accounts to an internal auth email without using phone auth", () => {
    expect(internalAuthEmail("user-id")).toBe("user-user-id@accounts.gyvora.invalid");
    expect(phoneAuthEmail("01012345678")).toBe("phone-201012345678@accounts.gyvora.invalid");
  });
  it("requires an eight-character minimum password", () => {
    const row = {
      full_name: "Fictional Person",
      phone: "01012345678",
      email: "fictional@gmail.com",
      password: "pass",
      account_type: "individual",
    };
    expect(registrationSchema.safeParse(row).success).toBe(false);
    expect(registrationSchema.safeParse({ ...row, password: "pass1234" }).success).toBe(true);
  });
  it("registration accepts only plausible Egyptian mobile prefixes and normalizes to E.164", () => {
    expect(normalizeEgyptianMobile("010 1234 5678")).toBe("+201012345678");
    expect(normalizeEgyptianMobile("+20 11 1234 5678")).toBe("+201112345678");
    for (const phone of [
      "01012345678",
      "01112345678",
      "01212345678",
      "01512345678",
      "+201012345678",
      "00201112345678",
    ]) {
      expect(
        registrationSchema.safeParse({
          full_name: "Fictional Person",
          phone,
          email: "fictional@gmail.com",
          password: "test-password",
          account_type: "individual",
        }).success,
        phone,
      ).toBe(true);
    }
    for (const phone of [
      "01312345678",
      "0101234567",
      "010123456789",
      "not a real number",
      "+12025550199",
    ]) {
      expect(
        registrationSchema.safeParse({
          full_name: "Fictional Person",
          phone,
          email: "fictional@gmail.com",
          password: "test-password",
          account_type: "individual",
        }).success,
      ).toBe(false);
    }
  });
  it("login must match the stored account type and trusted admin role", () => {
    expect(matchesAccountType("gym", "client", false)).toBe(false);
    expect(matchesAccountType("individual", "owner", false)).toBe(false);
    expect(matchesAccountType("gym", "owner", false)).toBe(true);
    expect(matchesAccountType("individual", "client", false)).toBe(true);
    expect(matchesAccountType("dashboard", "owner", false)).toBe(false);
    expect(matchesAccountType("dashboard", "client", true)).toBe(true);
  });
});
