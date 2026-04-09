import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { getBaseUrl } from "@/lib/api-client";

interface Slot {
  time: string;
  probability: number;
  precipitation: number;
}

interface StormTimeline {
  slots: Slot[];
  stormArrivalMinutes: number | null;
  stormDetected: boolean;
  stormSoon: boolean;
}

function getApiBase() {
  return getBaseUrl() ?? "http://localhost:8080";
}

function formatArrival(minutes: number): string {
  if (minutes <= 0) return "any moment";
  if (minutes < 60) return `~${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h ${m}min` : `~${h}h`;
}

export default function StormTimelineWidget({ lat, lon }: { lat: number; lon: number }) {
  const colors = useColors();
  const { t } = useLanguage();
  const [data, setData] = useState<StormTimeline | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${getApiBase()}/api/weather/storm-timeline?lat=${lat}&lon=${lon}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [lat, lon]);

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (!data) return null;

  const { stormDetected, stormSoon, stormArrivalMinutes, slots } = data;
  const nextHours = slots.slice(0, 12); // Next 3 hours in 15-min steps

  const headerColor = stormSoon
    ? "#DC2626"
    : stormDetected
    ? "#D4851A"
    : "#3D8B37";

  const headerIcon: keyof typeof Feather.glyphMap = stormSoon
    ? "cloud-lightning"
    : stormDetected
    ? "cloud-rain"
    : "sun";

  const headerLabel = stormSoon
    ? t("stormSoon")
    : stormDetected
    ? `${t("stormArrival")} ${formatArrival(stormArrivalMinutes!)}`
    : t("noStorm");

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: headerColor + "18" }]}>
          <Feather name={headerIcon} size={16} color={headerColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: headerColor }]}>{headerLabel}</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            15-min precipitation forecast - next 3h
          </Text>
        </View>
      </View>

      {/* Timeline bars */}
      <View style={styles.timeline}>
        {nextHours.map((slot, i) => {
          const pct = Math.max(2, slot.probability);
          const barColor =
            slot.probability >= 60
              ? "#DC2626"
              : slot.probability >= 40
              ? "#D4851A"
              : slot.probability >= 20
              ? "#3B82F6"
              : colors.muted;
          const timeStr = slot.time.slice(11, 16);
          return (
            <View key={i} style={styles.bar}>
              <View style={[styles.barFill, { height: `${pct}%`, backgroundColor: barColor }]} />
              {i % 4 === 0 && (
                <Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>{timeStr}</Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { color: "#3B82F6", label: "20-40%" },
          { color: "#D4851A", label: "40-60%" },
          { color: "#DC2626", label: ">60%" },
        ].map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  sub: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  timeline: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 48,
    gap: 2,
    marginBottom: 4,
  },
  bar: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  barFill: {
    width: "100%",
    borderRadius: 2,
    minHeight: 2,
  },
  timeLabel: {
    fontSize: 8,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    position: "absolute",
    bottom: -14,
  },
  legend: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendLabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
});

