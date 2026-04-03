import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

export type PressureTrend = "rising" | "falling" | "stable";

export interface BarometerState {
  pressure: number | null;
  trend: PressureTrend;
  available: boolean;
}

const WINDOW = 5;          // keep last 5 readings
const FALL_THRESHOLD = 0.5; // hPa drop across window = falling
const RISE_THRESHOLD = 0.5; // hPa rise across window = rising

export function useBarometer(): BarometerState {
  const [state, setState] = useState<BarometerState>({
    pressure: null,
    trend: "stable",
    available: false,
  });

  const history = useRef<number[]>([]);

  useEffect(() => {
    if (Platform.OS === "web") return; // no barometer on web

    let subscription: { remove: () => void } | null = null;

    const start = async () => {
      try {
        // Lazy import so the module is optional — graceful if hardware missing
        const { Barometer } = await import("expo-sensors");
        const isAvail = await Barometer.isAvailableAsync();
        if (!isAvail) return;

        Barometer.setUpdateInterval(30_000); // read every 30 seconds
        subscription = Barometer.addListener(({ pressure }) => {
          history.current = [...history.current.slice(-(WINDOW - 1)), pressure];

          let trend: PressureTrend = "stable";
          if (history.current.length >= 2) {
            const delta = history.current[history.current.length - 1] - history.current[0];
            if (delta <= -FALL_THRESHOLD) trend = "falling";
            else if (delta >= RISE_THRESHOLD) trend = "rising";
          }

          setState({ pressure, trend, available: true });
        });
      } catch {
        // Barometer not available on this device — silently skip
      }
    };

    start();
    return () => { subscription?.remove(); };
  }, []);

  return state;
}
