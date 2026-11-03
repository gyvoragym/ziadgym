import type { GymPreferences } from "./store";

export const gymNotificationTypes = [
  "Membership expiring reminders",
  "Daily revenue summary",
  "Low stock alerts",
  "New member sign-ups",
] as const;

export function gymNotificationEnabled(
  preferences: Partial<GymPreferences> | undefined,
  type: string,
  description = "",
) {
  const notificationType =
    type === "Membership expiration"
      ? "Membership expiring reminders"
      : type === "Payment" || type === "Daily revenue summary"
        ? "Daily revenue summary"
        : type === "Low stock alert"
          ? "Low stock alerts"
          : type === "New member sign-ups" ||
              (type === "Membership" && /created|new member|sign.?up/i.test(description))
            ? "New member sign-ups"
            : null;
  return notificationType ? preferences?.notifications?.[notificationType] !== false : true;
}

export function filterGymNotifications<T extends { type: string }>(
  notifications: T[],
  preferences: Partial<GymPreferences> | undefined,
) {
  return notifications.filter((notification) =>
    gymNotificationEnabled(
      preferences,
      notification.type,
      "description" in notification && typeof notification.description === "string"
        ? notification.description
        : "",
    ),
  );
}
