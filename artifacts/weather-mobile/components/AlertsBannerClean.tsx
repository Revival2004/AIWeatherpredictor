import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColorScheme } from "react-native";

import colorTokens from "@/constants/colors";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import type { WeatherAlert } from "@/lib/api-client";

interface AlertsBannerProps {
  alerts: WeatherAlert[];
  onSeeAll?: () => void;
}

const SEVERITY_COLORS = {
  critical: { bg: "#FFE8E8", border: "#CC0000", text: "#8B0000", dot: "#CC0000" },
  warning: { bg: "#FFF4E0", border: "#CC7700", text: "#7A4500", dot: "#FF8C00" },
  info: { bg: "#E8F5E9", border: "#2E7D32", text: "#1B5E20", dot: "#3D8B37" },
} as const;

const SEVERITY_DARK = {
  critical: { bg: "#3D0000", border: "#FF4444", text: "#FF8888", dot: "#FF4444" },
  warning: { bg: "#3D2200", border: "#FFA500", text: "#FFB74D", dot: "#FFA500" },
  info: { bg: "#0D2B0E", border: "#4CAF50", text: "#81C784", dot: "#4CAF50" },
} as const;

const TYPE_ICONS: Record<string, string> = {
  frost: "\u2744\uFE0F",
  heat: "\uD83D\uDD25",
  heavy_rain: "\uD83C\uDF27\uFE0F",
  strong_wind: "\uD83D\uDCA8",
  disease: "\uD83C\uDF44",
  irrigation: "\uD83D\uDCA7",
  spray_window: "\uD83C\uDF3F",
  harvest_window: "\uD83C\uDF3E",
};

export default function AlertsBannerClean({ alerts, onSeeAll }: AlertsBannerProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = useColors();
  const { language } = useLanguage();
  const [expanded, setExpanded] = useState<string | null>(null);

  const copy = {
    en: {
      title: "Farm alerts",
      critical: "urgent",
      seeAll: "See all {count}",
      action: "WHAT TO DO",
      activeNow: "Active now",
      tomorrow: "Tomorrow",
      inDays: "In {count} days",
      collapse: "Tap to close",
      expand: "Tap for what to do",
    },
    sw: {
      title: "Tahadhari za shamba",
      critical: "hatari",
      seeAll: "Ona zote {count}",
      action: "CHA KUFANYA",
      activeNow: "Inaendelea sasa",
      tomorrow: "Kesho",
      inDays: "Baada ya siku {count}",
      collapse: "Gusa kufunga",
      expand: "Gusa kuona cha kufanya",
    },
    ki: {
      title: "Tahadhari za shamba",
      critical: "hatari",
      seeAll: "Ona zote {count}",
      action: "CHA KUFANYA",
      activeNow: "Inaendelea sasa",
      tomorrow: "Kesho",
      inDays: "Baada ya siku {count}",
      collapse: "Gusa kufunga",
      expand: "Gusa kuona cha kufanya",
    },
  } as const;

  const fmt = (text: string, vars: Record<string, string | number>) =>
    Object.entries(vars).reduce(
      (value, [key, replacement]) =>
        value.replace(new RegExp(`\\{${key}\\}`, "g"), String(replacement)),
      text,
    );

  if (!alerts?.length) {
    return null;
  }

  const criticalAlerts = alerts.filter((alert) => alert.severity === "critical");
  const visibleAlerts = alerts.slice(0, 3);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.card : "#FFFBF5" }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>{"\u26A0\uFE0F"}</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{copy[language].title}</Text>
          {criticalAlerts.length > 0 ? (
            <View style={styles.criticalBadge}>
              <Text style={styles.criticalBadgeText}>
                {criticalAlerts.length} {copy[language].critical.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>
        {alerts.length > 3 && onSeeAll ? (
          <TouchableOpacity onPress={onSeeAll}>
            <Text style={[styles.seeAll, { color: colorTokens.light.primary }]}>
              {fmt(copy[language].seeAll, { count: alerts.length })}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {visibleAlerts.map((alert) => {
        const palette = isDark ? SEVERITY_DARK[alert.severity] : SEVERITY_COLORS[alert.severity];
        const isExpanded = expanded === alert.id;
        const timelineLabel =
          alert.daysAhead === 0
            ? copy[language].activeNow
            : alert.daysAhead === 1
            ? copy[language].tomorrow
            : fmt(copy[language].inDays, { count: alert.daysAhead });

        return (
          <TouchableOpacity
            key={alert.id}
            onPress={() => setExpanded(isExpanded ? null : alert.id)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.alertCard,
                {
                  backgroundColor: palette.bg,
                  borderLeftColor: palette.border,
                },
              ]}
            >
              <View style={styles.alertRow}>
                <Text style={styles.alertIcon}>{TYPE_ICONS[alert.type] ?? "\u26A0\uFE0F"}</Text>
                <View style={styles.alertContent}>
                  <View style={styles.alertTitleRow}>
                    <View style={[styles.severityDot, { backgroundColor: palette.dot }]} />
                    <Text
                      style={[styles.alertTitle, { color: palette.text }]}
                      numberOfLines={isExpanded ? undefined : 2}
                    >
                      {alert.title}
                    </Text>
                  </View>
                  {isExpanded ? (
                    <>
                      <Text style={[styles.alertMessage, { color: palette.text, opacity: 0.85 }]}>
                        {alert.message}
                      </Text>
                      <View style={[styles.actionBox, { borderColor: palette.border }]}>
                        <Text style={[styles.actionLabel, { color: palette.text }]}>
                          {copy[language].action}
                        </Text>
                        <Text style={[styles.actionText, { color: palette.text }]}>
                          {alert.actionRequired}
                        </Text>
                      </View>
                    </>
                  ) : null}
                  <Text style={[styles.alertMeta, { color: palette.text, opacity: 0.6 }]}>
                    {timelineLabel} {"\u2022"}{" "}
                    {isExpanded ? copy[language].collapse : copy[language].expand}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  headerIcon: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  criticalBadge: {
    backgroundColor: "#CC0000",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  criticalBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "600",
  },
  alertCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 12,
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  alertIcon: {
    fontSize: 22,
    marginTop: 1,
  },
  alertContent: {
    flex: 1,
    gap: 4,
  },
  alertTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  severityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
    lineHeight: 18,
  },
  alertMessage: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  actionBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 3,
    opacity: 0.7,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  alertMeta: {
    fontSize: 11,
    marginTop: 4,
  },
});
