import { describe, expect, it } from "vitest";
import { gymContactUrl } from "@/lib/gym-contact";

describe("gym social contact links", () => {
  it("turns a WhatsApp phone number into a chat link and preserves valid URLs", () => {
    expect(gymContactUrl("whatsapp", "+20 100 123 4567")).toBe("https://wa.me/201001234567");
    expect(gymContactUrl("whatsapp", "https://wa.me/201001234567")).toBe("https://wa.me/201001234567");
  });

  it("adds HTTPS to social links and rejects unsafe protocols", () => {
    expect(gymContactUrl("social", "instagram.com/gyvora")).toBe("https://instagram.com/gyvora");
    expect(gymContactUrl("social", "javascript:alert(1)")).toBe("");
    expect(gymContactUrl("social", "https://instagram.com/gyvora")).toBe("https://instagram.com/gyvora");
  });
});
