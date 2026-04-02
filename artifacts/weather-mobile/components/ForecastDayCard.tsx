import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";
import colorTokens from "@/constants/colors";
import type { DailyForecast } from "@workspace/api-client-react";

interface ForecastDayCardProps {
  day: DailyForecast;
  isToday?: boolean;
}

function wmoFeatherIcon(code: number): keyof typeof Feather.glyphMap {
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

function wmoIconColor(code: number): string {
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

function getScoreColor(score: number): string {
  if (score >= 8) return "#3D8B37";
  if (score >= 6) return "#7BAE37";
  if (score >= 4) return "#FF8C00";
  return "#CC0000";
}

function getScoreLabel(score: number): string {
  if (score >= 8) return "Excellent";
  if (score >= 6) return "Good";
  if (score >= 4) return "Fair";
  return "Poor";
}

const FROST_COLORS: Record<string, string> = {
  none: "transparent",
  low: "#B3D9FF",
  moderate: "#4FC3F7",
  high: "#0277BD",
  severe: "#01579B",
};

const DISEASE_COLORS: Record<string, string> = {
  low: "#3D8B37",
  moderate: "#FF8C00",
  high: "#CC0000",
};

function formatDate(dateStr: string): { day: string; dayOfWeek: string } {
  const date = new Date(dateStr + "T12:00:00");
  const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "short" });
  const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { day, dayOfWeek };
}

