import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@/lib/api-client/custom-fetch";

interface TimelineSlot {
  time: string;
  hour: number;
  label: string;
  temperature: number;
  probability: number;
  willRain: boolean;
  weathercode: number;
  isNow: boolean;
}

interface Props {
  lat: number;
  lon: number;
}

function slotColor(probability: number): string {
  if (probability >= 70) return "#1E40AF";
  if (probability >= 50) return "#3D8B37";
  if (probability >= 30) return "#D97706";
  return "#6B7280";
}

function slotBg(probability: number, dark: boolean): string {
  if (probability >= 70) return dark ? "#1E3A5F" : "#DBEAFE";
  if (probability >= 50) return dark ? "#1A3A1A" : "#DCFCE7";
  if (probability >= 30) return dark ? "#3A2A00" : "#FEF9C3";
  return dark ? "#1F1F1F" : "#F3F4F6";
}

export default function TodayTimeline({ lat, lon }: Props) {
  const colors = useColors();
  const isDark = colors.background === "#1C1917";

  const { data, isLoading, error } = useQuery({
    queryKey: ["today-timeline", lat, lon],
    queryFn: () => customFetch<{ slots: TimelineSlot[] }>(`/api/weather/today-timeline?lat=${lat}&lon=${lon}`, {
      responseType: "json",
    }),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const slots = data?.slots ?? [];

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        TODAY'S RAIN TIMELINE
      </Text>

      {isLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Building today's forecast…
          </Text>
        </View>
      )}

      {error && !isLoading && (
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={14} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
            Timeline unavailable
          </Text>
        </View>
      )}

      {!isLoading && !error && slots.length > 0 && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollRow}
          >
            {slots.map((slot, idx) => {
              const bg = slotBg(slot.probability, isDark);
              const fg = slotColor(slot.probability);
              return (
                <View
                  key={idx}
                  style={[
                    styles.card,
                    { backgroundColor: bg },
                    slot.isNow && styles.nowCard,
                  ]}
                >
                  {slot.isNow && (
                    <View style={[styles.nowBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.nowBadgeText}>NOW</Text>
                    </View>
                  )}
                  <Text style={[styles.timeLabel, { color: slot.isNow ? colors.primary : colors.mutedForeground }]}>
                    {slot.label}
                  </Text>
                  <Feather
                    name={slot.willRain ? "cloud-rain" : "sun"}
                    size={20}
                    color={fg}
                  />
                  <Text style={[styles.probability, { color: fg }]}>
                    {slot.probability}%
                  </Text>
                  <Text style={[styles.temp, { color: colors.mutedForeground }]}>
                    {slot.temperature}°
                  </Text>
                </View>
              );
            })}
          </ScrollView>

          {/* Summary sentence */}
          <TimelineSummary slots={slots} colors={colors} />
        </>
      )}

      {!isLoading && !error && slots.length === 0 && (
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          No timeline data for today.
        </Text>
      )}
    </View>
  );
}

function TimelineSummary({
  slots,
  colors,
}: {
  slots: TimelineSlot[];
  colors: ReturnType<typeof useColors>;
}) {
  const rainSlots = slots.filter((s) => s.willRain);
  if (rainSlots.length === 0) {
    return (
      <Text style={[styles.summary, { color: colors.mutedForeground }]}>
        No rain expected for the rest of today.
      </Text>
    );
  }

  const first = rainSlots[0];
  const last = rainSlots[rainSlots.length - 1];
  const isNowRaining = rainSlots.some((s) => s.isNow);

  let msg = "";
  if (isNowRaining && rainSlots.length === 1) {
    msg = `Rain is falling now. Expected to clear after ${first.label}.`;
  } else if (isNowRaining) {
    msg = `Rain ongoing — expected to continue until around ${last.label}.`;
  } else if (rainSlots.length === 1) {
    msg = `Rain likely around ${first.label}. Plan fieldwork before then.`;
  } else {
    msg = `Rain expected from ${first.label} through ${last.label}. Keep an eye on the sky.`;
  }

  return (
    <Text style={[styles.summary, { color: colors.mutedForeground }]}>{msg}</Text>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 20,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  scrollRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 4,
  },
  card: {
    width: 68,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    gap: 4,
    position: "relative",
  },
  nowCard: {
    borderWidth: 2,
    borderColor: "#3D8B37",
  },
  nowBadge: {
    position: "absolute",
    top: -8,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  nowBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  timeLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  probability: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  temp: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 20,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  summary: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginHorizontal: 20,
    marginTop: 10,
    lineHeight: 18,
    fontStyle: "italic",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginHorizontal: 20,
  },
});
