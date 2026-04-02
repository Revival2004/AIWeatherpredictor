import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/**
 * Schedule a daily 6 AM local notification with the day's farming outlook.
 * Safe to call on every app launch — cancels any existing daily reminder first.
 */
export async function scheduleDailyFarmingReminder(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    // Cancel any existing daily reminder before rescheduling
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const existing = scheduled.find((n) => n.content.data?.type === "daily_reminder");
    if (existing) {
      await Notifications.cancelScheduledNotificationAsync(existing.identifier);
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🌱 Good morning, farmer!",
        body: "Open Microclimate to check today's rain forecast for your farm.",
        data: { type: "daily_reminder" },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 6,
        minute: 0,
      },
    });
  } catch (err) {
    console.warn("Failed to schedule daily notification:", err);
  }
}

/**
 * Send an immediate high-rain-probability alert.
 * Only fires when probability ≥ 70% to avoid alert fatigue.
 */
export async function sendRainAlert(
  probability: number,
  locationName: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  if (probability < 0.7) return;

  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const pct = Math.round(probability * 100);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🌧️ Rain likely at ${locationName}`,
        body: `${pct}% chance of rain in the next 2 hours. Consider covering your crops or postponing field work.`,
        data: { type: "rain_alert", probability },
        sound: true,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn("Failed to send rain alert:", err);
  }
}

/**
 * Cancel all pending notifications (e.g. on sign-out or location clear).
 */
export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
