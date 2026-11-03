import { describe, expect, it } from "vitest";
import { filterGymNotifications, gymNotificationEnabled } from "@/lib/notification-preferences";

describe("gym notification preferences", () => {
  it("keeps notifications enabled by default and maps real events to their setting", () => {
    expect(gymNotificationEnabled(undefined, "Membership expiration")).toBe(true);
    expect(gymNotificationEnabled(undefined, "Payment")).toBe(true);
    expect(gymNotificationEnabled(undefined, "Low stock alert")).toBe(true);
    expect(gymNotificationEnabled(undefined, "Membership", "New membership created")).toBe(true);
  });

  it("hides only event types explicitly disabled in saved settings", () => {
    const preferences = {
      notifications: {
        "Membership expiring reminders": true,
        "Daily revenue summary": false,
        "Low stock alerts": false,
        "New member sign-ups": true,
      },
    };
    const events = [
      { type: "Membership expiration", description: "Expires soon" },
      { type: "Payment", description: "Payment recorded" },
      { type: "Low stock alert", description: "Stock is low" },
      { type: "Membership", description: "New membership created" },
      { type: "Attendance", description: "Member checked in" },
    ];
    expect(filterGymNotifications(events, preferences).map((event) => event.type)).toEqual([
      "Membership expiration",
      "Membership",
      "Attendance",
    ]);
  });
});
