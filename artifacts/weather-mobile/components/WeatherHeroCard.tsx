import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { WeatherPredictionResponse } from "@/lib/api-client";
import { useColors } from "@/hooks/useColors";

interface WeatherHeroCardProps {
  data: WeatherPredictionResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  onRefresh: () => void;
}

function wmoCondition(code: number): string {
  if (code === 0) return "Clear Sky";
  if (code <= 3) return "Partly Cloudy";
  if (code <= 9) return "Fog";
  if (code <= 19) return "Drizzle";
  if (code <= 29) return "Rain";
  if (code <= 39) return "Snow";
  if (code <= 49) return "Fog";
  if (code <= 59) return "Drizzle";
  if (code <= 69) return "Rain";
  if (code <= 79) return "Snow";
  if (code <= 84) return "Rain Showers";
  if (code <= 94) return "Snow Showers";
  return "Thunderstorm";
}

function wmoIcon(code: number): keyof typeof Feather.glyphMap {
  if (code === 0) return "sun";
  if (code <= 3) return "cloud";
  if (code <= 9) return "align-justify";
  if (code <= 29) return "cloud-drizzle";
  if (code <= 39) return "cloud-snow";
  if (code <= 49) return "align-justify";
  if (code <= 59) return "cloud-drizzle";
  if (code <= 69) return "cloud-rain";
  if (code <= 79) return "cloud-snow";
  if (code <= 84) return "cloud-rain";
  if (code <= 94) return "cloud-snow";
  return "cloud-lightning";
}

function predictionColor(pred: string): string {
  if (pred.includes("Rain") || pred.includes("Storm") || pred.includes("Thunder")) return "#EF4444";
  if (pred.includes("Frost")) return "#60A5FA";
  if (pred.includes("Wind")) return "#F59E0B";
  if (pred.includes("Stable") || pred.includes("Clear") || pred.includes("Dry")) return "#10B981";
  return "#A78BFA";
}

export function WeatherHeroCard({
  data,
  isLoading,
  error,
  onRefresh,
}: WeatherHeroCardProps) {
  const colors = useColors();

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRefresh();
  };

  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.primary }]}>
        <View style={styles.loadingBox}>
          <ActivityIndicator color="rgba(255,255,255,0.9)" size="large" />
          <Text style={styles.loadingText}>Fetching farm data…</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.card, { backgroundColor: colors.primary }]}>
        <View style={styles.loadingBox}>
          <Feather name="alert-triangle" size={32} color="rgba(255,255,255,0.9)" />
          <Text style={styles.loadingText}>Could not fetch weather data</Text>
          <Pressable style={styles.retryBtn} onPress={handleRefresh}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.card, { backgroundColor: colors.primary }]}>
        <View style={styles.loadingBox}>
          <Feather name="globe" size={52} color="rgba(255,255,255,0.9)" />
          <Text style={[styles.loadingText, { marginTop: 12 }]}>Loading your farm's weather…</Text>
        </View>
      </View>
    );
  }

  const { weather, prediction, location } = data;
  const conditionStr = wmoCondition(weather.weathercode);
  const predColor = predictionColor(prediction?.prediction ?? "");
  const confPct = Math.round((prediction?.confidence ?? 0) * 100);

  return (
    <View style={[styles.card, { backgroundColor: colors.primary }]}>
      {/* Decorative large icon — top right */}
      <View style={styles.emojiDecor} pointerEvents="none">
        <Feather name={wmoIcon(weather.weathercode)} size={110} color="rgba(255,255,255,0.18)" />
      </View>

      <View style={styles.inner}>
        {/* Top row: location + refresh */}
        <View style={styles.topRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Feather name="map-pin" size={12} color="rgba(255,255,255,0.75)" />
            <Text style={styles.locationText}>
              {`${location.lat.toFixed(3)}°, ${location.lon.toFixed(3)}°`}
            </Text>
          </View>
          <Pressable onPress={handleRefresh} style={styles.refreshBtn} testID="refresh-btn">
            <Feather name="refresh-cw" size={16} color="rgba(255,255,255,0.85)" />
          </Pressable>
        </View>

        {/* Temperature */}
        <Text style={styles.tempText}>{Math.round(weather.temperature)}°</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: -4, marginBottom: 16 }}>
          <Feather name={wmoIcon(weather.weathercode)} size={14} color="rgba(255,255,255,0.8)" />
          <Text style={styles.conditionText}>{conditionStr}</Text>
        </View>

        {/* Stats grid */}
        <View style={styles.statsRow}>
          {[
            { icon: "droplet" as const, val: `${weather.humidity}%`, lbl: "Humidity" },
            { icon: "wind" as const, val: `${weather.windspeed}`, lbl: "km/h" },
            { icon: "activity" as const, val: `${weather.pressure}`, lbl: "hPa" },
          ].map((s) => (
            <View key={s.lbl} style={styles.statPill}>
              <Feather name={s.icon} size={13} color="rgba(255,255,255,0.7)" />
              <View>
                <Text style={styles.statValue}>{s.val}</Text>
                <Text style={styles.statLabel}>{s.lbl}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* AI Prediction */}
        <View style={styles.predRow}>
          <View style={[styles.predDot, { backgroundColor: predColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.predLabel}>AI CONDITION FORECAST</Text>
            <Text style={styles.predText}>{prediction?.prediction ?? "—"}</Text>
          </View>
          <View style={styles.confBadge}>
            <Text style={styles.confText}>{confPct}%</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    marginHorizontal: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  emojiDecor: {
    position: "absolute",
    top: -12,
    right: 8,
  },
  inner: {
    padding: 24,
    paddingTop: 20,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  locationText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  refreshBtn: {
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
  },
  tempText: {
    color: "#ffffff",
    fontSize: 80,
    fontFamily: "Inter_700Bold",
    lineHeight: 88,
    letterSpacing: -2,
  },
  conditionText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statValue: {
    color: "#ffffff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    lineHeight: 16,
  },
  statLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    lineHeight: 13,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginVertical: 16,
  },
  predRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  predDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  predLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  predText: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  confBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  confText: {
    color: "#ffffff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 52,
    gap: 8,
  },
  loadingText: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
