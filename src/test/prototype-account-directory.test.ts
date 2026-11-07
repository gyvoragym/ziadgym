import { afterEach, describe, expect, it } from "vitest";
import {
  findLocalPrototypeAccountByQr,
  localPrototypeAccounts,
  rememberScannedPrototypeAccount,
  saveLocalPrototypeAccount,
} from "@/lib/prototype-account-directory";
import { ensureOfflineDemoIdentity } from "@/lib/demo-identities";
import { clearPrototypeStorage, prototypeStorage } from "@/lib/prototype-storage";
import { savePreviewSession } from "@/lib/preview-session";
import { demoUserId } from "@/lib/demo";

afterEach(() => {
  savePreviewSession(null);
  clearPrototypeStorage();
  localStorage.clear();
});

describe("browser-local prototype account directory", () => {
  it("creates distinct client and gym QR IDs without calling Supabase", () => {
    const client = saveLocalPrototypeAccount({
      type: "individual",
      scenarioKey: "client-one",
      name: "Client One",
      email: "",
      phone: "01000000000",
    });
    const gym = saveLocalPrototypeAccount({
      type: "gym",
      scenarioKey: "gym-one",
      name: "Gym One",
      email: "gym@example.test",
      phone: "",
    });

    expect(client.gyvora_id).toMatch(/^GYVORA-C-\d{3,}$/);
    expect(gym.gyvora_id).toMatch(/^GYVORA-G-\d{3,}$/);
    expect(client.gyvora_id).not.toBe(gym.gyvora_id);
    expect(demoUserId(client.id)).toBe(client.id);
    expect(findLocalPrototypeAccountByQr(client.gyvora_id)).toMatchObject({
      full_name: "Client One",
      phone: "01000000000",
    });
    expect(localPrototypeAccounts()).toHaveLength(2);
  });

  it("keeps offline identities stable and distinct", () => {
    const first = ensureOfflineDemoIdentity("C", "client-a");
    const next = ensureOfflineDemoIdentity("C", "client-b");
    expect(ensureOfflineDemoIdentity("C", "client-a")).toBe(first);
    expect(first).toMatch(/^GYVORA-C-\d{3}$/);
    expect(next).toMatch(/^GYVORA-C-\d{3}$/);
    expect(next).not.toBe(first);
    expect(prototypeStorage().getItem("gyvora-demo-permanent-identities-v1")).toContain(first);
  });

  it("remembers a QR scanned from another device in the admin browser", () => {
    const profile = {
      type: "individual" as const,
      gyvora_id: "GYVORA-C-001",
      full_name: "Scanned Client",
      email: "",
      phone: "+201001234567",
    };
    const first = rememberScannedPrototypeAccount(profile);
    const updated = rememberScannedPrototypeAccount({ ...profile, full_name: "Updated Client" });

    expect(updated.id).toBe(first.id);
    expect(updated.created_at).toBe(first.created_at);
    expect(localPrototypeAccounts()).toContainEqual(updated);
  });
});
