import { describe, expect, it } from "vitest";
import {
  accountQrLookupId,
  createAccountQrPayload,
  parseAccountQrPayload,
} from "@/lib/account-qr-payload";
import { isGyvoraId } from "@/lib/gyvora-id";

describe("self-contained account QR profiles", () => {
  const profile = {
    type: "individual" as const,
    gyvora_id: "GYVORA-C-001",
    full_name: "نور أحمد",
    email: "",
    phone: "+20 10 1234 5678",
  };

  it("encodes the entered identity so another device can display it offline", () => {
    const qr = createAccountQrPayload(profile);
    expect(parseAccountQrPayload(qr)).toEqual(profile);
    expect(accountQrLookupId(qr)).toBe(profile.gyvora_id);
  });

  it("rejects malformed, invalid, and wrong-type ID payloads", () => {
    expect(parseAccountQrPayload("GYVORA:PROFILE:invalid")).toBeNull();
    expect(isGyvoraId("GYVORA-C-001")).toBe(true);
    expect(isGyvoraId("GYVORA-C-000")).toBe(false);
    const mismatchedTypeProfile = btoa(
      JSON.stringify({
        ...profile,
        full_name: "Test User",
        gyvora_id: "GYVORA-G-001",
      }),
    );
    expect(parseAccountQrPayload(`GYVORA:PROFILE:${mismatchedTypeProfile}`)).toBeNull();
  });

  it("keeps Gym and Client profile QR values distinct", () => {
    const gym = createAccountQrPayload({
      ...profile,
      type: "gym",
      gyvora_id: "GYVORA-G-001",
    });
    expect(gym).not.toBe(createAccountQrPayload(profile));
  });

  it("generates a different QR payload for each client ID", () => {
    const otherClient = createAccountQrPayload({
      ...profile,
      gyvora_id: "GYVORA-C-002",
    });
    expect(otherClient).not.toBe(createAccountQrPayload(profile));
  });
});
