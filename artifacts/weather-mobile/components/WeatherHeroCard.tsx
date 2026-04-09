import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
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
  locationName?: string | null;
}

const DEGREE = "\u00b0";

function wmoCondition(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 9) return "Fog";
  if (code <= 19) return "Drizzle";
  if (code <= 29) return "Light rain";
  if (code <= 39) return "Snow";
  if (code <= 49) return "Fog";
  if (code <= 59) return "Showers";
  if (code <= 69) return "Rain";
  if (code <= 79) return "Snow";
  if (code <= 84) return "Rain showers";
  if (code <= 94) return "Snow showers";
  return "Storm risk";
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
  if (pred.includes("Rain") || pred.includes("Storm") || pred.includes("Thunder")) return "#FCA5A5";
  if (pred.includes("Frost")) return "#93C5FD";
  if (pred.includes("Wind")) return "#FCD34D";
  if (pred.includes("Stable") || pred.includes("Clear") || pred.includes("Dry")) return "#86EFAC";
  return "#D8B4FE";
}

function formatCoords(lat: number, lon: number): string {
  const northSouth = lat >= 0 ? "N" : "S";
  const eastWest = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(3)}${DEGREE} ${northSouth}  ${Math.abs(lon).toFixed(3)}${DEGREE} ${eastWest}`;
}

export function WeatherHeroCard({
  data,
  isLoading,
  error,
  onRefresh,
  locationName,
}: WeatherHeroCardProps) {
  const colors = useColors();

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRefresh();
  };

  const gradient = [colors.primary, colors.secondary] as const;

  if (isLoading) {
    return (
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.loadingBox}>
          <ActivityIndicator color="rgba(255,255,255,0.9)" size="large" />
          <Text style={styles.loadingText}>Building your farm weather view...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.loadingBox}>
          <Feather name="alert-triangle" size={32} color="rgba(255,255,255,0.9)" />
          <Text style={styles.loadingText}>We could not refresh this farm view.</Text>
          <Pressable style={styles.retryBtn} onPress={handleRefresh}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  if (!data) {
    return (
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.loadingBox}>
          <Feather name="map-pin" size={44} color="rgba(255,255,255,0.92)" />
          <Text style={[styles.loadingText, { marginTop: 10 }]}>Waiting for your current farm signal...</Text>
        </View>
      </LinearGradient>
    );
  }

  const { weather, prediction, location } = data;
  const condition = wmoCondition(weather.weathercode);
  const modelColor = predictionColor(prediction?.prediction ?? "");
  const confidence = Math.round((prediction?.confidence ?? 0) * 100);
  const primaryLocation = locationName || "Current farm area";

  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      {/* Decorative large icon — top right */}
      <View style={styles.iconBackdrop} pointerEvents="none">
        <Feather name={wmoIcon(weather.weathercode)} size={118} color="rgba(255,255,255,0.14)" />
      </View>

      <View style={styles.inner}>
        {/* Top row: location + refresh */}
        <View style={styles.topRow}>
          <View style={styles.heroMeta}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>Live farm view</Text>
            </View>
            <View>
              <Text style={styles.locationTitle}>{primaryLocation}</Text>
              <Text style={styles.locationSub}>{formatCoords(location.lat, location.lon)}</Text>
            </View>
          </View>
          <Pressable onPress={handleRefresh} style={styles.refreshBtn} testID="refresh-btn">
            <Feather name="refresh-cw" size={16} color="#FFFFFF" />
          </Pressable>
        </View>

        <Text style={styles.tempText}>
          {Math.round(weather.temperature)}
          <Text style={styles.tempUnit}>{DEGREE}</Text>
        </Text>
        <View style={styles.conditionRow}>
          <Feather name={wmoIcon(weather.weathercode)} size={14} color="rgba(255,255,255,0.86)" />
          <Text style={styles.conditionText}>{condition}</Text>
          <View style={styles.conditionDivider} />
          <Text style={styles.conditionText}>Updated for field decisions</Text>
        </View>

        {/* Stats grid */}
        <View style={styles.statsRow}>
          {[
            { icon: "droplet" as const, value: `${weather.humidity}%`, label: "Humidity" },
            { icon: "wind" as const, value: `${weather.windspeed} km/h`, label: "Wind" },
            { icon: "activity" as const, value: `${weather.pressure} hPa`, label: "Pressure" },
          ].map((item) => (
            <View key={item.label} style={styles.statPill}>
              <Feather name={item.icon} size={13} color="rgba(255,255,255,0.72)" />
              <View style={{ flex: 1 }}>
                <Text style={styles.statValue}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.outlookCard}>
          <View style={styles.outlookCopy}>
            <Text style={styles.outlookLabel}>Short-range outlook</Text>
            <Text style={styles.outlookText}>{prediction?.prediction ?? "Model pending"}</Text>
            <Text style={styles.predText}>{prediction?.prediction ?? "—"}</Text>
          </View>
          <View style={[styles.confBadge, { backgroundColor: modelColor + "2A" }]}>
            <Text style={styles.confText}>{confidence}%</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 30,
    marginHorizontal: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 8,
  },
  iconBackdrop: {
    position: "absolute",
    top: -10,
    right: 4,
  },
  inner: {
    padding: 22,
    gap: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  heroMeta: {
    flex: 1,
    gap: 10,
  },
  liveBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#BBF7D0",
  },
  liveBadgeText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  locationTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    lineHeight: 24,
  },
  locationSub: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 3,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
  },
  tempText: {
    color: "#ffffff",
    fontSize: 84,
    fontFamily: "Inter_700Bold",
    lineHeight: 88,
    letterSpacing: -2.4,
  },
  tempUnit: {
    fontSize: 44,
    lineHeight: 48,
  },
  conditionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  conditionText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  conditionDivider: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  statValue: {
    color: "#ffffff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  outlookCard: {
    marginTop: 4,
    backgroundColor: "rgba(10,16,12,0.2)",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  outlookCopy: {
    flex: 1,
  },
  outlookLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  outlookText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    lineHeight: 20,
  },
  predText: {
    display: "none",
  },
  confidenceWrap: {
    minWidth: 84,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  outlookDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginBottom: 2,
  },
  confBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
    minWidth: 74,
    alignItems: "center",
  },
  confText: {
    color: "#ffffff",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  confidenceValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    lineHeight: 28,
  },
  confidenceLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
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