export default function ForecastDayCard({ day, isToday }: ForecastDayCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const { day: dateLabel, dayOfWeek } = formatDate(day.date);
  const scoreColor = getScoreColor(day.fieldDayScore);
  const scoreLabel = getScoreLabel(day.fieldDayScore);

  return (
    <TouchableOpacity
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.85}
      style={[
        styles.card,
        {
          backgroundColor: isDark ? colors.card : "#FFFFFF",
          borderColor: isToday ? colorTokens.light.primary : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
          borderWidth: isToday ? 2 : 1,
        },
      ]}
    >
      {isToday && (
        <View style={styles.todayBadge}>
          <Text style={styles.todayBadgeText}>TODAY</Text>
        </View>
      )}

      {/* Main row */}
      <View style={styles.mainRow}>
        {/* Date */}
        <View style={styles.dateCol}>
          <Text style={[styles.dayOfWeek, { color: colors.mutedForeground }]}>{dayOfWeek}</Text>
          <Text style={[styles.dateLabel, { color: colors.text }]}>{dateLabel}</Text>
        </View>

        {/* Weather icon + temps */}
        <View style={styles.weatherCol}>
          <View style={[styles.weatherIconCircle, { backgroundColor: wmoIconColor(day.weathercode) + "22" }]}>
            <Feather name={wmoFeatherIcon(day.weathercode)} size={20} color={wmoIconColor(day.weathercode)} />
          </View>
          <Text style={[styles.tempRange, { color: colors.text }]}>
            {day.tempMax}° / {day.tempMin}°
          </Text>
        </View>

        {/* Field Day Score */}
        <View style={styles.scoreCol}>
          <Text style={[styles.scoreValue, { color: scoreColor }]}>{day.fieldDayScore}</Text>
          <Text style={styles.scoreDenom}>/10</Text>
          <Text style={[styles.scoreLabel, { color: scoreColor }]}>{scoreLabel}</Text>
        </View>

        {/* Risk indicators */}
        <View style={styles.riskCol}>
          {day.frostRisk !== "none" && (
            <View style={[styles.riskPill, { backgroundColor: FROST_COLORS[day.frostRisk] + "33", borderColor: FROST_COLORS[day.frostRisk] }]}>
              <Feather name="thermometer" size={9} color={isDark ? "#90CAF9" : FROST_COLORS[day.frostRisk]} />
              <Text style={[styles.riskPillText, { color: isDark ? "#90CAF9" : FROST_COLORS[day.frostRisk] }]}>
                {day.frostRisk}
              </Text>
            </View>
          )}
          {day.heatRisk !== "none" && (
            <View style={[styles.riskPill, { backgroundColor: "#FF4500" + "22", borderColor: "#FF4500" }]}>
              <Feather name="sun" size={9} color={isDark ? "#FFAB91" : "#BF360C"} />
              <Text style={[styles.riskPillText, { color: isDark ? "#FFAB91" : "#BF360C" }]}>
                {day.heatRisk}
              </Text>
            </View>
          )}
          {day.diseasePressure !== "low" && (
            <View style={[styles.riskPill, { backgroundColor: DISEASE_COLORS[day.diseasePressure] + "22", borderColor: DISEASE_COLORS[day.diseasePressure] }]}>
              <Feather name="alert-triangle" size={9} color={isDark ? "#CE93D8" : DISEASE_COLORS[day.diseasePressure]} />
              <Text style={[styles.riskPillText, { color: isDark ? "#CE93D8" : DISEASE_COLORS[day.diseasePressure] }]}>
                {day.diseasePressure}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Quick stats row */}
      <View style={[styles.statsRow, { borderTopColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
        <View style={styles.statItem}>
          <Feather name="cloud-rain" size={12} color="#1976D2" />
          <Text style={[styles.statValue, { color: colors.text }]}>{day.precipitationSum}mm</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{day.precipitationProbability}%</Text>
        </View>
        <View style={styles.statItem}>
          <Feather name="wind" size={12} color={colors.mutedForeground} />
          <Text style={[styles.statValue, { color: colors.text }]}>{day.windspeedMax}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>km/h</Text>
        </View>
        <View style={styles.statItem}>
          <Feather name="droplet" size={12} color="#00ACC1" />
          <Text style={[styles.statValue, { color: colors.text }]}>{day.avgHumidity}%</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>humid</Text>
        </View>
        <View style={styles.statItem}>
          <Feather name="sun" size={12} color="#F57F17" />
          <Text style={[styles.statValue, { color: colors.text }]}>UV {day.uvIndexMax}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>index</Text>
        </View>
        <View style={styles.statItem}>
          <Feather name="activity" size={12} color={colorTokens.light.primary} />
          <Text style={[styles.statValue, { color: colorTokens.light.primary }]}>{day.gdd}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>GDD</Text>
        </View>
        {day.sprayWindowOpen && (
          <View style={[styles.sprayBadge, { backgroundColor: colorTokens.light.primary + "20" }]}>
            <Feather name="check-circle" size={11} color={colorTokens.light.primary} />
            <Text style={[styles.sprayBadgeText, { color: colorTokens.light.primary }]}>Spray OK</Text>
          </View>
        )}
        {day.irrigationNeeded && (
          <View style={[styles.sprayBadge, { backgroundColor: "#2196F3" + "20" }]}>
            <Feather name="droplet" size={11} color="#1565C0" />
            <Text style={[styles.sprayBadgeText, { color: "#1565C0" }]}>Irrigate</Text>
          </View>
        )}
      </View>

      {/* Expanded farm actions */}
      {expanded && (
        <View style={[styles.actionsContainer, { borderTopColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
          <Text style={[styles.actionsTitle, { color: colors.mutedForeground }]}>FARM ACTIONS</Text>
          {day.farmActions.map((action, idx) => (
            <View key={idx} style={styles.actionRow}>
              <View style={[styles.actionDot, { backgroundColor: colorTokens.light.primary }]} />
              <Text style={[styles.actionText, { color: colors.text }]}>{action}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.expandHint, { color: colors.mutedForeground }]}>
        {expanded ? "▲ collapse" : "▼ tap for farm actions"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  todayBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: colorTokens.light.primary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  todayBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    paddingRight: 60,
    gap: 10,
  },
  dateCol: {
    width: 52,
  },
  dayOfWeek: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  weatherCol: {
    alignItems: "center",
    width: 50,
  },
  weatherIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  tempRange: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  scoreCol: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 1,
    minWidth: 72,
  },
  scoreValue: {
    fontSize: 26,
    fontWeight: "800",
  },
  scoreDenom: {
    fontSize: 13,
    color: "#999",
    fontWeight: "600",
    alignSelf: "flex-end",
    marginBottom: 2,
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4,
    alignSelf: "flex-end",
    marginBottom: 3,
  },
  riskCol: {
    flex: 1,
    gap: 4,
  },
  riskPill: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  riskPillText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 6,
    alignItems: "center",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginRight: 6,
  },
  statValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
  },
  sprayBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sprayBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  actionsContainer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    borderTopWidth: 1,
    gap: 6,
  },
  actionsTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 4,
  },
  actionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
    flexShrink: 0,
  },
  actionText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  expandHint: {
    textAlign: "center",
    fontSize: 11,
    paddingVertical: 6,
  },
});
