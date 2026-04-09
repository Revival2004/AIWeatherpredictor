import { Platform } from "react-native";

let _notif: typeof import("expo-notifications") | null = null;

function getNotif() {
  if (_notif) return _notif;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _notif = require("expo-notifications") as typeof import("expo-notifications");
    _notif.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    _notif = null;
  }
  return _notif;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const n = getNotif();
  if (!n) return false;
  try {
    const { status: existing } = await n.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await n.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Schedule a daily 6 AM local notification with the day's farming outlook.
 * Safe to call on every app launch — cancels any existing daily reminder first.
 */
export async function scheduleDailyFarmingReminder(): Promise<void> {
  if (Platform.OS === "web") return;
  const n = getNotif();
  if (!n) return;
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const scheduled = await n.getAllScheduledNotificationsAsync();
    const existing = scheduled.find((notif) => notif.content.data?.type === "daily_reminder");
    if (existing) {
      await n.cancelScheduledNotificationAsync(existing.identifier);
    }

    await n.scheduleNotificationAsync({
      content: {
        title: "Good morning, farmer!",
        body: "Open FarmPal to check today's rain forecast for your farm.",
        data: { type: "daily_reminder" },
        sound: true,
      },
      trigger: {
        type: n.SchedulableTriggerInputTypes.DAILY,
        hour: 6,
        minute: 0,
      },
    });
  } catch {
  }
}

/**
 * Send an immediate high-rain-probability alert.
 * Only fires when probability >= 70% to avoid alert fatigue.
 */
export async function sendRainAlert(
  probability: number,
  locationName: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  if (probability < 0.7) return;
  const n = getNotif();
  if (!n) return;
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const pct = Math.round(probability * 100);
    await n.scheduleNotificationAsync({
      content: {
        title: `Rain likely at ${locationName}`,
        body: `${pct}% chance of rain in the next 2 hours. Consider covering your crops or postponing field work.`,
        data: { type: "rain_alert", probability },
        sound: true,
      },
      trigger: null,
    });
  } catch {
  }
}

/**
 * Schedule a notification exactly 2 hours after a rain prediction.
 * When the farmer taps it they are prompted: "Did it rain?"
 * Cancels any previously pending feedback reminder first.
 */
export async function scheduleFeedbackReminder(
  locationName: string,
  secondsUntilReminder = 2 * 60 * 60,
): Promise<void> {
  if (Platform.OS === "web") return;
  const n = getNotif();
  if (!n) return;
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    await cancelFeedbackReminder();

    await n.scheduleNotificationAsync({
      content: {
        title: "How was the weather?",
        body: `It's been 2 hours since your prediction at ${locationName}. Did it actually rain? Tap to tell us — it trains the model.`,
        data: { type: "feedback_reminder", locationName },
        sound: true,
      },
      trigger: {
        type: n.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(60, Math.round(secondsUntilReminder)),
        repeats: false,
      },
    });
  } catch {
  }
}

/**
 * Cancel any pending feedback reminder notification.
 */
export async function cancelFeedbackReminder(): Promise<void> {
  if (Platform.OS === "web") return;
  const n = getNotif();
  if (!n) return;
  try {
    const scheduled = await n.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.type === "feedback_reminder") {
        await n.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch {}
}

/**
 * Cancel all pending notifications (e.g. on sign-out or location clear).
 */
export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  const n = getNotif();
  if (!n) return;
  try {
    await n.cancelAllScheduledNotificationsAsync();
  } catch {}
}
