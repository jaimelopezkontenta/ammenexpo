import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  normalizeReminderHours,
  reminderIdentifier,
  syncLocalReminders,
} from "./localReminders";

/**
 * Lo puro de `localReminders` se prueba sin tocar `expo-notifications` ni
 * `react-native`: el identifier, el filtrado de horas y el no-programar en
 * web. Las llamadas nativas se verifican contra mocks, no contra un
 * dispositivo real — esa mitad solo se puede comprobar en un iPhone/Android.
 */

const platform = vi.hoisted(() => ({ OS: "ios" as string }));

const notifications = vi.hoisted(() => ({
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
}));

vi.mock("react-native", () => ({
  Platform: platform,
}));

vi.mock("expo-notifications", () => ({
  AndroidImportance: { DEFAULT: 5 },
  SchedulableTriggerInputTypes: { DAILY: "daily" },
  ...notifications,
}));

beforeEach(() => {
  platform.OS = "ios";
  notifications.setNotificationHandler.mockClear();
  notifications.setNotificationChannelAsync.mockClear();
  notifications.requestPermissionsAsync.mockClear();
  notifications.getAllScheduledNotificationsAsync.mockClear();
  notifications.scheduleNotificationAsync.mockClear();
  notifications.cancelScheduledNotificationAsync.mockClear();

  notifications.requestPermissionsAsync.mockResolvedValue({
    status: "granted",
  });
  notifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
});

describe("reminderIdentifier", () => {
  it("builds the identifier from the hour", () => {
    expect(reminderIdentifier(8)).toBe("ammen-reminder-8");
    expect(reminderIdentifier(21)).toBe("ammen-reminder-21");
  });
});

describe("normalizeReminderHours", () => {
  it("keeps [8, 21] as-is", () => {
    expect(normalizeReminderHours([8, 21])).toEqual([8, 21]);
  });

  it("drops invalid hours and dedupes, keeping order", () => {
    expect(normalizeReminderHours([-1, 24, 2.5, 8, 21, 8, 7.9, 0, 21])).toEqual(
      [0, 8, 21],
    );
  });

  it("returns an empty list for an empty list", () => {
    expect(normalizeReminderHours([])).toEqual([]);
  });
});

describe("syncLocalReminders", () => {
  it("does nothing on web", async () => {
    platform.OS = "web";

    await syncLocalReminders([8, 21], { title: "Es tu momento de oración" });

    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(
      notifications.getAllScheduledNotificationsAsync,
    ).not.toHaveBeenCalled();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(notifications.setNotificationHandler).not.toHaveBeenCalled();
  });

  it("schedules one daily notification per valid hour", async () => {
    await syncLocalReminders([8, 21], { title: "Es tu momento de oración" });

    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: "ammen-reminder-8",
      content: { title: "Es tu momento de oración" },
      trigger: {
        type: "daily",
        hour: 8,
        minute: 0,
        channelId: "ammen-reminders",
      },
    });
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: "ammen-reminder-21",
      content: { title: "Es tu momento de oración" },
      trigger: {
        type: "daily",
        hour: 21,
        minute: 0,
        channelId: "ammen-reminders",
      },
    });
  });

  it("denied permission cancels ours and schedules nothing", async () => {
    notifications.requestPermissionsAsync.mockResolvedValue({
      status: "denied",
    });

    await syncLocalReminders([8], { title: "x" });

    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    // La cancelación lee una vez la lista para encontrar las nuestras.
    expect(notifications.getAllScheduledNotificationsAsync).toHaveBeenCalled();
  });

  it("empty hours cancels and schedules nothing", async () => {
    await syncLocalReminders([], { title: "x" });

    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(notifications.getAllScheduledNotificationsAsync).toHaveBeenCalled();
  });

  it("cancels only identifiers with the ammen-reminder prefix", async () => {
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "ammen-reminder-6" },
      { identifier: "some-push-identifier" },
      { identifier: "other-local" },
    ]);

    await syncLocalReminders([], { title: "x" });

    expect(
      notifications.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledTimes(1);
    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "ammen-reminder-6",
    );
  });
});
