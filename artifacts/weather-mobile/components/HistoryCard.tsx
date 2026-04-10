import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { WeatherRecord } from "@/lib/api-client";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";

interface HistoryCardProps {
  record: WeatherRecord;
}

function wmoCondition(
  code: number,
  t: (key: "weatherClear" | "weatherPartlyCloudy" | "weatherFog" | "weatherDrizzle" | "weatherRain" | "weatherSnow" | "weatherRainShowers" | "weatherSnowShowers" | "weatherStormRisk") => string,
): string {
  if (code === 0) return t("weatherClear");
  if (code <= 3) return t("weatherPartlyCloudy");
  if (code <= 9) return t("weatherFog");
  if (code <= 19) return t("weatherDrizzle");
  if (code <= 29) return t("weatherRain");
  if (code <= 39) return t("weatherSnow");
  if (code <= 49) return t("weatherFog");
  if (code <= 59) return t("weatherDrizzle");
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

function wmoColor(code: number): string {
  if (code === 0) return "#F57F17";
  if (code <= 3) return "#78909C";
  if (code <= 9) return "#90A4AE";
  if (code <= 29) return "#1976D2";
  if (code <= 39) return "#00ACC1";
  if (code <= 49) return "#90A4AE";
  if (code <= 69) return "#1565C0";
  if (code <= 79) return "#00838F";
  if (code <= 84) return "#0D47A1";
  if (code <= 94) return "#006064";
  return "#4A148C";
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function HistoryCard({ record }: HistoryCardProps) {
  const colors = useColors();
  const { t } = useLanguage();
  const code = record.weathercode ?? 0;
  const iconColor = wmoColor(code);
  const iconName = wmoIcon(code);
  const conditionStr = wmoCondition(code, t);

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: `${iconColor}18`,
      alignItems: "center",
      justifyContent: "center",
    },
    info: {
      flex: 1,
    },
    conditionText: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 2,
    },
    predictionText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 6,
    },
    statsRow: {
      flexDirection: "row",
      gap: 10,
    },
    stat: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    statText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    right: {
      alignItems: "flex-end",
    },
    tempText: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      lineHeight: 32,
    },
    timeText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    dateText: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 1,
    },
  });

  return (
    <View style={styles.card} testID="history-card">
      <View style={styles.iconCircle}>
        <Feather name={iconName} size={20} color={iconColor} />
      </View>
      <View style={styles.info}>
        <Text style={styles.conditionText}>{conditionStr}</Text>
        {record.prediction && (
          <Text style={styles.predictionText} numberOfLines={1}>
            {record.prediction}
          </Text>
        )}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Feather name="droplet" size={10} color={colors.mutedForeground} />
            <Text style={styles.statText}>{record.humidity}%</Text>
          </View>
          <View style={styles.stat}>
            <Feather name="wind" size={10} color={colors.mutedForeground} />
            <Text style={styles.statText}>{record.windspeed} km/h</Text>
          </View>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={styles.tempText}>{Math.round(record.temperature)}°</Text>
        <Text style={styles.timeText}>{formatTime(record.createdAt)}</Text>
        <Text style={styles.dateText}>{formatDate(record.createdAt)}</Text>
      </View>
    </View>
  );
}
