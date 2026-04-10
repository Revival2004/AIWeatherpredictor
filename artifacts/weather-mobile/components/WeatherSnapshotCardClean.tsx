import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import type { WeatherPredictionResponse } from "@/lib/api-client";

interface WeatherSnapshotCardCleanProps {
  data: WeatherPredictionResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  onRefresh: () => void;
  locationName?: string | null;
}

const DEGREE = "\u00B0";

function wmoCondition(
  code: number,
  t: (
    key:
      | "weatherClear"
      | "weatherPartlyCloudy"
      | "weatherFog"
      | "weatherDrizzle"
      | "weatherLightRain"
      | "weatherSnow"
      | "weatherShowers"
      | "weatherRain"
      | "weatherRainShowers"
      | "weatherSnowShowers"
      | "weatherStormRisk",
  ) => string,
): string {
  if (code === 0) return t("weatherClear");
  if (code <= 3) return t("weatherPartlyCloudy");
  if (code <= 9) return t("weatherFog");
  if (code <= 19) return t("weatherDrizzle");
  if (code <= 29) return t("weatherLightRain");
  if (code <= 39) return t("weatherSnow");
  if (code <= 49) return t("weatherFog");
  if (code <= 59) return t("weatherShowers");
  if (code <= 69) return t("weatherRain");
  if (code <= 79) return t("weatherSnow");
  if (code <= 84) return t("weatherRainShowers");
  if (code <= 94) return t("weatherSnowShowers");
  return t("weatherStormRisk");
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

export default function WeatherSnapshotCardClean({
  data,
  isLoading,
  error,
  onRefresh,
  locationName,
}: WeatherSnapshotCardCleanProps) {
  const colors = useColors();
  const { language, t } = useLanguage();
  const copy = {
    en: { eyebrow: "WEATHER NOW" },
    sw: { eyebrow: "HALI YA HEWA SASA" },
    ki: { eyebrow: "HALI YA HEWA SASA" },
  } as const;

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRefresh();
  };

  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.stateBox}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>{t("heroLoading")}</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.stateBox}>
          <Feather name="alert-triangle" size={18} color={colors.warning} />
          <Text style={[styles.stateText, { color: colors.foreground }]}>{t("heroError")}</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={handleRefresh}>
            <Text style={styles.retryText}>{t("heroRetry")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.stateBox}>
          <Feather name="map-pin" size={18} color={colors.primary} />
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>{t("heroWaiting")}</Text>
        </View>
      </View>
    );
  }

  const { weather, location } = data;
  const primaryLocation = locationName || t("currentLocationLabel");
  const condition = wmoCondition(weather.weathercode, t);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>{copy[language].eyebrow}</Text>
          <Text style={[styles.locationTitle, { color: colors.foreground }]} numberOfLines={1}>
            {primaryLocation}
          </Text>
          <Text style={[styles.locationSub, { color: colors.mutedForeground }]} numberOfLines={1}>
            {Math.abs(location.lat).toFixed(3)}
            {DEGREE} {location.lat >= 0 ? "N" : "S"} {" \u2022 "} {Math.abs(location.lon).toFixed(3)}
            {DEGREE} {location.lon >= 0 ? "E" : "W"}
          </Text>
        </View>
        <Pressable
          onPress={handleRefresh}
          style={[styles.refreshBtn, { backgroundColor: `${colors.primary}12` }]}
          testID="refresh-btn"
        >
          <Feather name="refresh-cw" size={16} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}12` }]}>
          <Feather name={wmoIcon(weather.weathercode)} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.tempText, { color: colors.foreground }]}>
            {Math.round(weather.temperature)}
            <Text style={styles.tempUnit}>{DEGREE}</Text>
          </Text>
          <Text style={[styles.conditionText, { color: colors.mutedForeground }]}>{condition}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        {[
          { icon: "droplet" as const, value: `${weather.humidity}%`, label: t("humidityLabel") },
          { icon: "wind" as const, value: `${weather.windspeed} km/h`, label: t("windLabel") },
          { icon: "activity" as const, value: `${weather.pressure} hPa`, label: t("pressureLabel") },
        ].map((item) => (
          <View key={item.label} style={[styles.statPill, { backgroundColor: colors.background }]}>
            <Feather name={item.icon} size={12} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>{item.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  stateBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 10,
  },
  stateText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  retryBtn: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  locationTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Inter_700Bold",
  },
  locationSub: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Inter_500Medium",
    marginTop: 3,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  tempText: {
    fontSize: 30,
    lineHeight: 34,
    fontFamily: "Inter_700Bold",
  },
  tempUnit: {
    fontSize: 22,
  },
  conditionText: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_500Medium",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statPill: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "flex-start",
    gap: 5,
  },
  statValue: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: "Inter_500Medium",
  },
});
