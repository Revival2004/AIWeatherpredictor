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

import type { WeatherPredictionResponse } from "@workspace/api-client-react";
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

const predictionIcons: Record<string, keyof typeof Feather.glyphMap> = {
  "Heavy Rain": "cloud-rain",
  "Light Rain": "cloud-drizzle",
  "Clear Sky": "sun",
  "Partly Cloudy": "cloud",
  "Overcast": "cloud",
  "Thunderstorm": "cloud-lightning",
  "Frost Risk": "thermometer",
  "High Wind": "wind",
  "Fog": "align-justify",
  "Dry Conditions": "sun",
  "Storm Watch": "alert-triangle",
  "Light Snow": "cloud-snow",
};

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

  const styles = StyleSheet.create({
    card: {
      borderRadius: 24,
      overflow: "hidden",
      backgroundColor: colors.primary,
      marginHorizontal: 16,
    },
    inner: {
      padding: 24,
    },
    locationRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
      gap: 6,
    },
    locationText: {
      color: colors.primaryForeground,
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      opacity: 0.85,
    },
    refreshBtn: {
      marginLeft: "auto" as unknown as number,
      padding: 4,
    },
    tempText: {
      color: colors.primaryForeground,
      fontSize: 72,
      fontFamily: "Inter_700Bold",
      lineHeight: 80,
      marginTop: 8,
    },
    conditionText: {
      color: colors.primaryForeground,
      fontSize: 18,
      fontFamily: "Inter_400Regular",
      opacity: 0.9,
      marginBottom: 20,
    },
    divider: {
      height: 1,
      backgroundColor: "rgba(255,255,255,0.25)",
      marginVertical: 16,
    },
    predictionRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    predictionLabel: {
      color: colors.primaryForeground,
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      opacity: 0.75,
      marginBottom: 2,
    },
    predictionText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
    },
    confidenceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 4,
    },
    confidenceBar: {
      height: 4,
      flex: 1,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.25)",
      overflow: "hidden",
    },
    confidenceFill: {
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.85)",
    },
    confidenceText: {
      color: colors.primaryForeground,
      fontSize: 12,
      opacity: 0.75,
      fontFamily: "Inter_400Regular",
      minWidth: 36,
      textAlign: "right",
    },
    learningBadge: {
      backgroundColor: "rgba(255,255,255,0.25)",
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    learningBadgeText: {
      color: colors.primaryForeground,
      fontSize: 9,
      fontFamily: "Inter_700Bold",
      letterSpacing: 0.5,
    },
    dataPointsText: {
      color: colors.primaryForeground,
      fontSize: 11,
      opacity: 0.65,
      fontFamily: "Inter_400Regular",
      marginTop: 4,
    },
    statsRow: {
      flexDirection: "row",
      marginTop: 16,
      gap: 8,
    },
    statItem: {
      flex: 1,
      backgroundColor: "rgba(255,255,255,0.15)",
      borderRadius: 12,
      padding: 10,
      alignItems: "center",
    },
    statValue: {
      color: colors.primaryForeground,
      fontSize: 14,
      fontFamily: "Inter_700Bold",
    },
    statLabel: {
      color: colors.primaryForeground,
      fontSize: 10,
      opacity: 0.7,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    loadingBox: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 48,
    },
    loadingText: {
      color: colors.primaryForeground,
      marginTop: 12,
      fontFamily: "Inter_500Medium",
      opacity: 0.8,
    },
    errorBox: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 48,
    },
    errorText: {
      color: colors.primaryForeground,
      marginTop: 12,
      fontFamily: "Inter_500Medium",
      opacity: 0.8,
      textAlign: "center",
    },
    retryBtn: {
      marginTop: 16,
      backgroundColor: "rgba(255,255,255,0.25)",
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    retryText: {
      color: colors.primaryForeground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
    emptyBox: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 48,
    },
    emptyText: {
      color: colors.primaryForeground,
      marginTop: 12,
      fontFamily: "Inter_500Medium",
      opacity: 0.7,
      textAlign: "center",
      paddingHorizontal: 16,
    },
  });

  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.inner}>
          <View style={styles.loadingBox}>
            <ActivityIndicator color="rgba(255,255,255,0.9)" size="large" />
            <Text style={styles.loadingText}>Fetching microclimate data…</Text>
          </View>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <View style={styles.inner}>
          <View style={styles.errorBox}>
            <Feather name="alert-triangle" size={32} color="rgba(255,255,255,0.9)" />
            <Text style={styles.errorText}>Could not fetch weather data</Text>
            <Pressable style={styles.retryBtn} onPress={handleRefresh}>
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.card}>
        <View style={styles.inner}>
          <View style={styles.emptyBox}>
            <Feather name="map-pin" size={32} color="rgba(255,255,255,0.6)" />
            <Text style={styles.emptyText}>
              Tap the pin button to fetch your local microclimate
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const { weather, prediction, location } = data;
  const conditionStr = wmoCondition(weather.weathercode);
  const iconName = wmoIcon(weather.weathercode);
  const predIconName = predictionIcons[prediction?.prediction ?? ""] ?? "sun";
  const confPct = Math.round((prediction?.confidence ?? 0) * 100);

  return (
    <View style={styles.card}>
      <View style={styles.inner}>
        <View style={styles.locationRow}>
          <Feather name="map-pin" size={14} color={colors.primaryForeground} style={{ opacity: 0.8 }} />
          <Text style={styles.locationText}>
            {`${location.lat.toFixed(2)}°N, ${location.lon.toFixed(2)}°E`}
          </Text>
          <Pressable
            style={styles.refreshBtn}
            onPress={handleRefresh}
            testID="refresh-btn"
          >
            <Feather name="refresh-cw" size={18} color={colors.primaryForeground} style={{ opacity: 0.85 }} />
          </Pressable>
        </View>

        <Text style={styles.tempText}>{Math.round(weather.temperature)}°</Text>
        <Text style={styles.conditionText}>
          <Feather name={iconName} size={16} /> {conditionStr}
        </Text>

        <View style={styles.divider} />

        <View style={styles.predictionRow}>
          <Feather
            name={predIconName}
            size={20}
            color={colors.primaryForeground}
            style={{ marginTop: 2 }}
          />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <Text style={styles.predictionLabel}>AI PREDICTION</Text>
              {prediction?.modelVersion && prediction.modelVersion !== "rules" && (
                <View style={styles.learningBadge}>
                  <Text style={styles.learningBadgeText}>
                    {prediction.modelVersion === "pattern-learned" ? "LEARNED" : "LEARNING"}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.predictionText}>{prediction?.prediction ?? "—"}</Text>
            <View style={styles.confidenceRow}>
              <View style={styles.confidenceBar}>
                <View style={[styles.confidenceFill, { width: `${confPct}%` }]} />
              </View>
              <Text style={styles.confidenceText}>{confPct}%</Text>
            </View>
            {(prediction?.dataPoints ?? 0) > 0 && (
              <Text style={styles.dataPointsText}>
                Based on {prediction!.dataPoints} historical readings
              </Text>
            )}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{weather.humidity}%</Text>
            <Text style={styles.statLabel}>Humidity</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{weather.windspeed}</Text>
            <Text style={styles.statLabel}>km/h</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{weather.pressure}</Text>
            <Text style={styles.statLabel}>hPa</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
